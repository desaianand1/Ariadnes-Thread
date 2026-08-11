import type { ModrinthClient } from '$lib/api/client';
import type { ModrinthProject, ModrinthVersion, ModrinthFile } from '$lib/api/types';
import { getProjectFolder } from '$lib/api/types';
import { classifyProject } from './side-classification';
import {
    LOADER_AGNOSTIC_PROJECT_TYPES,
    RATE_LIMIT_SAFETY_MARGIN,
    INTER_BATCH_DELAY_MS,
    MAX_RATE_LIMIT_WAIT_MS
} from '$lib/config/constants';
import { chunkArray } from '$lib/utils/array';
import { buildLoaderList, buildUnresolvedReason } from './loader-utils';
import type {
    ResolutionOptions,
    ResolvedProject,
    ResolutionResult,
    ResolutionWarning,
    UnresolvedDependency,
    ResolutionStats
} from './types';
import { resolveDependencies } from './dependency.server';

// =============================================================================
// Version Type Ranking
// =============================================================================

const VERSION_TYPE_RANK: Record<string, number> = {
    release: 0,
    beta: 1,
    alpha: 2
};

// =============================================================================
// resolveVersion
// =============================================================================

export interface VersionResolution {
    resolved: ResolvedProject;
    warnings: ResolutionWarning[];
}

/**
 * Resolves the best matching version for a single project given the
 * game version and loader constraints.
 */
export async function resolveVersion(
    client: ModrinthClient,
    project: ModrinthProject,
    options: ResolutionOptions
): Promise<VersionResolution | null> {
    const warnings: ResolutionWarning[] = [];
    const isLoaderAgnostic = LOADER_AGNOSTIC_PROJECT_TYPES.has(project.project_type);

    // Build the ordered list of loaders to try
    const loaders = isLoaderAgnostic
        ? []
        : buildLoaderList(options.loader, options.enableCrossLoaderFallback);

    const versions = await fetchVersions(client, project.id, options.gameVersion, loaders);

    if (versions.length === 0) {
        // Minor-version fallback for loader-agnostic projects (resourcepacks, shaders, datapacks)
        if (isLoaderAgnostic) {
            const fallbackResult = await tryMinorVersionFallback(
                client,
                project,
                options,
                warnings
            );
            if (fallbackResult) return fallbackResult;
        }
        return null;
    }

    // Filter alpha/beta if not allowed, but fall back with warning if nothing remains
    let candidates = versions;
    if (!options.allowAlphaBeta) {
        const stableOnly = versions.filter((v) => v.version_type === 'release');
        if (stableOnly.length > 0) {
            candidates = stableOnly;
        } else {
            warnings.push({
                type: 'alpha-beta-version',
                projectId: project.id,
                message: `${project.title}: no stable release found, using ${versions[0].version_type} version`
            });
        }
    }

    candidates.sort((a, b) => compareVersionCandidates(a, b));

    const best = candidates[0];
    const file = selectPrimaryFile(best.files);
    if (!file) return null;

    // Detect if we fell back to a different loader
    const usedFallbackLoader = !isLoaderAgnostic && !best.loaders.includes(options.loader);
    const resolvedLoader = usedFallbackLoader
        ? best.loaders.find((l) => loaders.includes(l))
        : undefined;

    if (usedFallbackLoader && resolvedLoader) {
        warnings.push({
            type: 'fallback-used',
            projectId: project.id,
            message: `${project.title}: no ${options.loader} version, using ${resolvedLoader} version`
        });
    }

    const resolved = buildResolvedProject(project, best, file, {
        usedFallbackLoader,
        resolvedLoader
    });

    return { resolved, warnings };
}

// =============================================================================
// resolveCollection
// =============================================================================

/**
 * Resolves versions for all projects in a collection, then resolves
 * their dependencies via BFS.
 */
