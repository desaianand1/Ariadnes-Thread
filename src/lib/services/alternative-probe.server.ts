/**
 * Best Configuration Advisor — probes alternative MC version / loader combinations
 * to find configs that resolve more mods than the current selection.
 *
 * Uses histogram-guided probing: queries which versions unresolved mods actually
 * support, builds a histogram, then probes only the highest-overlap versions.
 */

import type { ModrinthClient } from '$lib/api/client';
import type { ModrinthGameVersion, ModrinthVersion } from '$lib/api/types';
import type { ResolvedProject, AlternativeProbe, ModAvailability } from './types';
import {
    CROSS_LOADER_ALTERNATIVES,
    LOADER_AGNOSTIC_PROJECT_TYPES,
    ADVISOR_PROBE_TIMEOUT_MS,
    GAIN_CHECK_BATCH_SIZE,
    RATE_LIMIT_SAFETY_MARGIN,
    MAX_RATE_LIMIT_WAIT_MS,
    INTER_BATCH_DELAY_MS,
    ADVISOR_EARLY_STOP_PERCENT,
    CURATED_POPULAR_VERSIONS,
    HISTOGRAM_MIN_COVERAGE,
    HISTOGRAM_TOP_CANDIDATES,
    HISTOGRAM_SCAN_TIMEOUT_MS,
    VERSION_AGE_CUTOFF_DAYS
} from '$lib/config/constants';
import { chunkArray } from '$lib/utils/array';
import { buildLoaderList } from './loader-utils';

// =============================================================================
// Histogram Types
// =============================================================================

export interface VersionHistogram {
    /** MC version → loader → set of project IDs that support it */
    counts: Map<string, Map<string, Set<string>>>;
    /** Number of unresolved mods successfully scanned */
    totalScanned: number;
}

// =============================================================================
// Probe Matrix Construction
// =============================================================================

export interface ProbeConfig {
    version: string;
    loader: string;
}

export interface ProbeResult {
    alternatives: AlternativeProbe[];
    modAvailability: Record<string, ModAvailability>;
}

/**
 * Builds the set of alternative configurations to probe.
 */
export function buildProbeMatrix(
    currentVersion: string,
    currentLoader: string,
    adjacentVersions: string[],
    excludeConfigs?: ProbeConfig[]
): ProbeConfig[] {
    const configs: ProbeConfig[] = [];
    const alternativeLoaders = CROSS_LOADER_ALTERNATIVES[currentLoader] ?? [];

    for (const version of adjacentVersions) {
        configs.push({ version, loader: currentLoader });
        for (const altLoader of alternativeLoaders) {
            configs.push({ version, loader: altLoader });
        }
    }

    // Also probe current version with alternative loader
    for (const altLoader of alternativeLoaders) {
        configs.push({ version: currentVersion, loader: altLoader });
    }

    if (excludeConfigs && excludeConfigs.length > 0) {
        return configs.filter(
            (c) => !excludeConfigs.some((ex) => ex.version === c.version && ex.loader === c.loader)
        );
    }

    return configs;
}

// =============================================================================
// Histogram Construction
// =============================================================================

/**
 * Builds a version histogram by querying each unresolved project's full version list.
 * Returns which MC versions each project supports, grouped by loader.
 *
 * Also populates availabilityMap as a side effect — each project's response
 * tells us exactly which configs it supports.
 */
