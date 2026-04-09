/**
 * Resilient cache service: tries the Durable Object first, falls back to
 * in-process resolution on any DO failure. Once the DO fails, all subsequent
 * calls in the same request go straight to in-process (no repeated DO attempts).
 */

import type { ModrinthClient } from '$lib/api/client';
import { logger, serializeError } from '$lib/server/logger';
import { InProcessResolutionCache } from './resolution-cache-fallback.server';
import type {
    ResolutionCacheService,
    ResolveRequest,
    ResolveResult,
    ProbeAlternativesRequest,
    ProbeAlternativesResult
} from './resolution-cache.types';

export class ResilientResolutionCacheService implements ResolutionCacheService {
    private doFailed = false;
    private fallback: InProcessResolutionCache;

    constructor(
        private primary: ResolutionCacheService,
        client: ModrinthClient
    ) {
        this.fallback = new InProcessResolutionCache(client);
    }

    async resolve(request: ResolveRequest): Promise<ResolveResult> {
        if (this.doFailed) return this.fallback.resolve(request);

        try {
            return await this.primary.resolve(request);
        } catch (e) {
            this.markFailed('resolve', e);
            return this.fallback.resolve(request);
        }
    }

    async probeAlternatives(request: ProbeAlternativesRequest): Promise<ProbeAlternativesResult> {
        if (this.doFailed) return this.fallback.probeAlternatives(request);

        try {
            return await this.primary.probeAlternatives(request);
        } catch (e) {
            this.markFailed('probeAlternatives', e);
            return this.fallback.probeAlternatives(request);
        }
    }

    private markFailed(method: string, error: unknown): void {
        this.doFailed = true;
        logger.warn('cache_do_fallback', { method, ...serializeError(error) });
    }
}