export async function resolveCollection(
    client: ModrinthClient,
    projects: ModrinthProject[],
    options: ResolutionOptions
): Promise<ResolutionResult> {
    const warnings: ResolutionWarning[] = [];
    const unresolved: UnresolvedDependency[] = [];

    // Filter out excluded projects
    const eligible = projects.filter((p) => !options.excludedProjectIds.has(p.id));

    // Fan out version resolution in parallel
    const results = await Promise.allSettled(
        eligible.map((project) => resolveVersion(client, project, options))
    );

    const resolved: ResolvedProject[] = [];

    for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const project = eligible[i];

        if (result.status === 'fulfilled' && result.value) {
            resolved.push(result.value.resolved);
            warnings.push(...result.value.warnings);
        } else {
            const reason =
                result.status === 'rejected'
                    ? String(result.reason)
                    : buildUnresolvedReason(project.project_type, options);

            warnings.push({
                type: 'no-compatible-version',
                projectId: project.id,
                message: `${project.title}: ${reason}`
            });
            unresolved.push({
                projectId: project.id,
                requiredBy: 'collection',
                reason
            });
        }
    }

    // Resolve dependencies (skipped entirely when includeDependencies is false)
    const depResult = options.includeDependencies
        ? await resolveDependencies(client, resolved, options)
        : { resolved: [], conflicts: [], warnings: [], unresolved: [] };

    // Deduplicate: deps already in the main resolved set are skipped
    const mainIds = new Set(resolved.map((r) => r.projectId));
    const dedupedDeps = depResult.resolved.filter((d) => !mainIds.has(d.projectId));

    const allWarnings = [...warnings, ...depResult.warnings];
    const allUnresolved = [...unresolved, ...depResult.unresolved];

    const stats: ResolutionStats = {
        totalProjects: eligible.length,
        resolvedCount: resolved.length,
        unresolvedCount: allUnresolved.length,
        dependencyCount: dedupedDeps.length,
        conflictCount: depResult.conflicts.length,
        warningCount: allWarnings.length,
        totalDownloadSize:
            resolved.reduce((sum, r) => sum + r.fileSize, 0) +
            dedupedDeps.reduce((sum, r) => sum + r.fileSize, 0)
    };

    return {
        resolved,
        dependencies: dedupedDeps,
        conflicts: depResult.conflicts,
        warnings: allWarnings,
        unresolved: allUnresolved,
        stats
    };
}

// =============================================================================
// Batched Resolution (for large loads)
// =============================================================================

export interface BatchResult {
    resolved: ResolvedProject[];
    warnings: ResolutionWarning[];
    unresolved: UnresolvedDependency[];
    /** How long (ms) the system waited for rate-limit reset before this batch ran */
    waitedMs?: number;
}

/**
 * Resolves a single batch of projects. Used by the server load to split
 * large collections into rate-limit-safe chunks.
 */
export async function resolveBatch(
    client: ModrinthClient,
    projects: ModrinthProject[],
    options: ResolutionOptions
): Promise<BatchResult> {
    const warnings: ResolutionWarning[] = [];
    const unresolved: UnresolvedDependency[] = [];

    const results = await Promise.allSettled(
        projects.map((project) => resolveVersion(client, project, options))
    );

    const resolved: ResolvedProject[] = [];

    for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const project = projects[i];

        if (result.status === 'fulfilled' && result.value) {
            resolved.push(result.value.resolved);
            warnings.push(...result.value.warnings);
        } else {
            const reason =
                result.status === 'rejected'
                    ? String(result.reason)
                    : buildUnresolvedReason(project.project_type, options);

            warnings.push({
                type: 'no-compatible-version',
                projectId: project.id,
                message: `${project.title}: ${reason}`
            });
            unresolved.push({
                projectId: project.id,
                requiredBy: 'collection',
                reason
            });
        }
    }

    return { resolved, warnings, unresolved };
}

/**
 * Splits projects into chunks and resolves them sequentially with
 * rate-limit-aware pacing. Returns per-batch promises that the caller
 * can stream independently via SvelteKit.
 */