export async function buildVersionHistogram(
    client: ModrinthClient,
    unresolvedProjectIds: string[],
    currentLoader: string,
    releaseVersionSet: Set<string>,
    signal?: AbortSignal,
    projectTypes?: Map<string, string>
): Promise<VersionHistogram> {
    const histogram: VersionHistogram = {
        counts: new Map(),
        totalScanned: 0
    };

    // Split into loader-dependent and loader-agnostic groups
    const loaderDependent = unresolvedProjectIds.filter((id) => {
        const type = projectTypes?.get(id);
        return !type || !LOADER_AGNOSTIC_PROJECT_TYPES.has(type);
    });
    const loaderAgnostic = unresolvedProjectIds.filter((id) => {
        const type = projectTypes?.get(id);
        return type && LOADER_AGNOSTIC_PROJECT_TYPES.has(type);
    });

    // Fallback loaders enabled so histogram captures cross-loader compatibility
    // (e.g. quilt mods available via fabric fallback still count as resolvable)
    const loaders = buildLoaderList(currentLoader);

    // Helper to scan a batch of project IDs and record into the histogram
    async function scanProjects(projectIds: string[], useLoaderFilter: boolean): Promise<void> {
        const chunks = chunkArray(projectIds, GAIN_CHECK_BATCH_SIZE);
        for (let ci = 0; ci < chunks.length; ci++) {
            if (signal?.aborted) break;

            if (ci > 0 || histogram.totalScanned > 0) {
                const state = client.getRateLimitState();
                if (state.remaining < RATE_LIMIT_SAFETY_MARGIN) {
                    const timeUntilReset = Math.max(0, state.resetAt - Date.now());
                    const waitTime = Math.min(
                        Math.max(INTER_BATCH_DELAY_MS, timeUntilReset),
                        MAX_RATE_LIMIT_WAIT_MS
                    );
                    await new Promise((r) => setTimeout(r, waitTime));
                }
            }

            const chunk = chunks[ci];
            const results = await Promise.allSettled(
                chunk.map(async (projectId) => {
                    const queryParams: Record<string, string> = {};
                    if (useLoaderFilter) {
                        queryParams.loaders = JSON.stringify(loaders);
                    }
                    const versions = await client.requestVersion<ModrinthVersion[]>(
                        `project/${projectId}/version`,
                        'v2',
                        { queryParams }
                    );
                    return { projectId, versions };
                })
            );

            for (const result of results) {
                if (result.status !== 'fulfilled') continue;

                histogram.totalScanned++;
                const { projectId, versions } = result.value;
                const seen = new Set<string>();

                for (const versionFile of versions) {
                    for (const gameVersion of versionFile.game_versions) {
                        if (!releaseVersionSet.has(gameVersion)) continue;

                        for (const loader of versionFile.loaders) {
                            const key = `${gameVersion}|${loader}`;
                            if (seen.has(key)) continue;
                            seen.add(key);

                            if (!histogram.counts.has(gameVersion)) {
                                histogram.counts.set(gameVersion, new Map());
                            }
                            const loaderMap = histogram.counts.get(gameVersion)!;
                            if (!loaderMap.has(loader)) {
                                loaderMap.set(loader, new Set());
                            }
                            loaderMap.get(loader)!.add(projectId);
                        }
                    }
                }
            }
        }
    }

    // Scan loader-dependent projects WITH loader filter
    await scanProjects(loaderDependent, true);

    // Scan loader-agnostic projects WITHOUT loader filter
    if (!signal?.aborted) {
        await scanProjects(loaderAgnostic, false);
    }

    return histogram;
}

// =============================================================================
// Version Selection
// =============================================================================

/**
 * Checks whether a MC version is "recent" based on its release date.
 */
export function isRecentVersion(
    target: string,
    allVersions: ModrinthGameVersion[],
    maxAgeDays: number = VERSION_AGE_CUTOFF_DAYS
): boolean {
    const found = allVersions.find((v) => v.version === target);
    if (!found || !found.date) return false;

    const ageMs = Date.now() - new Date(found.date).getTime();
    return ageMs < maxAgeDays * 86_400_000;
}

/**
 * Gets the effective count for a version+loader from the histogram,
 * considering cross-loader fallbacks.
 */
function getHistogramCount(histogram: VersionHistogram, version: string, loader: string): number {
    const loaderMap = histogram.counts.get(version);
    if (!loaderMap) return 0;

    // Collect unique project IDs across loader + fallbacks
    const projectIds = new Set<string>();
    const loaders = buildLoaderList(loader);
    for (const l of loaders) {
        const ids = loaderMap.get(l);
        if (ids) {
            for (const id of ids) projectIds.add(id);
        }
    }
    return projectIds.size;
}

/**
 * Gets the set of project IDs for a version+loader from the histogram,
 * considering cross-loader fallbacks.
 */
