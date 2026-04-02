import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ModrinthClient } from '$lib/api/client';
import type { ModrinthProject, ModrinthVersion } from '$lib/api/types';
import { resolveDependencies } from './dependency.server';
import type { ResolutionOptions, ResolvedProject } from './types';

function makeResolvedProject(overrides: Partial<ResolvedProject> = {}): ResolvedProject {
    return {
        projectId: 'proj1',
        projectSlug: 'test-mod',
        projectTitle: 'Test Mod',
        projectDescription: '',
        projectType: 'mod',
        loaders: ['fabric'],
        dependencyCount: 0,
        versionId: 'v1',
        versionNumber: '1.0.0',
        versionType: 'release',
        fileName: 'test.jar',
        fileUrl: 'https://cdn.modrinth.com/test.jar',
        fileSize: 1024,
        fileHashes: { sha1: 'abc', sha512: 'def' },
        side: 'both',
        folder: 'mods',
        clientSide: 'required',
        serverSide: 'required',
        usedFallbackLoader: false,
        ...overrides
    };
}

function makeVersion(overrides: Partial<ModrinthVersion> = {}): ModrinthVersion {
    return {
        id: 'v1',
        project_id: 'proj1',
        author_id: 'author1',
        featured: false,
        name: 'Version 1.0',
        version_number: '1.0.0',
        date_published: '2024-01-01T00:00:00Z',
        downloads: 500,
        version_type: 'release',
        status: 'listed',
        files: [
            {
                hashes: { sha1: 'abc', sha512: 'def' },
                url: 'https://cdn.modrinth.com/test.jar',
                filename: 'test.jar',
                primary: true,
                size: 1024
            }
        ],
        dependencies: [],
        game_versions: ['1.20.1'],
        loaders: ['fabric'],
        ...overrides
    };
}

function makeProject(overrides: Partial<ModrinthProject> = {}): ModrinthProject {
    return {
        id: 'dep1',
        slug: 'dep-mod',
        project_type: 'mod',
        team: 'team1',
        title: 'Dep Mod',
        description: 'A dependency',
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
        versions: ['vdep1'],
        client_side: 'required',
        server_side: 'required',
        ...overrides
    };
}

function makeOptions(overrides: Partial<ResolutionOptions> = {}): ResolutionOptions {
    return {
        gameVersion: '1.20.1',
        loader: 'fabric',
        includeDependencies: true,
        includeOptionalDeps: true,
        enableCrossLoaderFallback: false,
        allowAlphaBeta: false,
        excludedProjectIds: new Set(),
        ...overrides
    };
}

