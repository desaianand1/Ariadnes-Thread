/**
 * In-process fallback: wraps existing resolution pipeline behind the
 * ResolutionCacheService interface. Used when the DO binding is absent
 * (local dev, VPS, or DO failure).
 */

import type { ModrinthClient } from '$lib/api/client';
import { createBatchedResolution, mergeBatchResults } from './resolution.server';
import { resolveDependencies } from './dependency.server';
import { probeAlternatives as probeAlternativesFn } from './alternative-probe.server';
import { RESOLUTION_BATCH_SIZE } from '$lib/config/constants';
import {
    fromSerializableOptions,
    deserializeProjectTypes,
    type ResolutionCacheService,
    type ResolveRequest,
    type ResolveResult,
    type ProbeAlternativesRequest,
    type ProbeAlternativesResult
} from './resolution-cache.types';

export class InProcessResolutionCache implements ResolutionCacheService {
    constructor(private client: ModrinthClient) {}

    async resolve(request: ResolveRequest): Promise<ResolveResult> {
        const { projects, options: serializableOptions } = request;
        const options = fromSerializableOptions(serializableOptions);

        // Worker-side fallback uses batched resolution to avoid overwhelming Cloudflare's
        // concurrent fetch limit — resolveCollection() fires all projects simultaneously
        // via Promise.allSettled, which triggers "stalled HTTP response" cancellations
        // when in-flight fetches exceed the platform's internal concurrency cap.
        const { allBatches } = createBatchedResolution(
            this.client,
            projects,
            options,
            RESOLUTION_BATCH_SIZE
        );
        const batchResults = await allBatches;
        const merged = mergeBatchResults(batchResults);

        // createBatchedResolution does not call resolveDependencies internally,
        // so we must do it here to maintain behavioral parity with resolveCollection()
        const depResult = options.includeDependencies
            ? await resolveDependencies(this.client, merged.resolved, options)
            : { resolved: [], conflicts: [], warnings: [], unresolved: [] };

        const mainIds = new Set(merged.resolved.map((r) => r.projectId));
        const dedupedDeps = depResult.resolved.filter((d) => !mainIds.has(d.projectId));

        return {
            resolved: merged.resolved,
            dependencies: dedupedDeps,
            conflicts: depResult.conflicts,
            warnings: [...merged.warnings, ...depResult.warnings],
            unresolved: [...merged.unresolved, ...depResult.unresolved]
        };
    }

    async probeAlternatives(request: ProbeAlternativesRequest): Promise<ProbeAlternativesResult> {
        const projectTypes = deserializeProjectTypes(request.projectTypes);

        return probeAlternativesFn(
            this.client,
            request.resolvedProjects,
            request.unresolvedProjectIds,
            request.gameVersion,
            request.loader,
            request.allGameVersions,
            request.excludeConfigs,
            projectTypes
        );
    }
}