function getHistogramProjects(
    histogram: VersionHistogram,
    version: string,
    loader: string
): Set<string> {
    const loaderMap = histogram.counts.get(version);
    if (!loaderMap) return new Set();

    const projectIds = new Set<string>();
    const loaders = buildLoaderList(loader);
    for (const l of loaders) {
        const ids = loaderMap.get(l);
        if (ids) {
            for (const id of ids) projectIds.add(id);
        }
    }
    return projectIds;
}

/**
 * Selects probe versions from histogram data instead of positional adjacency.
 * Picks versions with the highest unresolved mod support.
 */
export function getHistogramProbeVersions(
    target: string,
    allVersions: ModrinthGameVersion[],
    histogram: VersionHistogram,
    isRecent: boolean,
    excludedVersions: Set<string>,
    loader: string,
    maxVersions: number = HISTOGRAM_TOP_CANDIDATES
): string[] {
    const releases = allVersions.filter((v) => v.version_type === 'release');
    const releaseVersions = releases.map((v) => v.version);
    const targetIdx = releaseVersions.indexOf(target);

    const curatedSet = new Set<string>(CURATED_POPULAR_VERSIONS);

    // Build candidate list with counts
    const candidates: Array<{
        version: string;
        count: number;
        isCurated: boolean;
        distance: number;
    }> = [];

    for (const version of releaseVersions) {
        if (version === target) continue;
        if (excludedVersions.has(version)) continue;

        const versionIdx = releaseVersions.indexOf(version);

        // Old versions should only look backward (older), not forward (newer)
        if (!isRecent && targetIdx !== -1 && versionIdx !== -1 && versionIdx < targetIdx) continue;

        const count = getHistogramCount(histogram, version, loader);
        if (count < HISTOGRAM_MIN_COVERAGE) continue;

        const distance =
            targetIdx !== -1 && versionIdx !== -1 ? Math.abs(versionIdx - targetIdx) : Infinity;

        candidates.push({
            version,
            count,
            isCurated: curatedSet.has(version),
            distance
        });
    }

    // Flat histogram fallback: if spread is ≤ 1 across all candidates, use curated only
    if (candidates.length > 0) {
        const counts = candidates.map((c) => c.count);
        const maxCount = Math.max(...counts);
        const minCount = Math.min(...counts);
        if (maxCount - minCount <= 1) {
            // No signal — prefer curated versions
            const curatedCandidates = candidates.filter((c) => c.isCurated);
            if (curatedCandidates.length > 0) {
                curatedCandidates.sort((a, b) => a.distance - b.distance);
                return curatedCandidates.slice(0, maxVersions).map((c) => c.version);
            }
        }
    }

    // Sort by count descending, then curated preference, then distance
    candidates.sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        if (a.isCurated !== b.isCurated) return a.isCurated ? -1 : 1;
        return a.distance - b.distance;
    });

    return candidates.slice(0, maxVersions).map((c) => c.version);
}

// =============================================================================
// Positional Fallback (used when histogram scan fails)
// =============================================================================

/**
 * Backward-compatible positional version discovery.
 * Used as fallback when the histogram scan fails or times out.
 */
function getPositionalProbeVersions(
    target: string,
    allVersions: ModrinthGameVersion[],
    count: number = 3
): string[] {
    const releases = allVersions.filter((v) => v.version_type === 'release');
    const targetIdx = releases.findIndex((v) => v.version === target);
    if (targetIdx === -1) return [];

    const newer = releases
        .slice(Math.max(0, targetIdx - count), targetIdx)
        .map((v) => v.version)
        .reverse();

    const older = releases.slice(targetIdx + 1, targetIdx + 1 + count).map((v) => v.version);

    return [...new Set([...newer, ...older])];
}

// =============================================================================
// Loss Checking
// =============================================================================

/**
 * Checks how many currently-resolved mods LOSE support in an alternative config.
 * Uses POST /v2/version_files/update to batch-check all resolved file hashes.
 * Returns the set of project IDs that are NOT available in the alternative.
 */
