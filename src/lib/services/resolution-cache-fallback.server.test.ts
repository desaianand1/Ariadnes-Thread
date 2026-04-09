import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ModrinthProject, ModrinthGameVersion } from '$lib/api/types';
import type { ResolvedProject, ResolutionResult } from './types';
import type {
    ResolveRequest,
    ProbeAlternativesRequest,
    SerializableResolutionOptions
} from './resolution-cache.types';

vi.mock('./resolution.server', () => ({
    resolveCollection: vi.fn()
}));

vi.mock('./alternative-probe.server', () => ({
    probeAlternatives: vi.fn()
}));

import { InProcessResolutionCache } from './resolution-cache-fallback.server';
import { resolveCollection } from './resolution.server';
import { probeAlternatives } from './alternative-probe.server';
import type { ModrinthClient } from '$lib/api/client';

const mockClient = {} as ModrinthClient;
const mockedResolveCollection = vi.mocked(resolveCollection);
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

describe('InProcessResolutionCache', () => {
    let cache: InProcessResolutionCache;

    beforeEach(() => {
        vi.clearAllMocks();
        cache = new InProcessResolutionCache(mockClient);
    });

    describe('resolve', () => {
        it('delegates to resolveCollection with deserialized options', async () => {
            const project = makeProject();
            const resolved = makeResolved();
            const mockResult: ResolutionResult = {
                resolved: [resolved],
                dependencies: [],
                conflicts: [],
                warnings: [],
                unresolved: [],
                stats: {
                    totalProjects: 1,
                    resolvedCount: 1,
                    unresolvedCount: 0,
                    dependencyCount: 0,
                    conflictCount: 0,
                    warningCount: 0,
                    totalDownloadSize: 0
                }
            };
            mockedResolveCollection.mockResolvedValue(mockResult);

            const request: ResolveRequest = {
                projects: [project],
                gameVersion: '1.20.1',
                loader: 'fabric',
                options: makeOptions()
            };

            const result = await cache.resolve(request);

            expect(mockedResolveCollection).toHaveBeenCalledOnce();
            const [client, projects, options] = mockedResolveCollection.mock.calls[0];
            expect(client).toBe(mockClient);
            expect(projects).toEqual([project]);
            expect(options.excludedProjectIds).toBeInstanceOf(Set);
            expect(result.resolved).toEqual([resolved]);
            expect(result.dependencies).toEqual([]);
        });

        it('filters out excluded projects before delegating', async () => {
            const included = makeProject({ id: 'keep' });
            const excluded = makeProject({ id: 'drop' });
            const mockResult: ResolutionResult = {
                resolved: [makeResolved({ projectId: 'keep' })],
                dependencies: [],
                conflicts: [],
                warnings: [],
                unresolved: [],
                stats: {
                    totalProjects: 1,
                    resolvedCount: 1,
                    unresolvedCount: 0,
                    dependencyCount: 0,
                    conflictCount: 0,
                    warningCount: 0,
                    totalDownloadSize: 0
                }
            };
            mockedResolveCollection.mockResolvedValue(mockResult);

            const request: ResolveRequest = {
                projects: [included, excluded],
                gameVersion: '1.20.1',
                loader: 'fabric',
                options: makeOptions({ excludedProjectIds: ['drop'] })
            };

            await cache.resolve(request);

            const [, projects] = mockedResolveCollection.mock.calls[0];
            expect(projects).toHaveLength(1);
            expect(projects[0].id).toBe('keep');
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
