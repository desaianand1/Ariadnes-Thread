import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type {
    ResolveRequest,
    ProbeAlternativesRequest,
    SerializableResolutionOptions
} from './resolution-cache.types';
import type { ModrinthGameVersion } from '$lib/api/types';
import type { ResolutionCache } from '$lib/server/resolution-cache-do';

function makeOptions(): SerializableResolutionOptions {
    return {
        gameVersion: '1.20.1',
        loader: 'fabric',
        includeDependencies: true,
        includeOptionalDeps: false,
        enableCrossLoaderFallback: false,
        allowAlphaBeta: false,
        excludedProjectIds: []
    };
}

describe('DurableObjectResolutionCacheClient', () => {
    let DurableObjectResolutionCacheClient: typeof import('./resolution-cache-do-client.server').DurableObjectResolutionCacheClient;

    const mockResolve = vi.fn();
    const mockProbeAlternatives = vi.fn();
    const mockStub = {
        resolve: mockResolve,
        probeAlternatives: mockProbeAlternatives
    };
    const mockNamespace = {
        getByName: vi.fn().mockReturnValue(mockStub)
    } as unknown as DurableObjectNamespace<ResolutionCache>;

    beforeEach(async () => {
        vi.useFakeTimers();
        vi.clearAllMocks();
        // Dynamic import to pick up fresh module state
        const mod = await import('./resolution-cache-do-client.server');
        DurableObjectResolutionCacheClient = mod.DurableObjectResolutionCacheClient;
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('resolve', () => {
        it('returns stub result when it resolves before timeout', async () => {
            const expected = {
                resolved: [],
                dependencies: [],
                conflicts: [],
                warnings: [],
                unresolved: []
            };
            mockResolve.mockResolvedValue(expected);

            const client = new DurableObjectResolutionCacheClient(mockNamespace);
            const request: ResolveRequest = {
                projects: [],
                gameVersion: '1.20.1',
                loader: 'fabric',
                options: makeOptions()
            };

            const result = await client.resolve(request);

            expect(result).toEqual(expected);
            expect(mockNamespace.getByName).toHaveBeenCalledWith('global');
        });

        it('rejects with timeout error when stub hangs', async () => {
            mockResolve.mockImplementation(() => new Promise(() => {}));

            const client = new DurableObjectResolutionCacheClient(mockNamespace);
            const request: ResolveRequest = {
                projects: [],
                gameVersion: '1.20.1',
                loader: 'fabric',
                options: makeOptions()
            };

            const promise = client.resolve(request);
            vi.advanceTimersByTime(30_000);

            await expect(promise).rejects.toThrow('DO resolve timed out');
        });
    });

    describe('probeAlternatives', () => {
        it('returns stub result on success', async () => {
            const expected = { alternatives: [], modAvailability: {} };
            mockProbeAlternatives.mockResolvedValue(expected);

            const client = new DurableObjectResolutionCacheClient(mockNamespace);
            const request: ProbeAlternativesRequest = {
                resolvedProjects: [],
                unresolvedProjectIds: [],
                gameVersion: '1.20.1',
                loader: 'fabric',
                allGameVersions: [] as ModrinthGameVersion[]
            };

            const result = await client.probeAlternatives(request);

            expect(result).toEqual(expected);
        });

        it('rejects with timeout error when stub hangs', async () => {
            mockProbeAlternatives.mockImplementation(() => new Promise(() => {}));

            const client = new DurableObjectResolutionCacheClient(mockNamespace);
            const request: ProbeAlternativesRequest = {
                resolvedProjects: [],
                unresolvedProjectIds: [],
                gameVersion: '1.20.1',
                loader: 'fabric',
                allGameVersions: [] as ModrinthGameVersion[]
            };

            const promise = client.probeAlternatives(request);
            vi.advanceTimersByTime(125_000);

            await expect(promise).rejects.toThrow('DO advisor timed out');
        });
    });
});