async function checkLosses(
    client: ModrinthClient,
    resolvedProjects: ResolvedProject[],
    config: ProbeConfig,
    hashToProjectId: Map<string, string>
): Promise<Set<string>> {
    const hashes = resolvedProjects.map((p) => p.fileHashes.sha1);
    if (hashes.length === 0) return new Set();

    const loaders = buildLoaderList(config.loader);

    const response = await client.requestVersion<Record<string, ModrinthVersion>>(
        'version_files/update',
        'v2',
        {
            method: 'POST',
            body: {
                hashes,
                algorithm: 'sha1',
                loaders,
                game_versions: [config.version]
            }
        }
    );

    const availableHashes = new Set(Object.keys(response));
    const lostProjectIds = new Set<string>();

    for (const hash of hashes) {
        if (!availableHashes.has(hash)) {
            const projectId = hashToProjectId.get(hash);
            if (projectId) lostProjectIds.add(projectId);
        }
    }

    return lostProjectIds;
}

// =============================================================================
// Gain Checking (fallback path only)
// =============================================================================

/**
 * Checks how many currently-unresolved mods GAIN support in an alternative config.
 * Only used in the positional fallback path when histogram scan fails.
 */
async function checkGains(
    client: ModrinthClient,
    unresolvedProjectIds: string[],
    config: ProbeConfig,
    signal?: AbortSignal
): Promise<Map<string, boolean>> {
    const gains = new Map<string, boolean>();
    const loaders = buildLoaderList(config.loader);
    const chunks = chunkArray(unresolvedProjectIds, GAIN_CHECK_BATCH_SIZE);

    for (let ci = 0; ci < chunks.length; ci++) {
        if (signal?.aborted) break;

        if (ci > 0) {
            const state = client.getRateLimitState();
            if (state.remaining < RATE_LIMIT_SAFETY_MARGIN) {
                const timeUntilReset = Math.max(0, state.resetAt - Date.now());
                const waitTime = Math.min(
                    Math.max(INTER_BATCH_DELAY_MS, timeUntilReset),
                    MAX_RATE_LIMIT_WAIT_MS
                );
                await new Promise((r) => setTimeout(r, waitTime));
            }
        }

        const chunk = chunks[ci];
        const results = await Promise.allSettled(
            chunk.map(async (projectId) => {
                const versions = await client.requestVersion<ModrinthVersion[]>(
                    `project/${projectId}/version`,
                    'v2',
                    {
                        queryParams: {
                            game_versions: JSON.stringify([config.version]),
                            loaders: JSON.stringify(loaders)
                        }
                    }
                );
                return { projectId, hasVersion: versions.length > 0 };
            })
        );

        for (let j = 0; j < results.length; j++) {
            const result = results[j];
            if (result.status === 'fulfilled') {
                gains.set(result.value.projectId, result.value.hasVersion);
            } else {
                console.warn(`Gain check failed for ${chunk[j]}:`, result.reason);
            }
        }
    }

    return gains;
}

// =============================================================================
// Main Probe Entry Point
// =============================================================================

/**
 * Probes alternative configurations and returns ranked alternatives + per-mod availability.
 *
 * Flow:
 * 1. Histogram scan — query each unresolved project's full version list
 * 2. Version selection — pick top versions from histogram
 * 3. Matrix construction — build probe configs
 * 4. Sequential loss checks — only need loss data, gains come from histogram
 * 5. Rank and return
 *
 * Falls back to positional probing if histogram scan fails.
 */
