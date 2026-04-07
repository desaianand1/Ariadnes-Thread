/**
 * Shared resolution pipeline for /review and /share routes.
 * Extracts collection fetching, version resolution, dependency resolution,
 * conflict detection, and stats computation into a reusable function.
 */

import { error } from '@sveltejs/kit';
import type { Cookies } from '@sveltejs/kit';
import { createClientFromPlatform } from '$lib/api/client.server';
import { reviewParamsSchema, parseReviewOptions } from '$lib/schemas/collection';
import {
    resolveCollection,
    createBatchedResolution,
    mergeBatchResults
} from '$lib/services/resolution.server';
import { resolveDependencies } from '$lib/services/dependency.server';
import { probeAlternatives } from '$lib/services/alternative-probe.server';
import { decimalToHex } from '$lib/utils/colors';

import {
    MAX_TOTAL_PROJECTS,
    ADVISOR_MIN_IMPROVEMENT_PERCENT,
    ADVISOR_MIN_ABSOLUTE_GAIN,
    PAGE_LOAD_TIMEOUT_MS,
    LARGE_LOAD_TIMEOUT_MS,
    PREFETCH_TIMEOUT_MS,
    MODRINTH_BATCH_SIZE,
    RESOLUTION_MESSAGES,
    VIEW_MODE_COOKIE,
    LARGE_LOAD_THRESHOLD,
    RESOLUTION_BATCH_SIZE
} from '$lib/config/constants';
import { getEnvConfig } from '$lib/config/env.server';
import { env as publicEnv } from '$env/dynamic/public';
import type { ModrinthCollection, ModrinthProject, ModrinthGameVersion } from '$lib/api/types';
import type {
    CollectionGroup,
    ResolvedProject,
    AlternativeProbe,
    ModAvailability,
    ResolutionWarning,
    ConflictEntry,
    UnresolvedDependency,
    ResolutionStats
} from '$lib/services/types';

// =============================================================================
// Types
// =============================================================================

interface CollectionFetchResult {
    collection: ModrinthCollection;
    projects: ModrinthProject[];
}

interface CollectionMeta {
    id: string;
    name: string;
    iconUrl?: string;
    color?: number;
    projectCount: number;
    projectIds: Set<string>;
}

interface LoadStep {
    text: string;
}

export interface ReviewLoadParams {
    url: URL;
    platform: Readonly<App.Platform> | undefined;
    cookies: Cookies;
    skipAdvisor?: boolean;
}

// =============================================================================
// Collection Fetching
// =============================================================================

async function fetchCollection(
    client: import('$lib/api/client').ModrinthClient,
    collectionId: string
): Promise<CollectionFetchResult> {
    const collection = await client.request<ModrinthCollection>('collection', {
        pathParams: [collectionId],
        preferredVersion: 'v3'
    });

    const projectIds = collection.projects;
    const projects: ModrinthProject[] = [];

    for (let i = 0; i < projectIds.length; i += MODRINTH_BATCH_SIZE) {
        const chunk = projectIds.slice(i, i + MODRINTH_BATCH_SIZE);
        const batch = await client.requestVersion<ModrinthProject[]>('projects', 'v2', {
            queryParams: { ids: JSON.stringify(chunk) }
        });
        projects.push(...batch);
    }

    return { collection, projects };
}

// =============================================================================
// Empty Response Builder
// =============================================================================

function buildEmptyResponse(
    reviewOptions: ReturnType<typeof parseReviewOptions>,
    loadError: string,
    initialViewMode: 'simple' | 'detailed' = 'detailed'
) {
    const envConfig = getEnvConfig();
    return {
        isLargeLoad: false as const,
        loadError,
        collections: [] as CollectionGroup[],
        dependencies: [] as ResolvedProject[],
        conflicts: [] as ConflictEntry[],
        warnings: [] as ResolutionWarning[],
        unresolved: [] as UnresolvedDependency[],
        stats: {
            totalProjects: 0,
            resolvedCount: 0,
            unresolvedCount: 0,
            dependencyCount: 0,
            conflictCount: 0,
            warningCount: 0,
            totalDownloadSize: 0
        } satisfies ResolutionStats,
        projectTitleMap: {} as Record<string, string>,
        advisorData: Promise.resolve({
            alternatives: [] as AlternativeProbe[],
            modAvailability: {} as Record<string, ModAvailability>
        }),
        unresolvedMetadata: {} as Record<
            string,
            { updated: string; description: string; projectType?: string }
        >,
        context: {
            loadId: crypto.randomUUID(),
            gameVersion: reviewOptions.gameVersion,
            loader: reviewOptions.loader,
            collectionIds: reviewOptions.collectionIds,
            excludedProjectIds: Array.from(reviewOptions.excludedProjectIds)
        },
        downloadSettings: {
            concurrentDownloads: reviewOptions.concurrentDownloads,
            retryCount: reviewOptions.retryCount
        },
        initialViewMode,
        emailEnabled: envConfig.ENABLE_EMAIL_SHARING && !!envConfig.RESEND_API_KEY,
        turnstileSiteKey: publicEnv.PUBLIC_TURNSTILE_SITE_KEY ?? ''
    };
}