export function createBatchedResolution(
    client: ModrinthClient,
    allProjects: ModrinthProject[],
    options: ResolutionOptions,
    batchSize: number
): { batchPromises: Promise<BatchResult>[]; allBatches: Promise<BatchResult[]> } {
    const eligible = allProjects.filter((p) => !options.excludedProjectIds.has(p.id));
    const chunks = chunkArray(eligible, batchSize);

    const batchPromises: Promise<BatchResult>[] = [];
    let previousBatch: Promise<unknown> = Promise.resolve();

    for (const chunk of chunks) {
        // .catch() before .then() so each batch runs even if the prior one failed
        const batchPromise = previousBatch
            .catch(() => {})
            .then(async () => {
                let waitedMs = 0;
                const state = client.getRateLimitState();
                if (state.remaining < RATE_LIMIT_SAFETY_MARGIN) {
                    const timeUntilReset = Math.max(0, state.resetAt - Date.now());
                    // Use reset time if imminent, but cap to avoid multi-second stalls —
                    // the client's own request queue handles true exhaustion with its own backoff
                    const waitTime = Math.min(
                        Math.max(INTER_BATCH_DELAY_MS, timeUntilReset),
                        MAX_RATE_LIMIT_WAIT_MS
                    );
                    await delay(waitTime);
                    waitedMs = waitTime;
                }
                const result = await resolveBatch(client, chunk, options);
                result.waitedMs = waitedMs;
                return result;
            });
        batchPromises.push(batchPromise);
        previousBatch = batchPromise;
    }

    const allBatches = Promise.all(batchPromises);
    return { batchPromises, allBatches };
}

/**
 * Merges multiple batch results into a single combined result.
 */
