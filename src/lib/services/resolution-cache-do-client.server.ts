/**
 * Thin wrapper that calls the ResolutionCache Durable Object via RPC.
 * Used when the RESOLUTION_CACHE binding is available (Cloudflare Workers).
 */

import { DO_RESOLVE_TIMEOUT_MS, DO_ADVISOR_TIMEOUT_MS } from '$lib/config/constants';
import type {
    ResolutionCacheService,
    ResolveRequest,
    ResolveResult,
    ProbeAlternativesRequest,
    ProbeAlternativesResult
} from './resolution-cache.types';
import type { ResolutionCache } from '$lib/server/resolution-cache-do';

export class DurableObjectResolutionCacheClient implements ResolutionCacheService {
    private stub: DurableObjectStub<ResolutionCache>;

    constructor(namespace: DurableObjectNamespace<ResolutionCache>) {
        this.stub = namespace.getByName('global');
    }

    async resolve(request: ResolveRequest): Promise<ResolveResult> {
        return Promise.race([
            this.stub.resolve(request),
            new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('DO resolve timed out')), DO_RESOLVE_TIMEOUT_MS)
            )
        ]);
    }

    async probeAlternatives(request: ProbeAlternativesRequest): Promise<ProbeAlternativesResult> {
        return Promise.race([
            this.stub.probeAlternatives(request),
            new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('DO advisor timed out')), DO_ADVISOR_TIMEOUT_MS)
            )
        ]);
    }
}