// =============================================================================
// Shared Helpers
// =============================================================================

/**
 * Deduplicates resolved projects across collections. First collection claims
 * each project; subsequent collections get cross-reference annotations.
 */
function buildCollectionGroups(
    collectionMetaList: CollectionMeta[],
    allResolved: ResolvedProject[]
): CollectionGroup[] {
    const claimedProjects = new Map<string, { collectionName: string; collectionIndex: number }>();
    const collections: CollectionGroup[] = [];

    for (const meta of collectionMetaList) {
        const resolvedInCollection = allResolved.filter((r) => meta.projectIds.has(r.projectId));

        const alsoInMap: Record<string, string[]> = {};
        const dedupedResolved: ResolvedProject[] = [];

        for (const project of resolvedInCollection) {
            const existing = claimedProjects.get(project.projectId);
            if (existing) {
                if (!alsoInMap[project.projectId]) alsoInMap[project.projectId] = [];
                const originalGroup = collections[existing.collectionIndex];
                if (originalGroup) {
                    if (!originalGroup.alsoInMap[project.projectId])
                        originalGroup.alsoInMap[project.projectId] = [];
                    originalGroup.alsoInMap[project.projectId].push(meta.name);
                }
            } else {
                claimedProjects.set(project.projectId, {
                    collectionName: meta.name,
                    collectionIndex: collections.length
                });
                dedupedResolved.push(project);
            }
        }

        collections.push({
            id: meta.id,
            name: meta.name,
            iconUrl: meta.iconUrl,
            color: decimalToHex(meta.color),
            totalProjectCount: meta.projectCount,
            resolved: dedupedResolved,
            alsoInMap
        });
    }

    return collections;
}

/**
 * Fetches metadata for unresolved projects (title, description, icon, update
 * timestamp) and backfills both the unresolved entries and the title map.
 */
async function fetchUnresolvedMetadata(
    client: import('$lib/api/client').ModrinthClient,
    allUnresolved: UnresolvedDependency[],
    projectTitleMap: Record<string, string>
): Promise<Record<string, { updated: string; description: string; projectType?: string }>> {
    const unresolvedProjectIds = [...new Set(allUnresolved.map((u) => u.projectId))];
    const metadata: Record<string, { updated: string; description: string; projectType?: string }> =
        {};

    if (unresolvedProjectIds.length === 0) return metadata;

    try {
        const fetched = await client.requestVersion<ModrinthProject[]>('projects', 'v2', {
            queryParams: { ids: JSON.stringify(unresolvedProjectIds) }
        });
        for (const p of fetched) {
            if (!projectTitleMap[p.id]) projectTitleMap[p.id] = p.title;
            for (const u of allUnresolved) {
                if (u.projectId === p.id) {
                    u.projectTitle ??= p.title;
                    u.projectDescription ??= p.description;
                    u.projectIconUrl ??= p.icon_url;
                }
            }
            metadata[p.id] = {
                updated: p.updated,
                description: p.description,
                projectType: p.project_type
            };
        }
    } catch {
        // Non-critical — fall back to raw IDs
    }

    return metadata;
}

// =============================================================================
// Advisor Builder
// =============================================================================

