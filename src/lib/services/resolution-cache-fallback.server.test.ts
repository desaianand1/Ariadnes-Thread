import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ModrinthProject, ModrinthGameVersion } from '$lib/api/types';
import type { ResolvedProject, ResolutionWarning, UnresolvedDependency } from './types';
import type { BatchResult } from './resolution.server';
import type {
    ResolveRequest,
    ProbeAlternativesRequest,
    SerializableResolutionOptions
} from './resolution-cache.types';

vi.mock('./resolution.server', () => ({
    createBatchedResolution: vi.fn(),
    mergeBatchResults: vi.fn()
}));

vi.mock('./dependency.server', () => ({
    resolveDependencies: vi.fn()
}));

vi.mock('./alternative-probe.server', () => ({
    probeAlternatives: vi.fn()
}));

import { InProcessResolutionCache } from './resolution-cache-fallback.server';
import { createBatchedResolution, mergeBatchResults } from './resolution.server';
import { resolveDependencies } from './dependency.server';
import { probeAlternatives } from './alternative-probe.server';
import type { ModrinthClient } from '$lib/api/client';

const mockClient = {} as ModrinthClient;
const mockedCreateBatchedResolution = vi.mocked(createBatchedResolution);
const mockedMergeBatchResults = vi.mocked(mergeBatchResults);
const mockedResolveDependencies = vi.mocked(resolveDependencies);
const mockedProbeAlternatives = vi.mocked(probeAlternatives);

function makeOptions(
    overrides: Partial<SerializableResolutionOptions> = {}
): SerializableResolutionOptions {
    return {
        gameVersion: '1.20.1',
        loader: 'fabric',
        includeDependencies: true,
        includeOptionalDeps: false,
        enableCrossLoaderFallback: false,
        allowAlphaBeta: false,
        excludedProjectIds: [],
        ...overrides
    };
}

function makeProject(overrides: Partial<ModrinthProject> = {}): ModrinthProject {
    return {
        id: 'proj1',
        slug: 'test-mod',
        project_type: 'mod',
        team: 'team1',
        title: 'Test Mod',
        description: 'A test mod',
        body: '',
        published: '2024-01-01T00:00:00Z',
        updated: '2024-01-01T00:00:00Z',
        status: 'approved',
        license: { id: 'MIT', name: 'MIT' },
        downloads: 1000,
        followers: 100,
        categories: [],
        game_versions: ['1.20.1'],
        loaders: ['fabric'],
        versions: ['v1'],
        client_side: 'required',
        server_side: 'required',
        ...overrides
    };
}

function makeResolved(overrides: Partial<ResolvedProject> = {}): ResolvedProject {
    return {
        projectId: 'proj1',
        projectSlug: 'test-mod',
        projectTitle: 'Test Mod',
        projectDescription: 'A test mod',
        projectType: 'mod',
        versionId: 'v1',
        versionNumber: '1.0.0',
        versionType: 'release',
        fileName: 'test-1.0.0.jar',
        fileUrl: 'https://cdn.modrinth.com/test.jar',
        fileSize: 1024,
        fileHashes: { sha1: 'abc123', sha512: 'def456' },
        loaders: ['fabric'],
        dependencyCount: 0,
        side: 'both',
        folder: 'mods',
        clientSide: 'required',
        serverSide: 'required',
        usedFallbackLoader: false,
        ...overrides
    };
}

function setupBatchedResolution(mergedResult: BatchResult) {
    const batchResults = [mergedResult];
    mockedCreateBatchedResolution.mockReturnValue({
        batchPromises: [Promise.resolve(mergedResult)],
        allBatches: Promise.resolve(batchResults)
    });
    mockedMergeBatchResults.mockReturnValue(mergedResult);
}