export async function probeAlternatives(
    client: ModrinthClient,
    resolvedProjects: ResolvedProject[],
    unresolvedProjectIds: string[],
    currentVersion: string,
    currentLoader: string,
    allGameVersions: ModrinthGameVersion[],
    excludeConfigs?: ProbeConfig[],
    projectTypes?: Map<string, string>
): Promise<ProbeResult> {
    if (unresolvedProjectIds.length === 0) {
        return { alternatives: [], modAvailability: {} };
    }

    // Build hash → projectId lookup for loss detection
    const hashToProjectId = new Map<string, string>();
    for (const project of resolvedProjects) {
        if (hashToProjectId.has(project.fileHashes.sha1)) {
            console.warn(
                `Duplicate SHA1 hash for projects: ${hashToProjectId.get(project.fileHashes.sha1)} and ${project.projectId}`
            );
        }
        hashToProjectId.set(project.fileHashes.sha1, project.projectId);
    }

    const totalProjects = resolvedProjects.length + unresolvedProjectIds.length;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ADVISOR_PROBE_TIMEOUT_MS);

    // Build release version set once for filtering
    const releaseVersionSet = new Set(
        allGameVersions.filter((v) => v.version_type === 'release').map((v) => v.version)
    );

    // Extract excluded versions from excludeConfigs
    const excludedVersionSet = new Set<string>();
    if (excludeConfigs) {
        for (const ec of excludeConfigs) {
            excludedVersionSet.add(ec.version);
        }
    }

    // Availability map accumulated during histogram scan
    const availabilityMap = new Map<string, Array<{ version: string; loader: string }>>();

    let probeVersions: string[];
    let histogramAvailable = false;
    let histogram: VersionHistogram | null = null;

    try {
        // Phase 1: Histogram scan with sub-timeout
        const histogramController = new AbortController();
        const histogramTimeout = setTimeout(
            () => histogramController.abort(),
            HISTOGRAM_SCAN_TIMEOUT_MS
        );

        // Abort histogram if parent aborts
        const parentAbortHandler = () => histogramController.abort();
        controller.signal.addEventListener('abort', parentAbortHandler);

        try {
            histogram = await buildVersionHistogram(
                client,
                unresolvedProjectIds,
                currentLoader,
                releaseVersionSet,
                histogramController.signal,
                projectTypes
            );
            histogramAvailable = histogram.totalScanned > 0;
        } finally {
            clearTimeout(histogramTimeout);
            controller.signal.removeEventListener('abort', parentAbortHandler);
        }

        if (histogramAvailable && histogram) {
            // Phase 2: Version selection from histogram
            const recent = isRecentVersion(currentVersion, allGameVersions);

            probeVersions = getHistogramProbeVersions(
                currentVersion,
                allGameVersions,
                histogram,
                recent,
                excludedVersionSet,
                currentLoader
            );

            // Populate availabilityMap from histogram data
            for (const [gameVersion, loaderMap] of histogram.counts) {
                for (const [loader, projectIds] of loaderMap) {
                    for (const projectId of projectIds) {
                        if (!availabilityMap.has(projectId)) {
                            availabilityMap.set(projectId, []);
                        }
                        availabilityMap.get(projectId)!.push({ version: gameVersion, loader });
                    }
                }
            }
        } else {
            // Fallback: positional probing
            probeVersions = getPositionalProbeVersions(currentVersion, allGameVersions);
        }
    } catch {
        // Histogram scan failed entirely — fallback to positional
        probeVersions = getPositionalProbeVersions(currentVersion, allGameVersions);
    }

    // Phase 3: Matrix construction
    const probeMatrix = buildProbeMatrix(
        currentVersion,
        currentLoader,
        probeVersions,
        excludeConfigs
    );

    if (probeMatrix.length === 0) {
        clearTimeout(timeoutId);
        return {
            alternatives: [],
            modAvailability: buildModAvailability(availabilityMap, currentVersion, currentLoader)
        };
    }

    // Phase 4: Probe execution
    let alternatives: AlternativeProbe[];
    let bestPercentage = 0;
    let bestNetGain = 0;

    try {
        const completed: AlternativeProbe[] = [];

        if (histogramAvailable && histogram) {
            // Histogram path: sort by histogram count, use histogram for gains, only check losses
            const sortedMatrix = [...probeMatrix].sort((a, b) => {
                const aCount = getHistogramCount(histogram!, a.version, a.loader);
                const bCount = getHistogramCount(histogram!, b.version, b.loader);
                return bCount - aCount;
            });

            for (const config of sortedMatrix) {
                if (controller.signal.aborted) break;
                if (bestPercentage >= ADVISOR_EARLY_STOP_PERCENT) break;

                const histCount = getHistogramCount(histogram, config.version, config.loader);

                // O1: Skip when histogram shows zero gains
                if (histCount === 0) continue;

                // O2: Branch-and-bound pruning — use strict < so equal-count
                // candidates are still probed (they may have fewer losses)
                if (histCount < bestNetGain) continue;

                try {
                    const lostIds = await checkLosses(
                        client,
                        resolvedProjects,
                        config,
                        hashToProjectId
                    );

                    // Gains come from histogram
                    const gainedIds = getHistogramProjects(
                        histogram,
                        config.version,
                        config.loader
                    );
                    const newlyResolved = [...gainedIds];
                    const newlyLost = [...lostIds];
                    const netGain = newlyResolved.length - newlyLost.length;
                    const resolvedCount =
                        resolvedProjects.length - newlyLost.length + newlyResolved.length;
                    const missingCount = totalProjects - resolvedCount;
                    const percentage =
                        totalProjects > 0 ? Math.round((resolvedCount / totalProjects) * 100) : 0;

                    const alt: AlternativeProbe = {
                        version: config.version,
                        loader: config.loader,
                        resolvedCount,
                        missingCount,
                        netGain,
                        newlyResolved,
                        newlyLost,
                        percentage
                    };

                    completed.push(alt);

                    if (percentage > bestPercentage) bestPercentage = percentage;
                    if (netGain > bestNetGain) bestNetGain = netGain;

                    // O4: Early return when histogram peak covers all unresolved with zero losses
                    if (
                        newlyResolved.length === unresolvedProjectIds.length &&
                        newlyLost.length === 0
                    ) {
                        break;
                    }
                } catch (err) {
                    console.warn(
                        `Advisor probe failed for ${config.version}/${config.loader}:`,
                        err
                    );
                }
            }
        } else {
            // Fallback path: old-style parallel loss + gain checks
            for (const config of probeMatrix) {
                if (controller.signal.aborted) break;
                if (bestPercentage >= ADVISOR_EARLY_STOP_PERCENT) break;

                try {
                    const [lostIds, gainMap] = await Promise.all([
                        checkLosses(client, resolvedProjects, config, hashToProjectId),
                        checkGains(client, unresolvedProjectIds, config, controller.signal)
                    ]);

                    const newlyResolved: string[] = [];
                    for (const [projectId, hasVersion] of gainMap) {
                        if (hasVersion) {
                            newlyResolved.push(projectId);
                            if (!availabilityMap.has(projectId)) {
                                availabilityMap.set(projectId, []);
                            }
                            availabilityMap.get(projectId)!.push({
                                version: config.version,
                                loader: config.loader
                            });
                        }
                    }

                    const newlyLost = [...lostIds];
                    const netGain = newlyResolved.length - newlyLost.length;
                    const resolvedCount =
                        resolvedProjects.length - newlyLost.length + newlyResolved.length;
                    const missingCount = totalProjects - resolvedCount;
                    const percentage =
                        totalProjects > 0 ? Math.round((resolvedCount / totalProjects) * 100) : 0;

                    completed.push({
                        version: config.version,
                        loader: config.loader,
                        resolvedCount,
                        missingCount,
                        netGain,
                        newlyResolved,
                        newlyLost,
                        percentage
                    });

                    if (percentage > bestPercentage) bestPercentage = percentage;
                } catch (err) {
                    console.warn(
                        `Advisor probe failed for ${config.version}/${config.loader}:`,
                        err
                    );
                }
            }
        }

        if (controller.signal.aborted && completed.length < probeMatrix.length) {
            console.warn(
                `Advisor probe timed out: ${completed.length}/${probeMatrix.length} probes completed`
            );
        }

        alternatives = completed.filter((a) => a.netGain > 0).sort((a, b) => b.netGain - a.netGain);
    } catch {
        alternatives = [];
    } finally {
        clearTimeout(timeoutId);
    }

    return {
        alternatives,
        modAvailability: buildModAvailability(availabilityMap, currentVersion, currentLoader)
    };
}

/**
 * Builds ModAvailability records from accumulated availability data.
 */
function buildModAvailability(
    availabilityMap: Map<string, Array<{ version: string; loader: string }>>,
    currentVersion: string,
    currentLoader: string
): Record<string, ModAvailability> {
    const modAvailability: Record<string, ModAvailability> = {};
    for (const [projectId, configs] of availabilityMap) {
        const isNearMiss = configs.some(
            (c) =>
                (c.loader === currentLoader && c.version !== currentVersion) ||
                (c.version === currentVersion && c.loader !== currentLoader)
        );
        modAvailability[projectId] = {
            projectId,
            availableOn: configs,
            isNearMiss
        };
    }
    return modAvailability;
}