function buildAdvisorPromise(
    client: import('$lib/api/client').ModrinthClient,
    allResolved: ResolvedProject[],
    allUnresolved: UnresolvedDependency[],
    reviewOptions: ReturnType<typeof parseReviewOptions>,
    allGameVersions: ModrinthGameVersion[],
    unresolvedMetadata: Record<
        string,
        { updated: string; description: string; projectType?: string }
    >
): Promise<{ alternatives: AlternativeProbe[]; modAvailability: Record<string, ModAvailability> }> {
    const unresolvedIds = [...new Set(allUnresolved.map((u) => u.projectId))];
    const totalForThreshold = allResolved.length + unresolvedIds.length;

    if (unresolvedIds.length === 0 || allGameVersions.length === 0) {
        return Promise.resolve({
            alternatives: [] as AlternativeProbe[],
            modAvailability: {} as Record<string, ModAvailability>
        });
    }

    const projectTypes = new Map<string, string>();
    for (const p of allResolved) projectTypes.set(p.projectId, p.projectType);
    for (const [id, meta] of Object.entries(unresolvedMetadata)) {
        if (meta.projectType) projectTypes.set(id, meta.projectType);
    }

    return probeAlternatives(
        client,
        allResolved,
        unresolvedIds,
        reviewOptions.gameVersion,
        reviewOptions.loader,
        allGameVersions,
        reviewOptions.excludedConfigs.length > 0 ? reviewOptions.excludedConfigs : undefined,
        projectTypes
    )
        .then((result) => ({
            alternatives: result.alternatives.filter(
                (a) =>
                    totalForThreshold > 0 &&
                    (a.netGain >= ADVISOR_MIN_ABSOLUTE_GAIN ||
                        (a.netGain / totalForThreshold) * 100 >= ADVISOR_MIN_IMPROVEMENT_PERCENT)
            ),
            modAvailability: result.modAvailability
        }))
        .catch(() => ({
            alternatives: [] as AlternativeProbe[],
            modAvailability: {} as Record<string, ModAvailability>
        }));
}

// =============================================================================
// Large Load Response (batched streaming)
// =============================================================================

function computeLoadSteps(totalProjects: number, batchCount: number): LoadStep[] {
    const steps: LoadStep[] = [{ text: `Loading ${totalProjects} mods` }];
    for (let i = 1; i <= batchCount; i++) {
        steps.push({ text: `Checking mod batch (${i} of ${batchCount})` });
    }
    steps.push({ text: 'Finding required extras' });
    steps.push({ text: 'Looking for a better setup' });
    return steps;
}