describe('InProcessResolutionCache', () => {
    let cache: InProcessResolutionCache;

    beforeEach(() => {
        vi.clearAllMocks();
        cache = new InProcessResolutionCache(mockClient);
    });

    describe('resolve', () => {
        it('uses batched resolution and merges results', async () => {
            const project = makeProject();
            const resolved = makeResolved();
            const merged: BatchResult = {
                resolved: [resolved],
                warnings: [],
                unresolved: []
            };
            setupBatchedResolution(merged);
            mockedResolveDependencies.mockResolvedValue({
                resolved: [],
                conflicts: [],
                warnings: [],
                unresolved: []
            });

            const request: ResolveRequest = {
                projects: [project],
                gameVersion: '1.20.1',
                loader: 'fabric',
                options: makeOptions()
            };

            const result = await cache.resolve(request);

            expect(mockedCreateBatchedResolution).toHaveBeenCalledOnce();
            expect(mockedMergeBatchResults).toHaveBeenCalledOnce();
            expect(result.resolved).toEqual([resolved]);
            expect(result.dependencies).toEqual([]);
        });

        it('passes full projects array to createBatchedResolution (filtering is internal)', async () => {
            const included = makeProject({ id: 'keep' });
            const excluded = makeProject({ id: 'drop' });
            setupBatchedResolution({
                resolved: [makeResolved({ projectId: 'keep' })],
                warnings: [],
                unresolved: []
            });
            mockedResolveDependencies.mockResolvedValue({
                resolved: [],
                conflicts: [],
                warnings: [],
                unresolved: []
            });

            const request: ResolveRequest = {
                projects: [included, excluded],
                gameVersion: '1.20.1',
                loader: 'fabric',
                options: makeOptions({ excludedProjectIds: ['drop'] })
            };

            await cache.resolve(request);

            const [client, projects, options, batchSize] =
                mockedCreateBatchedResolution.mock.calls[0];
            expect(client).toBe(mockClient);
            expect(projects).toEqual([included, excluded]);
            expect(options.excludedProjectIds).toBeInstanceOf(Set);
            expect(options.excludedProjectIds.has('drop')).toBe(true);
            expect(batchSize).toBe(50);
        });

        it('calls resolveDependencies when includeDependencies is true', async () => {
            const resolved = makeResolved();
            setupBatchedResolution({
                resolved: [resolved],
                warnings: [],
                unresolved: []
            });
            const depResolved = makeResolved({ projectId: 'dep1', projectSlug: 'dep-mod' });
            mockedResolveDependencies.mockResolvedValue({
                resolved: [depResolved],
                conflicts: [],
                warnings: [],
                unresolved: []
            });

            const request: ResolveRequest = {
                projects: [makeProject()],
                gameVersion: '1.20.1',
                loader: 'fabric',
                options: makeOptions({ includeDependencies: true })
            };

            const result = await cache.resolve(request);

            expect(mockedResolveDependencies).toHaveBeenCalledOnce();
            expect(result.dependencies).toEqual([depResolved]);
        });

        it('skips dependency resolution when includeDependencies is false', async () => {
            setupBatchedResolution({
                resolved: [makeResolved()],
                warnings: [],
                unresolved: []
            });

            const request: ResolveRequest = {
                projects: [makeProject()],
                gameVersion: '1.20.1',
                loader: 'fabric',
                options: makeOptions({ includeDependencies: false })
            };

            const result = await cache.resolve(request);

            expect(mockedResolveDependencies).not.toHaveBeenCalled();
            expect(result.dependencies).toEqual([]);
            expect(result.conflicts).toEqual([]);
        });

        it('deduplicates dependencies already in the main resolved set', async () => {
            const mainResolved = makeResolved({ projectId: 'proj1' });
            const depDuplicate = makeResolved({ projectId: 'proj1', versionId: 'v2' });
            const depNew = makeResolved({ projectId: 'dep-new' });

            setupBatchedResolution({
                resolved: [mainResolved],
                warnings: [],
                unresolved: []
            });
            mockedResolveDependencies.mockResolvedValue({
                resolved: [depDuplicate, depNew],
                conflicts: [],
                warnings: [],
                unresolved: []
            });

            const request: ResolveRequest = {
                projects: [makeProject()],
                gameVersion: '1.20.1',
                loader: 'fabric',
                options: makeOptions()
            };

            const result = await cache.resolve(request);

            expect(result.dependencies).toEqual([depNew]);
        });

        it('merges warnings and unresolved from both resolution and dependencies', async () => {
            const resWarning: ResolutionWarning = {
                type: 'no-compatible-version',
                projectId: 'w1',
                message: 'batch warning'
            };
            const depWarning: ResolutionWarning = {
                type: 'fallback-used',
                projectId: 'w2',
                message: 'dep warning'
            };
            const resUnresolved: UnresolvedDependency = {
                projectId: 'u1',
                requiredBy: 'collection',
                reason: 'not found'
            };
            const depUnresolved: UnresolvedDependency = {
                projectId: 'u2',
                requiredBy: 'proj1',
                reason: 'dep not found'
            };

            setupBatchedResolution({
                resolved: [makeResolved()],
                warnings: [resWarning],
                unresolved: [resUnresolved]
            });
            mockedResolveDependencies.mockResolvedValue({
                resolved: [],
                conflicts: [{ projectId: 'c1', conflictsWith: 'c2', declaredBy: 'proj1' }],
                warnings: [depWarning],
                unresolved: [depUnresolved]
            });

            const request: ResolveRequest = {
                projects: [makeProject()],
                gameVersion: '1.20.1',
                loader: 'fabric',
                options: makeOptions()
            };

            const result = await cache.resolve(request);

            expect(result.warnings).toEqual([resWarning, depWarning]);
            expect(result.unresolved).toEqual([resUnresolved, depUnresolved]);
            expect(result.conflicts).toEqual([
                { projectId: 'c1', conflictsWith: 'c2', declaredBy: 'proj1' }
            ]);
        });
    });

    describe('probeAlternatives', () => {
        it('delegates with deserialized projectTypes Map', async () => {
            const resolved = makeResolved();
            mockedProbeAlternatives.mockResolvedValue({
                alternatives: [],
                modAvailability: {}
            });

            const request: ProbeAlternativesRequest = {
                resolvedProjects: [resolved],
                unresolvedProjectIds: ['proj2'],
                gameVersion: '1.20.1',
                loader: 'fabric',
                allGameVersions: [] as ModrinthGameVersion[],
                projectTypes: { proj1: 'mod', proj2: 'resourcepack' }
            };

            await cache.probeAlternatives(request);

            expect(mockedProbeAlternatives).toHaveBeenCalledOnce();
            const args = mockedProbeAlternatives.mock.calls[0];
            const projectTypes = args[7];
            expect(projectTypes).toBeInstanceOf(Map);
            expect(projectTypes!.get('proj1')).toBe('mod');
            expect(projectTypes!.get('proj2')).toBe('resourcepack');
        });

        it('passes undefined projectTypes when not provided', async () => {
            mockedProbeAlternatives.mockResolvedValue({
                alternatives: [],
                modAvailability: {}
            });

            const request: ProbeAlternativesRequest = {
                resolvedProjects: [],
                unresolvedProjectIds: ['proj1'],
                gameVersion: '1.20.1',
                loader: 'fabric',
                allGameVersions: [] as ModrinthGameVersion[]
            };

            await cache.probeAlternatives(request);

            const args = mockedProbeAlternatives.mock.calls[0];
            expect(args[7]).toBeUndefined();
        });
    });
});