describe('resolveDependencies', () => {
    let client: ModrinthClient;

    beforeEach(() => {
        client = new ModrinthClient();
    });

    it('resolves no deps when versions have no dependencies', async () => {
        const resolved = [makeResolvedProject()];
        const parentVersion = makeVersion({ dependencies: [] });

        vi.spyOn(client, 'requestVersion').mockImplementation(async (endpoint) => {
            if (endpoint === 'versions') return [parentVersion];
            return [];
        });

        const result = await resolveDependencies(client, resolved, makeOptions());
        expect(result.resolved).toHaveLength(0);
        expect(result.conflicts).toHaveLength(0);
        expect(result.warnings).toHaveLength(0);
    });

    it('resolves a single required dependency', async () => {
        const resolved = [makeResolvedProject({ projectId: 'main', versionId: 'vmain' })];

        const parentVersion = makeVersion({
            id: 'vmain',
            project_id: 'main',
            dependencies: [{ project_id: 'dep1', dependency_type: 'required' }]
        });

        const depProject = makeProject({ id: 'dep1', title: 'Fabric API' });
        const depVersion = makeVersion({
            id: 'vdep1',
            project_id: 'dep1',
            dependencies: []
        });

        vi.spyOn(client, 'requestVersion').mockImplementation(async (endpoint, _v, opts) => {
            const pathParams = opts?.pathParams ?? [];
            const queryParams = opts?.queryParams ?? {};

            // Batch fetch initial versions
            if (endpoint === 'versions' && queryParams.ids) {
                const ids = JSON.parse(queryParams.ids);
                if (ids.includes('vmain')) return [parentVersion];
                if (ids.includes('vdep1')) return [depVersion];
                return [];
            }
            // Batch fetch projects
            if (endpoint === 'projects') return [depProject];
            // resolveVersion for unpinned dep
            if (endpoint === 'project' && pathParams[0] === 'dep1') return [depVersion];
            return [];
        });

        const result = await resolveDependencies(client, resolved, makeOptions());
        expect(result.resolved).toHaveLength(1);
        expect(result.resolved[0].projectId).toBe('dep1');
        expect(result.resolved[0].dependencyOf).toBe('main');
        expect(result.resolved[0].dependencyDepth).toBe(1);
    });

    it('skips embedded dependencies', async () => {
        const resolved = [makeResolvedProject({ projectId: 'main', versionId: 'vmain' })];

        const parentVersion = makeVersion({
            id: 'vmain',
            project_id: 'main',
            dependencies: [{ project_id: 'embedded1', dependency_type: 'embedded' }]
        });

        vi.spyOn(client, 'requestVersion').mockImplementation(async (endpoint, _v, opts) => {
            const queryParams = opts?.queryParams ?? {};
            if (endpoint === 'versions' && queryParams.ids) return [parentVersion];
            return [];
        });

        const result = await resolveDependencies(client, resolved, makeOptions());
        expect(result.resolved).toHaveLength(0);
    });

    it('registers incompatible deps as conflicts', async () => {
        const resolved = [
            makeResolvedProject({ projectId: 'main', versionId: 'vmain' }),
            makeResolvedProject({ projectId: 'conflicting', versionId: 'vconflict' })
        ];

        const parentVersion = makeVersion({
            id: 'vmain',
            project_id: 'main',
            dependencies: [{ project_id: 'conflicting', dependency_type: 'incompatible' }]
        });
        const conflictVersion = makeVersion({
            id: 'vconflict',
            project_id: 'conflicting',
            dependencies: []
        });

        vi.spyOn(client, 'requestVersion').mockImplementation(async (endpoint, _v, opts) => {
            const queryParams = opts?.queryParams ?? {};
            if (endpoint === 'versions' && queryParams.ids) {
                return [parentVersion, conflictVersion];
            }
            return [];
        });

        const result = await resolveDependencies(client, resolved, makeOptions());
        expect(result.conflicts).toHaveLength(1);
        expect(result.conflicts[0].projectId).toBe('conflicting');
        expect(result.conflicts[0].declaredBy).toBe('main');
    });

    it('skips optional deps when includeOptionalDeps is false', async () => {
        const resolved = [makeResolvedProject({ projectId: 'main', versionId: 'vmain' })];

        const parentVersion = makeVersion({
            id: 'vmain',
            project_id: 'main',
            dependencies: [{ project_id: 'opt1', dependency_type: 'optional' }]
        });

        vi.spyOn(client, 'requestVersion').mockImplementation(async (endpoint, _v, opts) => {
            const queryParams = opts?.queryParams ?? {};
            if (endpoint === 'versions' && queryParams.ids) return [parentVersion];
            return [];
        });

        const result = await resolveDependencies(
            client,
            resolved,
            makeOptions({
                includeOptionalDeps: false
            })
        );
        expect(result.resolved).toHaveLength(0);
    });

    it('detects cycles via visited set', async () => {
        // main depends on dep1, dep1 depends on main → cycle
        const resolved = [makeResolvedProject({ projectId: 'main', versionId: 'vmain' })];

        const parentVersion = makeVersion({
            id: 'vmain',
            project_id: 'main',
            dependencies: [{ project_id: 'dep1', dependency_type: 'required' }]
        });

        const depProject = makeProject({ id: 'dep1' });
        const depVersion = makeVersion({
            id: 'vdep1',
            project_id: 'dep1',
            dependencies: [{ project_id: 'main', dependency_type: 'required' }]
        });

        vi.spyOn(client, 'requestVersion').mockImplementation(async (endpoint, _v, opts) => {
            const pathParams = opts?.pathParams ?? [];
            const queryParams = opts?.queryParams ?? {};

            if (endpoint === 'versions' && queryParams.ids) {
                const ids = JSON.parse(queryParams.ids);
                const result: ModrinthVersion[] = [];
                if (ids.includes('vmain')) result.push(parentVersion);
                if (ids.includes('vdep1')) result.push(depVersion);
                return result;
            }
            if (endpoint === 'projects') return [depProject];
            if (endpoint === 'project' && pathParams[0] === 'dep1') return [depVersion];
            return [];
        });

        const result = await resolveDependencies(client, resolved, makeOptions());
        // dep1 is resolved, but 'main' (the cycle) is already visited so it's not re-queued
        expect(result.resolved).toHaveLength(1);
        expect(result.resolved[0].projectId).toBe('dep1');
    });

    it('skips deps for excluded project IDs', async () => {
        const resolved = [makeResolvedProject({ projectId: 'main', versionId: 'vmain' })];

        const parentVersion = makeVersion({
            id: 'vmain',
            project_id: 'main',
            dependencies: [{ project_id: 'excluded1', dependency_type: 'required' }]
        });

        vi.spyOn(client, 'requestVersion').mockImplementation(async (endpoint, _v, opts) => {
            const queryParams = opts?.queryParams ?? {};
            if (endpoint === 'versions' && queryParams.ids) return [parentVersion];
            return [];
        });

        const result = await resolveDependencies(
            client,
            resolved,
            makeOptions({
                excludedProjectIds: new Set(['excluded1'])
            })
        );
        expect(result.resolved).toHaveLength(0);
    });

    it('emits depth-exceeded warnings when chain exceeds MAX_DEPENDENCY_DEPTH', async () => {
        const resolved = [makeResolvedProject({ projectId: 'main', versionId: 'vmain' })];

        // Build a chain: main → dep-1 → dep-2 → ... → dep-12
        // MAX_DEPENDENCY_DEPTH is 10, so depths 1-10 resolve, depth 11+ warns
        const chainLength = 12;
        const versions: ModrinthVersion[] = [];
        const projects: ModrinthProject[] = [];

        for (let i = 0; i <= chainLength; i++) {
            const projectId = i === 0 ? 'main' : `dep-${i}`;
            const versionId = i === 0 ? 'vmain' : `vdep-${i}`;
            const nextProjectId = i < chainLength ? `dep-${i + 1}` : undefined;

            versions.push(
                makeVersion({
                    id: versionId,
                    project_id: projectId,
                    dependencies: nextProjectId
                        ? [{ project_id: nextProjectId, dependency_type: 'required' }]
                        : []
                })
            );

            if (i > 0) {
                projects.push(makeProject({ id: projectId, title: `Dep ${i}` }));
            }
        }

        vi.spyOn(client, 'requestVersion').mockImplementation(async (endpoint, _v, opts) => {
            const pathParams = opts?.pathParams ?? [];
            const queryParams = opts?.queryParams ?? {};

            if (endpoint === 'versions' && queryParams.ids) {
                const ids = JSON.parse(queryParams.ids);
                return versions.filter((v) => ids.includes(v.id));
            }
            if (endpoint === 'projects') {
                const ids = JSON.parse(queryParams.ids);
                return projects.filter((p) => ids.includes(p.id));
            }
            // resolveVersion for unpinned deps
            if (endpoint === 'project') {
                const projId = pathParams[0];
                const v = versions.find((ver) => ver.project_id === projId);
                return v ? [v] : [];
            }
            return [];
        });

        const result = await resolveDependencies(client, resolved, makeOptions());

        const depthWarnings = result.warnings.filter((w) => w.type === 'depth-exceeded');
        expect(depthWarnings.length).toBeGreaterThan(0);
        // Deps at depth 1-10 should be resolved, those beyond should not
        expect(result.resolved.length).toBeLessThanOrEqual(10);
    });

    it('resolves optional deps when includeOptionalDeps is true', async () => {
        const resolved = [makeResolvedProject({ projectId: 'main', versionId: 'vmain' })];

        const parentVersion = makeVersion({
            id: 'vmain',
            project_id: 'main',
            dependencies: [{ project_id: 'opt1', dependency_type: 'optional' }]
        });

        const optProject = makeProject({ id: 'opt1', title: 'Optional Mod' });
        const optVersion = makeVersion({
            id: 'vopt1',
            project_id: 'opt1',
            dependencies: []
        });

        vi.spyOn(client, 'requestVersion').mockImplementation(async (endpoint, _v, opts) => {
            const pathParams = opts?.pathParams ?? [];
            const queryParams = opts?.queryParams ?? {};

            if (endpoint === 'versions' && queryParams.ids) {
                const ids = JSON.parse(queryParams.ids);
                const result: ModrinthVersion[] = [];
                if (ids.includes('vmain')) result.push(parentVersion);
                if (ids.includes('vopt1')) result.push(optVersion);
                return result;
            }
            if (endpoint === 'projects') return [optProject];
            if (endpoint === 'project' && pathParams[0] === 'opt1') return [optVersion];
            return [];
        });

        const result = await resolveDependencies(
            client,
            resolved,
            makeOptions({ includeOptionalDeps: true })
        );
        expect(result.resolved).toHaveLength(1);
        expect(result.resolved[0].projectId).toBe('opt1');
    });

    it('handles three-node cycle: A → B → C → A', async () => {
        const resolved = [makeResolvedProject({ projectId: 'A', versionId: 'vA' })];

        const vA = makeVersion({
            id: 'vA',
            project_id: 'A',
            dependencies: [{ project_id: 'B', dependency_type: 'required' }]
        });
        const vB = makeVersion({
            id: 'vB',
            project_id: 'B',
            dependencies: [{ project_id: 'C', dependency_type: 'required' }]
        });
        const vC = makeVersion({
            id: 'vC',
            project_id: 'C',
            dependencies: [{ project_id: 'A', dependency_type: 'required' }]
        });

        const projB = makeProject({ id: 'B', slug: 'mod-b', title: 'Mod B' });
        const projC = makeProject({ id: 'C', slug: 'mod-c', title: 'Mod C' });

        vi.spyOn(client, 'requestVersion').mockImplementation(async (endpoint, _v, opts) => {
            const pathParams = opts?.pathParams ?? [];
            const queryParams = opts?.queryParams ?? {};

            if (endpoint === 'versions' && queryParams.ids) {
                const ids = JSON.parse(queryParams.ids);
                const all = [vA, vB, vC];
                return all.filter((v) => ids.includes(v.id));
            }
            if (endpoint === 'projects') {
                const ids = JSON.parse(queryParams.ids);
                return [projB, projC].filter((p) => ids.includes(p.id));
            }
            if (endpoint === 'project' && pathParams[0] === 'B') return [vB];
            if (endpoint === 'project' && pathParams[0] === 'C') return [vC];
            return [];
        });

        const result = await resolveDependencies(client, resolved, makeOptions());
        // B and C resolve; A is already visited so the cycle is broken
        expect(result.resolved).toHaveLength(2);
        const resolvedIds = result.resolved.map((r) => r.projectId).sort();
        expect(resolvedIds).toEqual(['B', 'C']);
    });

    it('deduplicates multiple deps pointing to same project at same depth', async () => {
        // Both mod-a and mod-b depend on the same dep
        const resolved = [
            makeResolvedProject({ projectId: 'mod-a', versionId: 'va' }),
            makeResolvedProject({ projectId: 'mod-b', versionId: 'vb' })
        ];

        const va = makeVersion({
            id: 'va',
            project_id: 'mod-a',
            dependencies: [{ project_id: 'shared-dep', dependency_type: 'required' }]
        });
        const vb = makeVersion({
            id: 'vb',
            project_id: 'mod-b',
            dependencies: [{ project_id: 'shared-dep', dependency_type: 'required' }]
        });
        const depProject = makeProject({ id: 'shared-dep', title: 'Shared Dep' });
        const depVersion = makeVersion({
            id: 'vdep',
            project_id: 'shared-dep',
            dependencies: []
        });

        vi.spyOn(client, 'requestVersion').mockImplementation(async (endpoint, _v, opts) => {
            const pathParams = opts?.pathParams ?? [];
            const queryParams = opts?.queryParams ?? {};

            if (endpoint === 'versions' && queryParams.ids) {
                const ids = JSON.parse(queryParams.ids);
                return [va, vb, depVersion].filter((v) => ids.includes(v.id));
            }
            if (endpoint === 'projects') return [depProject];
            if (endpoint === 'project' && pathParams[0] === 'shared-dep') return [depVersion];
            return [];
        });

        const result = await resolveDependencies(client, resolved, makeOptions());
        // shared-dep should only appear once despite being required by both mods
        expect(result.resolved).toHaveLength(1);
        expect(result.resolved[0].projectId).toBe('shared-dep');
    });

    it('does not create conflict for incompatible dep NOT in resolved set', async () => {
        const resolved = [makeResolvedProject({ projectId: 'main', versionId: 'vmain' })];

        const parentVersion = makeVersion({
            id: 'vmain',
            project_id: 'main',
            dependencies: [{ project_id: 'absent-mod', dependency_type: 'incompatible' }]
        });

        vi.spyOn(client, 'requestVersion').mockImplementation(async (endpoint, _v, opts) => {
            const queryParams = opts?.queryParams ?? {};
            if (endpoint === 'versions' && queryParams.ids) return [parentVersion];
            return [];
        });

        const result = await resolveDependencies(client, resolved, makeOptions());
        expect(result.conflicts).toHaveLength(0);
    });

    it('resolves pinned dependencies by version_id', async () => {
        const resolved = [makeResolvedProject({ projectId: 'main', versionId: 'vmain' })];

        const parentVersion = makeVersion({
            id: 'vmain',
            project_id: 'main',
            dependencies: [
                { project_id: 'dep1', version_id: 'vdep-pinned', dependency_type: 'required' }
            ]
        });

        const depProject = makeProject({ id: 'dep1' });
        const depVersion = makeVersion({
            id: 'vdep-pinned',
            project_id: 'dep1',
            dependencies: []
        });

        vi.spyOn(client, 'requestVersion').mockImplementation(async (endpoint, _v, opts) => {
            const queryParams = opts?.queryParams ?? {};

            if (endpoint === 'versions' && queryParams.ids) {
                const ids = JSON.parse(queryParams.ids);
                const result: ModrinthVersion[] = [];
                if (ids.includes('vmain')) result.push(parentVersion);
                if (ids.includes('vdep-pinned')) result.push(depVersion);
                return result;
            }
            if (endpoint === 'projects') return [depProject];
            return [];
        });

        const result = await resolveDependencies(client, resolved, makeOptions());
        expect(result.resolved).toHaveLength(1);
        expect(result.resolved[0].versionId).toBe('vdep-pinned');
    });
});