function buildLargeLoadResponse(
    reviewOptions: ReturnType<typeof parseReviewOptions>,
    resolutionOptions: Parameters<typeof resolveCollection>[2],
    client: import('$lib/api/client').ModrinthClient,
    prefetchResults: PromiseSettledResult<CollectionFetchResult>[],
    allGameVersions: ModrinthGameVersion[],
    totalProjects: number,
    initialViewMode: 'simple' | 'detailed',
    skipAdvisor: boolean
) {
    const envConfig = getEnvConfig();

    const collectionMeta: {
        name: string;
        iconUrl?: string;
        projectCount: number;
        collection: ModrinthCollection;
        projects: ModrinthProject[];
    }[] = [];
    const allModpackWarnings: ResolutionWarning[] = [];
    const allProjectsFlat: ModrinthProject[] = [];

    for (const r of prefetchResults) {
        if (r.status !== 'fulfilled') continue;
        const { collection, projects } = r.value;
        const modpacks = projects.filter((p) => p.project_type === 'modpack');
        const filtered = projects.filter((p) => p.project_type !== 'modpack');

        allModpackWarnings.push(
            ...modpacks.map((p) => ({
                type: 'no-compatible-version' as const,
                projectId: p.id,
                message: `${p.title} is a modpack and was skipped`
            }))
        );

        collectionMeta.push({
            name: collection.name,
            iconUrl: collection.icon_url,
            projectCount: projects.length,
            collection,
            projects: filtered
        });
        allProjectsFlat.push(...filtered);
    }

    const seen = new Set<string>();
    const dedupedProjects: ModrinthProject[] = [];
    for (const p of allProjectsFlat) {
        if (!seen.has(p.id)) {
            seen.add(p.id);
            dedupedProjects.push(p);
        }
    }

    const { batchPromises, allBatches } = createBatchedResolution(
        client,
        dedupedProjects,
        resolutionOptions,
        RESOLUTION_BATCH_SIZE
    );

    const batchCount = batchPromises.length;
    const loadSteps = computeLoadSteps(totalProjects, batchCount);

    for (const bp of batchPromises) {
        bp.catch(() => {});
    }

    const largeLoadTimeout = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Large load timed out')), LARGE_LOAD_TIMEOUT_MS);
    });

    const resolutionData = Promise.race([allBatches, largeLoadTimeout]).then(
        async (batchResults) => {
            const merged = mergeBatchResults(batchResults);

            const depResult = resolutionOptions.includeDependencies
                ? await resolveDependencies(client, merged.resolved, resolutionOptions)
                : {
                      resolved: [] as ResolvedProject[],
                      conflicts: [] as ConflictEntry[],
                      warnings: [] as ResolutionWarning[],
                      unresolved: [] as UnresolvedDependency[]
                  };

            const mainIds = new Set(merged.resolved.map((r) => r.projectId));
            const dedupedDeps = depResult.resolved.filter((d) => !mainIds.has(d.projectId));

            const collections = buildCollectionGroups(
                collectionMeta.map((meta) => ({
                    id: meta.collection.id,
                    name: meta.name,
                    iconUrl: meta.iconUrl,
                    color: meta.collection.color,
                    projectCount: meta.projectCount,
                    projectIds: new Set(meta.projects.map((p) => p.id))
                })),
                merged.resolved
            );

            const allWarnings = [...allModpackWarnings, ...merged.warnings, ...depResult.warnings];
            const allUnresolved = [...merged.unresolved, ...depResult.unresolved];

            for (let i = 0; i < prefetchResults.length; i++) {
                if (prefetchResults[i].status === 'rejected') {
                    allWarnings.push({
                        type: 'no-compatible-version',
                        projectId: reviewOptions.collectionIds[i],
                        message: `Failed to fetch collection ${reviewOptions.collectionIds[i]}: ${String((prefetchResults[i] as PromiseRejectedResult).reason)}`
                    });
                }
            }

            const projectTitleMap: Record<string, string> = {};
            for (const g of collections) {
                for (const p of g.resolved) projectTitleMap[p.projectId] = p.projectTitle;
            }
            for (const d of dedupedDeps) projectTitleMap[d.projectId] = d.projectTitle;
            for (const u of allUnresolved) {
                if (u.projectTitle && !projectTitleMap[u.projectId])
                    projectTitleMap[u.projectId] = u.projectTitle;
            }

            const unresolvedMetadata = await fetchUnresolvedMetadata(
                client,
                allUnresolved,
                projectTitleMap
            );

            const allResolved = collections.flatMap((g) => g.resolved);
            const stats: ResolutionStats = {
                totalProjects: collections.reduce((sum, g) => sum + g.totalProjectCount, 0),
                resolvedCount: allResolved.length,
                unresolvedCount: allUnresolved.length,
                dependencyCount: dedupedDeps.length,
                conflictCount: depResult.conflicts.length,
                warningCount: allWarnings.length,
                totalDownloadSize:
                    allResolved.reduce((sum, r) => sum + r.fileSize, 0) +
                    dedupedDeps.reduce((sum, r) => sum + r.fileSize, 0)
            };

            return {
                collections,
                dependencies: dedupedDeps,
                conflicts: depResult.conflicts,
                warnings: allWarnings,
                unresolved: allUnresolved,
                stats,
                projectTitleMap,
                unresolvedMetadata
            };
        }
    );

    const advisorData = skipAdvisor
        ? Promise.resolve({
              alternatives: [] as AlternativeProbe[],
              modAvailability: {} as Record<string, ModAvailability>
          })
        : resolutionData
              .then(async (result) => {
                  const allResolved = result.collections.flatMap((g) => g.resolved);
                  const unresolvedProjectIds = [
                      ...new Set(result.unresolved.map((u) => u.projectId))
                  ];
                  const totalForThreshold = allResolved.length + unresolvedProjectIds.length;

                  if (unresolvedProjectIds.length === 0 || allGameVersions.length === 0) {
                      return {
                          alternatives: [] as AlternativeProbe[],
                          modAvailability: {} as Record<string, ModAvailability>
                      };
                  }

                  const projectTypes = new Map<string, string>();
                  for (const p of allResolved) projectTypes.set(p.projectId, p.projectType);
                  if (result.unresolvedMetadata) {
                      for (const [id, meta] of Object.entries(result.unresolvedMetadata)) {
                          if (meta.projectType) projectTypes.set(id, meta.projectType);
                      }
                  }

                  const probeResult = await probeAlternatives(
                      client,
                      allResolved,
                      unresolvedProjectIds,
                      reviewOptions.gameVersion,
                      reviewOptions.loader,
                      allGameVersions,
                      reviewOptions.excludedConfigs.length > 0
                          ? reviewOptions.excludedConfigs
                          : undefined,
                      projectTypes
                  );

                  return {
                      alternatives: probeResult.alternatives.filter(
                          (a) =>
                              totalForThreshold > 0 &&
                              (a.netGain >= ADVISOR_MIN_ABSOLUTE_GAIN ||
                                  (a.netGain / totalForThreshold) * 100 >=
                                      ADVISOR_MIN_IMPROVEMENT_PERCENT)
                      ),
                      modAvailability: probeResult.modAvailability
                  };
              })
              .catch(() => ({
                  alternatives: [] as AlternativeProbe[],
                  modAvailability: {} as Record<string, ModAvailability>
              }));

    resolutionData.catch(() => {});

    return {
        isLargeLoad: true as const,
        loadSteps,
        collectionMeta: collectionMeta.map((m) => ({
            name: m.name,
            iconUrl: m.iconUrl,
            projectCount: m.projectCount
        })),
        context: {
            loadId: crypto.randomUUID(),
            gameVersion: reviewOptions.gameVersion,
            loader: reviewOptions.loader,
            collectionIds: reviewOptions.collectionIds,
            excludedProjectIds: Array.from(reviewOptions.excludedProjectIds)
        },
        downloadSettings: {
            concurrentDownloads: reviewOptions.concurrentDownloads,
            retryCount: reviewOptions.retryCount
        },
        initialViewMode,
        batchProgress: batchPromises,
        resolutionData,
        advisorData,
        emailEnabled: envConfig.ENABLE_EMAIL_SHARING && !!envConfig.RESEND_API_KEY,
        turnstileSiteKey: publicEnv.PUBLIC_TURNSTILE_SITE_KEY ?? ''
    };
}