export function mergeBatchResults(batchResults: BatchResult[]): BatchResult {
    return {
        resolved: batchResults.flatMap((b) => b.resolved),
        warnings: batchResults.flatMap((b) => b.warnings),
        unresolved: batchResults.flatMap((b) => b.unresolved)
    };
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// =============================================================================
// Helpers
// =============================================================================

async function fetchVersions(
    client: ModrinthClient,
    projectId: string,
    gameVersion: string,
    loaders: string[]
): Promise<ModrinthVersion[]> {
    const queryParams: Record<string, string> = {
        game_versions: JSON.stringify([gameVersion])
    };

    if (loaders.length > 0) {
        queryParams.loaders = JSON.stringify(loaders);
    }

    return client.requestVersion<ModrinthVersion[]>('project', 'v2', {
        pathParams: [projectId, 'version'],
        queryParams
    });
}

/**
 * Compares two version candidates by: version_type rank, featured status,
 * optionally patch distance to a target, then date_published (newest first).
 */
function compareVersionCandidates(
    a: ModrinthVersion,
    b: ModrinthVersion,
    options?: { patchTarget?: string; minorFamily?: string }
): number {
    const rankDiff =
        (VERSION_TYPE_RANK[a.version_type] ?? 99) - (VERSION_TYPE_RANK[b.version_type] ?? 99);
    if (rankDiff !== 0) return rankDiff;

    if (a.featured !== b.featured) return a.featured ? -1 : 1;

    if (options?.patchTarget && options.minorFamily) {
        const aClosest = Math.min(
            ...a.game_versions
                .filter((gv) => getMinorVersionFamily(gv) === options.minorFamily)
                .map((gv) => patchDistance(gv, options.patchTarget!))
        );
        const bClosest = Math.min(
            ...b.game_versions
                .filter((gv) => getMinorVersionFamily(gv) === options.minorFamily)
                .map((gv) => patchDistance(gv, options.patchTarget!))
        );
        if (aClosest !== bClosest) return aClosest - bClosest;
    }

    return new Date(b.date_published).getTime() - new Date(a.date_published).getTime();
}

function selectPrimaryFile(files: ModrinthFile[]): ModrinthFile | undefined {
    return files.find((f) => f.primary) ?? files[0];
}

function buildResolvedProject(
    project: ModrinthProject,
    version: ModrinthVersion,
    file: ModrinthFile,
    overrides?: {
        usedFallbackLoader?: boolean;
        resolvedLoader?: string;
        resolvedGameVersion?: string;
    }
): ResolvedProject {
    const side = classifyProject(version.environment, project.client_side, project.server_side);
    return {
        projectId: project.id,
        projectSlug: project.slug,
        projectTitle: project.title,
        projectDescription: project.description,
        projectType: project.project_type,
        iconUrl: project.icon_url,
        versionId: version.id,
        versionNumber: version.version_number,
        versionType: version.version_type,
        fileName: file.filename,
        fileUrl: file.url,
        fileSize: file.size,
        fileHashes: { sha1: file.hashes.sha1, sha512: file.hashes.sha512 },
        loaders: version.loaders,
        dependencyCount: version.dependencies.length,
        side,
        folder: getProjectFolder(project.project_type),
        clientSide: project.client_side,
        serverSide: project.server_side,
        environment: version.environment,
        usedFallbackLoader: overrides?.usedFallbackLoader ?? false,
        resolvedLoader: overrides?.resolvedLoader,
        resolvedGameVersion: overrides?.resolvedGameVersion,
        color: project.color,
        categories: project.categories,
        downloadCount: project.downloads,
        licenseName: project.license?.name,
        licenseUrl: project.license?.url,
        lastUpdated: version.date_published,
        changelog: version.changelog ?? undefined,
        gallery: project.gallery?.map((g) => ({
            url: g.url,
            featured: g.featured,
            title: g.title,
            description: g.description
        }))
    };
}

// =============================================================================
// Minor-Version Fallback
// =============================================================================

/**
 * Extracts the minor version family from a MC version string.
 * "1.20.1" → "1.20", "1.21" → "1.21", "24w03a" → null (snapshot)
 */
export function getMinorVersionFamily(version: string): string | null {
    const match = version.match(/^(\d+\.\d+)/);
    return match ? match[1] : null;
}

/**
 * Computes the absolute difference between two MC versions' patch segments.
 * Uses parseInt to handle pre-release suffixes like "1.20.1-pre1".
 */
export function patchDistance(version: string, target: string): number {
    const vPatch = parseInt(version.split('.')[2] ?? '0', 10) || 0;
    const tPatch = parseInt(target.split('.')[2] ?? '0', 10) || 0;
    return Math.abs(vPatch - tPatch);
}

/**
 * Attempts a minor-version fallback for loader-agnostic projects when exact
 * version matching fails. Fetches all versions (no game_version filter) and
 * finds the closest version in the same minor family.
 */
async function tryMinorVersionFallback(
    client: ModrinthClient,
    project: ModrinthProject,
    options: ResolutionOptions,
    warnings: ResolutionWarning[]
): Promise<VersionResolution | null> {
    const minorFamily = getMinorVersionFamily(options.gameVersion);
    if (!minorFamily) return null;

    // Fetch ALL versions for this project (no game_version or loader filter)
    const allVersions = await client.requestVersion<ModrinthVersion[]>('project', 'v2', {
        pathParams: [project.id, 'version'],
        queryParams: {}
    });

    if (allVersions.length === 0) return null;

    // Filter to versions in the same minor family
    const familyVersions = allVersions.filter((v) =>
        v.game_versions.some((gv) => {
            const family = getMinorVersionFamily(gv);
            return family === minorFamily;
        })
    );

    if (familyVersions.length === 0) return null;

    // Filter alpha/beta if not allowed
    let candidates = familyVersions;
    if (!options.allowAlphaBeta) {
        const stableOnly = familyVersions.filter((v) => v.version_type === 'release');
        if (stableOnly.length > 0) {
            candidates = stableOnly;
        } else {
            warnings.push({
                type: 'alpha-beta-version',
                projectId: project.id,
                message: `${project.title}: no stable release found, using ${familyVersions[0].version_type} version`
            });
        }
    }

    candidates.sort((a, b) =>
        compareVersionCandidates(a, b, {
            patchTarget: options.gameVersion,
            minorFamily: minorFamily
        })
    );

    const best = candidates[0];
    const file = selectPrimaryFile(best.files);
    if (!file) return null;

    // Find the actual game version used (closest in the family)
    const familyGameVersions = best.game_versions
        .filter((gv) => getMinorVersionFamily(gv) === minorFamily)
        .sort(
            (a, b) => patchDistance(a, options.gameVersion) - patchDistance(b, options.gameVersion)
        );
    const resolvedGameVersion = familyGameVersions[0] ?? best.game_versions[0];

    warnings.push({
        type: 'compatible-version-used',
        projectId: project.id,
        message: `${project.title}: using version built for ${resolvedGameVersion} instead of ${options.gameVersion}`
    });

    const resolved = buildResolvedProject(project, best, file, {
        resolvedGameVersion
    });

    return { resolved, warnings };
}
