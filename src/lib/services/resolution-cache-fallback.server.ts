/**
 * In-process fallback: wraps existing resolution pipeline behind the
 * ResolutionCacheService interface. Used when the DO binding is absent
 * (local dev, VPS, or DO failure).
 */

import type { ModrinthClient } from '$lib/api/client';
import { resolveCollection } from './resolution.server';
import { probeAlternatives as probeAlternativesFn } from './alternative-probe.server';
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

        const eligible = projects.filter((p) => !options.excludedProjectIds.has(p.id));
        const result = await resolveCollection(this.client, eligible, options);

        return {
            resolved: result.resolved,
            dependencies: result.dependencies,
            conflicts: result.conflicts,
            warnings: result.warnings,
            unresolved: result.unresolved
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