// =============================================================================
// Small Load Success Response
// =============================================================================

async function buildSuccessResponse(
    reviewOptions: ReturnType<typeof parseReviewOptions>,
    client: import('$lib/api/client').ModrinthClient,
    collectionResults: PromiseSettledResult<{
        collection: ModrinthCollection;
        result: Awaited<ReturnType<typeof resolveCollection>>;
        modpackWarnings: ResolutionWarning[];
        totalProjectCount: number;
    }>[],
    successfulResults: PromiseFulfilledResult<{
        collection: ModrinthCollection;
        result: Awaited<ReturnType<typeof resolveCollection>>;
        modpackWarnings: ResolutionWarning[];
        totalProjectCount: number;
    }>[],
    allGameVersions: ModrinthGameVersion[],
    initialViewMode: 'simple' | 'detailed' = 'detailed',
    skipAdvisor = false
) {
    const allDependencies: ResolvedProject[] = [];
    const allConflicts: ConflictEntry[] = [];
    const allWarnings: ResolutionWarning[] = [];
    const allUnresolved: UnresolvedDependency[] = [];

    for (let i = 0; i < collectionResults.length; i++) {
        const result = collectionResults[i];
        if (result.status === 'rejected') {
            allWarnings.push({
                type: 'no-compatible-version',
                projectId: reviewOptions.collectionIds[i],
                message: `Failed to fetch collection ${reviewOptions.collectionIds[i]}: ${String(result.reason)}`
            });
        }
    }

    const collectionMetaList: CollectionMeta[] = [];
    const allResolvedByCollection: ResolvedProject[] = [];

    for (const sr of successfulResults) {
        const { collection, result, modpackWarnings, totalProjectCount } = sr.value;

        allWarnings.push(...modpackWarnings);
        allWarnings.push(...result.warnings);
        allConflicts.push(...result.conflicts);
        allUnresolved.push(...result.unresolved);

        collectionMetaList.push({
            id: collection.id,
            name: collection.name,
            iconUrl: collection.icon_url,
            color: collection.color,
            projectCount: totalProjectCount,
            projectIds: new Set(result.resolved.map((r) => r.projectId))
        });
        allResolvedByCollection.push(...result.resolved);

        allDependencies.push(...result.dependencies);
    }

    const collections = buildCollectionGroups(collectionMetaList, allResolvedByCollection);

    const claimedIds = new Set(collections.flatMap((g) => g.resolved.map((r) => r.projectId)));
    const seenDeps = new Set<string>();
    const dedupedDependencies: ResolvedProject[] = [];
    for (const dep of allDependencies) {
        if (!claimedIds.has(dep.projectId) && !seenDeps.has(dep.projectId)) {
            seenDeps.add(dep.projectId);
            dedupedDependencies.push(dep);
        }
    }

    const projectTitleMap: Record<string, string> = {};
    for (const group of collections) {
        for (const p of group.resolved) {
            projectTitleMap[p.projectId] = p.projectTitle;
        }
    }
    for (const dep of dedupedDependencies) {
        projectTitleMap[dep.projectId] = dep.projectTitle;
    }
    for (const u of allUnresolved) {
        if (u.projectTitle && !projectTitleMap[u.projectId]) {
            projectTitleMap[u.projectId] = u.projectTitle;
        }
    }

    const unresolvedMetadata = await fetchUnresolvedMetadata(
        client,
        allUnresolved,
        projectTitleMap
    );

    const allResolved = collections.flatMap((g) => g.resolved);
    const stats: ResolutionStats = {
        totalProjects: collections.reduce((sum, g) => sum + g.totalProjectCount, 0),
        resolvedCount: allResolved.length,
        unresolvedCount: allUnresolved.length,
        dependencyCount: dedupedDependencies.length,
        conflictCount: allConflicts.length,
        warningCount: allWarnings.length,
        totalDownloadSize:
            allResolved.reduce((sum, r) => sum + r.fileSize, 0) +
            dedupedDependencies.reduce((sum, r) => sum + r.fileSize, 0)
    };

    const envConfig = getEnvConfig();

    const advisorData: Promise<{
        alternatives: AlternativeProbe[];
        modAvailability: Record<string, ModAvailability>;
    }> = skipAdvisor
        ? Promise.resolve({
              alternatives: [] as AlternativeProbe[],
              modAvailability: {} as Record<string, ModAvailability>
          })
        : buildAdvisorPromise(
              client,
              allResolved,
              allUnresolved,
              reviewOptions,
              allGameVersions,
              unresolvedMetadata
          );

    return {
        isLargeLoad: false as const,
        loadError: undefined as string | undefined,
        collections,
        dependencies: dedupedDependencies,
        conflicts: allConflicts,
        warnings: allWarnings,
        unresolved: allUnresolved,
        stats,
        projectTitleMap,
        advisorData,
        unresolvedMetadata,
        context: {
            loadId: crypto.randomUUID(),
            gameVersion: reviewOptions.gameVersion,
            loader: reviewOptions.loader,
            collectionIds: reviewOptions.collectionIds,
            excludedProjectIds: Array.from(reviewOptions.excludedProjectIds)
        },
        downloadSettings: {
            concurrentDownloads: reviewOptions.concurrentDownloads,
            retryCount: reviewOptions.retryCount
        },
        initialViewMode,
        emailEnabled: envConfig.ENABLE_EMAIL_SHARING && !!envConfig.RESEND_API_KEY,
        turnstileSiteKey: publicEnv.PUBLIC_TURNSTILE_SITE_KEY ?? ''
    };
}

// =============================================================================
// Main Entry Point
// =============================================================================

export async function loadReviewData(params: ReviewLoadParams) {
    const { url, platform, cookies, skipAdvisor = false } = params;

    const viewModeCookie = cookies.get(VIEW_MODE_COOKIE);
    const initialViewMode = viewModeCookie === 'simple' ? 'simple' : 'detailed';

    const parseResult = reviewParamsSchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parseResult.success) {
        error(400, 'Invalid review parameters');
    }

    const parsedParams = parseResult.data;
    const reviewOptions = parseReviewOptions(parsedParams);

    const resolutionOptions = {
        gameVersion: reviewOptions.gameVersion,
        loader: reviewOptions.loader,
        includeDependencies: reviewOptions.includeDependencies,
        includeOptionalDeps: reviewOptions.includeOptionalDeps,
        enableCrossLoaderFallback: reviewOptions.enableCrossLoaderFallback,
        allowAlphaBeta: reviewOptions.allowAlphaBeta,
        excludedProjectIds: reviewOptions.excludedProjectIds
    };

    const client = createClientFromPlatform(platform);

    const TIMEOUT_MS = PAGE_LOAD_TIMEOUT_MS;
    let timeoutId: ReturnType<typeof setTimeout>;
    const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Request timed out')), TIMEOUT_MS);
    });

    let prefetchResults: PromiseSettledResult<CollectionFetchResult>[];
    let gameVersionsResult: ModrinthGameVersion[];

    const prefetchTimeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Prefetch timed out')), PREFETCH_TIMEOUT_MS);
    });

    try {
        [prefetchResults, gameVersionsResult] = await Promise.race([
            Promise.all([
                Promise.allSettled(
                    reviewOptions.collectionIds.map((id) => fetchCollection(client, id))
                ),
                skipAdvisor
                    ? ([] as ModrinthGameVersion[])
                    : client
                          .requestVersion<ModrinthGameVersion[]>('tag/game_version', 'v2')
                          .catch(() => [] as ModrinthGameVersion[])
            ]),
            prefetchTimeoutPromise
        ]);
    } catch {
        clearTimeout(timeoutId!);
        return buildEmptyResponse(
            reviewOptions,
            RESOLUTION_MESSAGES.PREFETCH_TIMEOUT,
            initialViewMode
        );
    }

    const totalProjects = prefetchResults.reduce((sum, r) => {
        if (r.status === 'fulfilled') return sum + r.value.projects.length;
        return sum;
    }, 0);

    if (totalProjects > MAX_TOTAL_PROJECTS) {
        error(
            400,
            `These collections contain ${totalProjects} projects, which exceeds the maximum of ${MAX_TOTAL_PROJECTS}. Try using fewer or smaller collections.`
        );
    }

    const isLargeLoad = totalProjects > LARGE_LOAD_THRESHOLD;

    if (isLargeLoad) {
        clearTimeout(timeoutId!);
        return buildLargeLoadResponse(
            reviewOptions,
            resolutionOptions,
            client,
            prefetchResults,
            gameVersionsResult,
            totalProjects,
            initialViewMode,
            skipAdvisor
        );
    }

    // ─── Small load path: synchronous resolution with timeout ───
    let collectionResults: PromiseSettledResult<{
        collection: ModrinthCollection;
        result: Awaited<ReturnType<typeof resolveCollection>>;
        modpackWarnings: ResolutionWarning[];
        totalProjectCount: number;
    }>[];

    const resolutionPromise = Promise.allSettled(
        reviewOptions.collectionIds.map(async (id, idx) => {
            const prefetched = prefetchResults[idx];
            const { collection, projects } =
                prefetched.status === 'fulfilled'
                    ? prefetched.value
                    : await fetchCollection(client, id);

            const modpacks = projects.filter((p) => p.project_type === 'modpack');
            const filteredProjects = projects.filter((p) => p.project_type !== 'modpack');

            const modpackWarnings: ResolutionWarning[] = modpacks.map((p) => ({
                type: 'no-compatible-version' as const,
                projectId: p.id,
                message: `${p.title} is a modpack and was skipped`
            }));

            const result = await resolveCollection(client, filteredProjects, resolutionOptions);

            return {
                collection,
                result,
                modpackWarnings,
                totalProjectCount: projects.length
            };
        })
    );

    try {
        collectionResults = await Promise.race([resolutionPromise, timeoutPromise]);
    } catch (e) {
        resolutionPromise.catch(() => {});

        const message =
            e instanceof Error && e.message === 'Request timed out'
                ? RESOLUTION_MESSAGES.TIMEOUT
                : RESOLUTION_MESSAGES.GENERIC;

        return buildEmptyResponse(reviewOptions, message, initialViewMode);
    } finally {
        clearTimeout(timeoutId!);
    }

    const successfulResults = collectionResults.filter(
        (
            r
        ): r is PromiseFulfilledResult<{
            collection: ModrinthCollection;
            result: Awaited<ReturnType<typeof resolveCollection>>;
            modpackWarnings: ResolutionWarning[];
            totalProjectCount: number;
        }> => r.status === 'fulfilled'
    );

    if (successfulResults.length === 0) {
        return buildEmptyResponse(reviewOptions, RESOLUTION_MESSAGES.ALL_FAILED, initialViewMode);
    }

    try {
        return await buildSuccessResponse(
            reviewOptions,
            client,
            collectionResults,
            successfulResults,
            gameVersionsResult,
            initialViewMode,
            skipAdvisor
        );
    } catch (e) {
        console.error('Post-resolution processing failed:', e);
        return buildEmptyResponse(reviewOptions, RESOLUTION_MESSAGES.GENERIC, initialViewMode);
    }
}
