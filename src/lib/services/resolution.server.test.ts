import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ModrinthClient } from '$lib/api/client';
import type { ModrinthProject, ModrinthVersion } from '$lib/api/types';
import {
    resolveVersion,
    resolveCollection,
    resolveBatch,
    createBatchedResolution,
    mergeBatchResults,
    getMinorVersionFamily,
    patchDistance,
    type BatchResult
} from './resolution.server';
import type { ResolutionOptions, ResolvedProject } from './types';
import { RATE_LIMIT_SAFETY_MARGIN } from '$lib/config/constants';

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
                hashes: { sha1: 'abc123', sha512: 'def456' },
                url: 'https://cdn.modrinth.com/test.jar',
                filename: 'test-1.0.0.jar',
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

describe('resolveVersion', () => {
    let client: ModrinthClient;

    beforeEach(() => {
        client = new ModrinthClient();
    });

    it('resolves a simple mod version', async () => {
        const project = makeProject();
        const version = makeVersion();

        vi.spyOn(client, 'requestVersion').mockResolvedValueOnce([version]);

        const result = await resolveVersion(client, project, makeOptions());
        expect(result).not.toBeNull();
        expect(result!.resolved.projectId).toBe('proj1');
        expect(result!.resolved.versionId).toBe('v1');
        expect(result!.resolved.fileName).toBe('test-1.0.0.jar');
        expect(result!.resolved.side).toBe('both');
        expect(result!.resolved.folder).toBe('mods');
        expect(result!.resolved.usedFallbackLoader).toBe(false);
        expect(result!.warnings).toHaveLength(0);
    });

    it('populates Tier 2/3 metadata fields from project and version', async () => {
        const project = makeProject({
            categories: ['adventure', 'utility'],
            downloads: 50_000,
            license: { id: 'MIT', name: 'MIT' },
            gallery: [
                {
                    url: 'https://cdn.modrinth.com/gallery.png',
                    featured: true,
                    title: 'Screenshot',
                    description: 'A screenshot',
                    created: '2024-01-01T00:00:00Z',
                    ordering: 0
                }
            ]
        });
        const version = makeVersion({
            changelog: '## Changes\n- Fixed a bug',
            date_published: '2024-06-15T12:00:00Z'
        });

        vi.spyOn(client, 'requestVersion').mockResolvedValueOnce([version]);

        const result = await resolveVersion(client, project, makeOptions());
        expect(result).not.toBeNull();
        const r = result!.resolved;

        // Tier 2
        expect(r.categories).toEqual(['adventure', 'utility']);
        expect(r.downloadCount).toBe(50_000);
        expect(r.licenseName).toBe('MIT');
        expect(r.lastUpdated).toBe('2024-06-15T12:00:00Z');

        // Tier 3
        expect(r.changelog).toBe('## Changes\n- Fixed a bug');
        expect(r.gallery).toHaveLength(1);
        expect(r.gallery![0].url).toBe('https://cdn.modrinth.com/gallery.png');
        expect(r.gallery![0].featured).toBe(true);
    });

    it('returns null when no versions match', async () => {
        vi.spyOn(client, 'requestVersion').mockResolvedValueOnce([]);

        const result = await resolveVersion(client, makeProject(), makeOptions());
        expect(result).toBeNull();
    });

    it('prefers release over beta/alpha', async () => {
        const beta = makeVersion({
            id: 'vbeta',
            version_type: 'beta',
            version_number: '2.0.0-beta'
        });
        const release = makeVersion({
            id: 'vrel',
            version_type: 'release',
            version_number: '1.0.0'
        });

        vi.spyOn(client, 'requestVersion').mockResolvedValueOnce([beta, release]);

        const result = await resolveVersion(client, makeProject(), makeOptions());
        expect(result!.resolved.versionId).toBe('vrel');
    });

    it('prefers featured versions within same type', async () => {
        const notFeatured = makeVersion({
            id: 'v1',
            featured: false,
            date_published: '2024-06-01T00:00:00Z'
        });
        const featured = makeVersion({
            id: 'v2',
            featured: true,
            date_published: '2024-01-01T00:00:00Z'
        });

        vi.spyOn(client, 'requestVersion').mockResolvedValueOnce([notFeatured, featured]);

        const result = await resolveVersion(client, makeProject(), makeOptions());
        expect(result!.resolved.versionId).toBe('v2');
    });

    it('prefers newer versions within same type and featured status', async () => {
        const older = makeVersion({ id: 'v1', date_published: '2024-01-01T00:00:00Z' });
        const newer = makeVersion({ id: 'v2', date_published: '2024-06-01T00:00:00Z' });

        vi.spyOn(client, 'requestVersion').mockResolvedValueOnce([older, newer]);

        const result = await resolveVersion(client, makeProject(), makeOptions());
        expect(result!.resolved.versionId).toBe('v2');
    });

    it('falls back to beta with warning when no release exists and allowAlphaBeta=false', async () => {
        const beta = makeVersion({ id: 'vbeta', version_type: 'beta' });

        vi.spyOn(client, 'requestVersion').mockResolvedValueOnce([beta]);

        const result = await resolveVersion(
            client,
            makeProject(),
            makeOptions({ allowAlphaBeta: false })
        );
        expect(result!.resolved.versionId).toBe('vbeta');
        expect(result!.warnings).toHaveLength(1);
        expect(result!.warnings[0].type).toBe('alpha-beta-version');
    });

    it('allows alpha/beta versions when allowAlphaBeta=true', async () => {
        const alpha = makeVersion({ id: 'valpha', version_type: 'alpha' });
        const release = makeVersion({ id: 'vrel', version_type: 'release' });

        vi.spyOn(client, 'requestVersion').mockResolvedValueOnce([alpha, release]);

        const result = await resolveVersion(
            client,
            makeProject(),
            makeOptions({ allowAlphaBeta: true })
        );
        // release still sorts first
        expect(result!.resolved.versionId).toBe('vrel');
        expect(result!.warnings).toHaveLength(0);
    });

    it('detects fallback loader usage (quilt→fabric)', async () => {
        const fabricVersion = makeVersion({ loaders: ['fabric'] });

        vi.spyOn(client, 'requestVersion').mockResolvedValueOnce([fabricVersion]);

        const result = await resolveVersion(
            client,
            makeProject({ loaders: ['fabric'] }),
            makeOptions({ loader: 'quilt', enableCrossLoaderFallback: true })
        );
        expect(result!.resolved.usedFallbackLoader).toBe(true);
        expect(result!.resolved.resolvedLoader).toBe('fabric');
        expect(result!.warnings.some((w) => w.type === 'fallback-used')).toBe(true);
    });

    it('omits loader filter for resourcepacks', async () => {
        const version = makeVersion({ loaders: [] });
        const spy = vi.spyOn(client, 'requestVersion').mockResolvedValueOnce([version]);

        const project = makeProject({ project_type: 'resourcepack' });
        await resolveVersion(client, project, makeOptions());

        const call = spy.mock.calls[0];
        const queryParams = (call[2] as { queryParams: Record<string, string> }).queryParams;
        expect(queryParams.loaders).toBeUndefined();
    });

    it('selects non-primary file when no file is marked primary', async () => {
        const version = makeVersion({
            files: [
                {
                    hashes: { sha1: 'a', sha512: 'b' },
                    url: 'https://cdn.modrinth.com/fallback.jar',
                    filename: 'fallback.jar',
                    primary: false,
                    size: 512
                }
            ]
        });

        vi.spyOn(client, 'requestVersion').mockResolvedValueOnce([version]);

        const result = await resolveVersion(client, makeProject(), makeOptions());
        expect(result!.resolved.fileName).toBe('fallback.jar');
    });

    it('classifies client-only mods correctly', async () => {
        const version = makeVersion();
        vi.spyOn(client, 'requestVersion').mockResolvedValueOnce([version]);

        const project = makeProject({ client_side: 'required', server_side: 'unsupported' });
        const result = await resolveVersion(client, project, makeOptions());
        expect(result!.resolved.side).toBe('client');
    });

    it('classifies server-only mods correctly', async () => {
        const version = makeVersion();
        vi.spyOn(client, 'requestVersion').mockResolvedValueOnce([version]);

        const project = makeProject({ client_side: 'unsupported', server_side: 'required' });
        const result = await resolveVersion(client, project, makeOptions());
        expect(result!.resolved.side).toBe('server');
    });

    it('returns null when version has empty files array', async () => {
        const version = makeVersion({ files: [] });
        vi.spyOn(client, 'requestVersion').mockResolvedValueOnce([version]);

        const result = await resolveVersion(client, makeProject(), makeOptions());
        expect(result).toBeNull();
    });

    it('ranks alpha below beta when both are present', async () => {
        const alpha = makeVersion({
            id: 'valpha',
            version_type: 'alpha',
            date_published: '2024-06-01T00:00:00Z'
        });
        const beta = makeVersion({
            id: 'vbeta',
            version_type: 'beta',
            date_published: '2024-01-01T00:00:00Z'
        });

        vi.spyOn(client, 'requestVersion').mockResolvedValueOnce([alpha, beta]);

        const result = await resolveVersion(
            client,
            makeProject(),
            makeOptions({ allowAlphaBeta: true })
        );
        expect(result!.resolved.versionId).toBe('vbeta');
    });

    it('still prefers release by type rank even when alpha is newer with allowAlphaBeta', async () => {
        const alpha = makeVersion({
            id: 'valpha',
            version_type: 'alpha',
            featured: true,
            date_published: '2025-01-01T00:00:00Z'
        });
        const release = makeVersion({
            id: 'vrel',
            version_type: 'release',
            featured: false,
            date_published: '2024-01-01T00:00:00Z'
        });

        vi.spyOn(client, 'requestVersion').mockResolvedValueOnce([alpha, release]);

        const result = await resolveVersion(
            client,
            makeProject(),
            makeOptions({ allowAlphaBeta: true })
        );
        expect(result!.resolved.versionId).toBe('vrel');
    });

    it('omits loader filter for shaders and datapacks', async () => {
        const version = makeVersion({ loaders: [] });

        for (const projectType of ['shader', 'datapack'] as const) {
            const spy = vi.spyOn(client, 'requestVersion').mockResolvedValueOnce([version]);

            const project = makeProject({ project_type: projectType });
            await resolveVersion(client, project, makeOptions());

            const call = spy.mock.calls[0];
            const queryParams = (call[2] as { queryParams: Record<string, string> }).queryParams;
            expect(queryParams.loaders).toBeUndefined();

            spy.mockRestore();
        }
    });
});

describe('resolveCollection', () => {
    let client: ModrinthClient;

    beforeEach(() => {
        client = new ModrinthClient();
    });

    it('resolves multiple projects and computes stats', async () => {
        const p1 = makeProject({ id: 'p1', slug: 'mod-a', title: 'Mod A' });
        const p2 = makeProject({ id: 'p2', slug: 'mod-b', title: 'Mod B' });

        const v1 = makeVersion({ id: 'v1', project_id: 'p1' });
        const v2 = makeVersion({ id: 'v2', project_id: 'p2' });

        vi.spyOn(client, 'requestVersion').mockImplementation(async (endpoint, _version, opts) => {
            const pathParams = opts?.pathParams ?? [];
            if (endpoint === 'project' && pathParams[0] === 'p1') return [v1];
            if (endpoint === 'project' && pathParams[0] === 'p2') return [v2];
            // dependency resolution batch-fetches versions — return empty
            if (endpoint === 'versions') return [];
            return [];
        });

        const result = await resolveCollection(client, [p1, p2], makeOptions());
        expect(result.resolved).toHaveLength(2);
        expect(result.stats.totalProjects).toBe(2);
        expect(result.stats.resolvedCount).toBe(2);
        expect(result.stats.totalDownloadSize).toBe(2048);
    });

    it('excludes projects in excludedProjectIds', async () => {
        const p1 = makeProject({ id: 'p1' });
        const p2 = makeProject({ id: 'p2' });

        const v1 = makeVersion({ id: 'v1', project_id: 'p1' });

        vi.spyOn(client, 'requestVersion').mockImplementation(async (endpoint, _version, opts) => {
            const pathParams = opts?.pathParams ?? [];
            if (endpoint === 'project' && pathParams[0] === 'p1') return [v1];
            if (endpoint === 'versions') return [];
            return [];
        });

        const result = await resolveCollection(
            client,
            [p1, p2],
            makeOptions({
                excludedProjectIds: new Set(['p2'])
            })
        );
        expect(result.resolved).toHaveLength(1);
        expect(result.stats.totalProjects).toBe(1);
    });

    it('records unresolved projects with warnings', async () => {
        const project = makeProject({ id: 'p1', title: 'Missing Mod' });

        vi.spyOn(client, 'requestVersion').mockResolvedValue([]);

        const result = await resolveCollection(client, [project], makeOptions());
        expect(result.resolved).toHaveLength(0);
        expect(result.unresolved).toHaveLength(1);
        expect(result.warnings.some((w) => w.type === 'no-compatible-version')).toBe(true);
    });

    it('still resolves other projects when one throws', async () => {
        const p1 = makeProject({ id: 'p1', slug: 'mod-a', title: 'Mod A' });
        const p2 = makeProject({ id: 'p2', slug: 'mod-b', title: 'Mod B' });

        const v2 = makeVersion({ id: 'v2', project_id: 'p2' });

        vi.spyOn(client, 'requestVersion').mockImplementation(async (endpoint, _version, opts) => {
            const pathParams = opts?.pathParams ?? [];
            if (endpoint === 'project' && pathParams[0] === 'p1') throw new Error('API timeout');
            if (endpoint === 'project' && pathParams[0] === 'p2') return [v2];
            if (endpoint === 'versions') return [];
            return [];
        });

        const result = await resolveCollection(client, [p1, p2], makeOptions());
        expect(result.resolved).toHaveLength(1);
        expect(result.resolved[0].projectId).toBe('p2');
        expect(result.unresolved).toHaveLength(1);
        expect(result.unresolved[0].projectId).toBe('p1');
    });

    it('returns zeroed stats for empty projects array', async () => {
        const result = await resolveCollection(client, [], makeOptions());
        expect(result.resolved).toHaveLength(0);
        expect(result.dependencies).toHaveLength(0);
        expect(result.stats.totalProjects).toBe(0);
        expect(result.stats.resolvedCount).toBe(0);
        expect(result.stats.totalDownloadSize).toBe(0);
    });

    it('skips dependency resolution when includeDependencies is false', async () => {
        const p1 = makeProject({ id: 'p1' });
        const v1 = makeVersion({
            id: 'v1',
            project_id: 'p1',
            dependencies: [{ project_id: 'dep1', dependency_type: 'required' }]
        });

        const spy = vi
            .spyOn(client, 'requestVersion')
            .mockImplementation(async (endpoint, _version, opts) => {
                const pathParams = opts?.pathParams ?? [];
                if (endpoint === 'project' && pathParams[0] === 'p1') return [v1];
                if (endpoint === 'versions') return [];
                return [];
            });

        const result = await resolveCollection(
            client,
            [p1],
            makeOptions({ includeDependencies: false })
        );
        expect(result.resolved).toHaveLength(1);
        expect(result.dependencies).toHaveLength(0);

        // Should never batch-fetch versions for dependency resolution
        const versionsBatchCalls = spy.mock.calls.filter((c) => c[0] === 'versions');
        expect(versionsBatchCalls).toHaveLength(0);
    });
});

// =============================================================================
// resolveBatch
// =============================================================================

describe('resolveBatch', () => {
    let client: ModrinthClient;

    beforeEach(() => {
        client = new ModrinthClient();
    });

    it('resolves a batch of projects and returns results', async () => {
        const p1 = makeProject({ id: 'p1', title: 'Mod A' });
        const p2 = makeProject({ id: 'p2', title: 'Mod B' });
        const v1 = makeVersion({ id: 'v1', project_id: 'p1' });
        const v2 = makeVersion({ id: 'v2', project_id: 'p2' });

        vi.spyOn(client, 'requestVersion').mockImplementation(async (_ep, _ver, opts) => {
            const pathParams = opts?.pathParams ?? [];
            if (pathParams[0] === 'p1') return [v1];
            if (pathParams[0] === 'p2') return [v2];
            return [];
        });

        const result = await resolveBatch(client, [p1, p2], makeOptions());

        expect(result.resolved).toHaveLength(2);
        expect(result.warnings).toHaveLength(0);
        expect(result.unresolved).toHaveLength(0);
    });

    it('returns empty results for empty input', async () => {
        const result = await resolveBatch(client, [], makeOptions());

        expect(result.resolved).toHaveLength(0);
        expect(result.warnings).toHaveLength(0);
        expect(result.unresolved).toHaveLength(0);
    });

    it('records unresolved projects when versions return empty', async () => {
        const p1 = makeProject({ id: 'p1', title: 'Missing Mod' });

        vi.spyOn(client, 'requestVersion').mockResolvedValue([]);

        const result = await resolveBatch(client, [p1], makeOptions());

        expect(result.resolved).toHaveLength(0);
        expect(result.unresolved).toHaveLength(1);
        expect(result.unresolved[0].projectId).toBe('p1');
        expect(result.warnings.some((w) => w.type === 'no-compatible-version')).toBe(true);
    });

    it('handles partial failures — resolves some while recording others as unresolved', async () => {
        const p1 = makeProject({ id: 'p1', title: 'Good Mod' });
        const p2 = makeProject({ id: 'p2', title: 'Bad Mod' });
        const v1 = makeVersion({ id: 'v1', project_id: 'p1' });

        vi.spyOn(client, 'requestVersion').mockImplementation(async (_ep, _ver, opts) => {
            const pathParams = opts?.pathParams ?? [];
            if (pathParams[0] === 'p1') return [v1];
            if (pathParams[0] === 'p2') throw new Error('Network error');
            return [];
        });

        const result = await resolveBatch(client, [p1, p2], makeOptions());

        expect(result.resolved).toHaveLength(1);
        expect(result.resolved[0].projectId).toBe('p1');
        expect(result.unresolved).toHaveLength(1);
        expect(result.unresolved[0].projectId).toBe('p2');
    });

    it('clears timeout even when resolution throws', async () => {
        const p1 = makeProject({ id: 'p1', title: 'Error Mod' });

        vi.spyOn(client, 'requestVersion').mockRejectedValue(new Error('API down'));

        // Should not throw — allSettled catches individual rejections
        const result = await resolveBatch(client, [p1], makeOptions());

        expect(result.resolved).toHaveLength(0);
        expect(result.unresolved).toHaveLength(1);
    });
});

// =============================================================================
// createBatchedResolution
// =============================================================================

describe('createBatchedResolution', () => {
    let client: ModrinthClient;

    beforeEach(() => {
        client = new ModrinthClient();
    });

    it('creates a single batch when projects fit within batch size', () => {
        const projects = [makeProject({ id: 'p1' }), makeProject({ id: 'p2' })];

        vi.spyOn(client, 'requestVersion').mockResolvedValue([makeVersion()]);
        vi.spyOn(client, 'getRateLimitState').mockReturnValue({ remaining: 300, resetAt: 0 });

        const { batchPromises } = createBatchedResolution(client, projects, makeOptions(), 10);

        expect(batchPromises).toHaveLength(1);
    });

    it('creates multiple batches when projects exceed batch size', () => {
        const projects = Array.from({ length: 5 }, (_, i) =>
            makeProject({ id: `p${i}`, title: `Mod ${i}` })
        );

        vi.spyOn(client, 'requestVersion').mockResolvedValue([makeVersion()]);
        vi.spyOn(client, 'getRateLimitState').mockReturnValue({ remaining: 300, resetAt: 0 });

        const { batchPromises } = createBatchedResolution(client, projects, makeOptions(), 2);

        expect(batchPromises).toHaveLength(3);
    });

    it('filters out excluded projects before batching', () => {
        const projects = [
            makeProject({ id: 'p1' }),
            makeProject({ id: 'p2' }),
            makeProject({ id: 'p3' })
        ];

        vi.spyOn(client, 'requestVersion').mockResolvedValue([makeVersion()]);
        vi.spyOn(client, 'getRateLimitState').mockReturnValue({ remaining: 300, resetAt: 0 });

        const { batchPromises } = createBatchedResolution(
            client,
            projects,
            makeOptions({ excludedProjectIds: new Set(['p2']) }),
            10
        );

        // 2 eligible projects fit in 1 batch
        expect(batchPromises).toHaveLength(1);
    });

    it('resolves all batches via allBatches promise', async () => {
        const projects = [
            makeProject({ id: 'p1', title: 'Mod 1' }),
            makeProject({ id: 'p2', title: 'Mod 2' }),
            makeProject({ id: 'p3', title: 'Mod 3' })
        ];

        vi.spyOn(client, 'requestVersion').mockImplementation(async (_ep, _ver, opts) => {
            const pathParams = opts?.pathParams ?? [];
            return [makeVersion({ id: `v-${pathParams[0]}`, project_id: pathParams[0] as string })];
        });
        vi.spyOn(client, 'getRateLimitState').mockReturnValue({ remaining: 300, resetAt: 0 });

        const { allBatches } = createBatchedResolution(client, projects, makeOptions(), 2);
        const results = await allBatches;

        expect(results).toHaveLength(2);
        const totalResolved = results.reduce((sum, b) => sum + b.resolved.length, 0);
        expect(totalResolved).toBe(3);
    });

    it('returns empty batches for empty input', () => {
        vi.spyOn(client, 'getRateLimitState').mockReturnValue({ remaining: 300, resetAt: 0 });

        const { batchPromises } = createBatchedResolution(client, [], makeOptions(), 10);

        expect(batchPromises).toHaveLength(0);
    });

    it('subsequent batches still resolve when an earlier batch fails', async () => {
        const projects = [
            makeProject({ id: 'p1', title: 'Mod 1' }),
            makeProject({ id: 'p2', title: 'Mod 2' }),
            makeProject({ id: 'p3', title: 'Mod 3' })
        ];

        vi.spyOn(client, 'requestVersion').mockImplementation(async (_ep, _ver, opts) => {
            const pathParams = opts?.pathParams ?? [];
            // First batch (p1) throws; second batch (p2, p3) should still resolve
            if (pathParams[0] === 'p1') throw new Error('Batch 1 failure');
            return [makeVersion({ id: `v-${pathParams[0]}`, project_id: pathParams[0] as string })];
        });
        vi.spyOn(client, 'getRateLimitState').mockReturnValue({ remaining: 300, resetAt: 0 });

        const { batchPromises, allBatches } = createBatchedResolution(
            client,
            projects,
            makeOptions(),
            1
        );

        // Batch 1 should reject
        await expect(batchPromises[0]).resolves.toMatchObject({
            resolved: [],
            unresolved: [expect.objectContaining({ projectId: 'p1' })]
        });

        // Batches 2 and 3 should still resolve despite batch 1's failure
        const batch2 = await batchPromises[1];
        expect(batch2.resolved).toHaveLength(1);
        expect(batch2.resolved[0].projectId).toBe('p2');

        const batch3 = await batchPromises[2];
        expect(batch3.resolved).toHaveLength(1);
        expect(batch3.resolved[0].projectId).toBe('p3');

        // allBatches should collect all results
        const all = await allBatches;
        expect(all).toHaveLength(3);
    });

    it('delays between batches when rate limit is low', async () => {
        const projects = Array.from({ length: 4 }, (_, i) =>
            makeProject({ id: `p${i}`, title: `Mod ${i}` })
        );

        vi.spyOn(client, 'requestVersion').mockResolvedValue([
            makeVersion({ id: 'v1', project_id: 'p0' })
        ]);

        // resetAt is 600ms from now — wait should be max(500ms floor, 600ms reset)
        vi.spyOn(client, 'getRateLimitState').mockReturnValue({
            remaining: RATE_LIMIT_SAFETY_MARGIN - 1,
            resetAt: Date.now() + 600
        });

        const start = Date.now();
        const { allBatches } = createBatchedResolution(client, projects, makeOptions(), 2);
        await allBatches;
        const elapsed = Date.now() - start;

        // Should have waited at least 500ms (the INTER_BATCH_DELAY_MS floor)
        expect(elapsed).toBeGreaterThanOrEqual(400);
    });
});

// =============================================================================
// mergeBatchResults
// =============================================================================

describe('mergeBatchResults', () => {
    it('merges multiple batch results into a single combined result', () => {
        const batch1: BatchResult = {
            resolved: [{ projectId: 'p1' } as ResolvedProject],
            warnings: [{ type: 'fallback-used', projectId: 'p1', message: 'Fallback' }],
            unresolved: []
        };
        const batch2: BatchResult = {
            resolved: [{ projectId: 'p2' } as ResolvedProject],
            warnings: [],
            unresolved: [{ projectId: 'p3', requiredBy: 'collection', reason: 'Not found' }]
        };

        const merged = mergeBatchResults([batch1, batch2]);

        expect(merged.resolved).toHaveLength(2);
        expect(merged.warnings).toHaveLength(1);
        expect(merged.unresolved).toHaveLength(1);
    });

    it('returns empty result for empty batch array', () => {
        const merged = mergeBatchResults([]);

        expect(merged.resolved).toHaveLength(0);
        expect(merged.warnings).toHaveLength(0);
        expect(merged.unresolved).toHaveLength(0);
    });
});

// =============================================================================
// getMinorVersionFamily
// =============================================================================

describe('getMinorVersionFamily', () => {
    it('extracts minor family from patch version', () => {
        expect(getMinorVersionFamily('1.20.1')).toBe('1.20');
    });

    it('returns minor version as-is when no patch', () => {
        expect(getMinorVersionFamily('1.21')).toBe('1.21');
    });

    it('returns null for snapshot versions', () => {
        expect(getMinorVersionFamily('24w03a')).toBeNull();
    });

    it('extracts minor from pre-release versions', () => {
        expect(getMinorVersionFamily('1.21-pre1')).toBe('1.21');
    });
});

// =============================================================================
// resolveVersion — plugin projects
// =============================================================================

describe('resolveVersion — plugin and loader-agnostic projects', () => {
    let client: ModrinthClient;

    beforeEach(() => {
        client = new ModrinthClient();
    });

    it('resolves plugin project type without loader filter', async () => {
        const version = makeVersion({ loaders: ['bukkit', 'paper'] });
        const spy = vi.spyOn(client, 'requestVersion').mockResolvedValueOnce([version]);

        const project = makeProject({ project_type: 'plugin' });
        const result = await resolveVersion(client, project, makeOptions());

        expect(result).not.toBeNull();
        expect(result!.resolved.projectType).toBe('plugin');

        const call = spy.mock.calls[0];
        const queryParams = (call[2] as { queryParams: Record<string, string> }).queryParams;
        expect(queryParams.loaders).toBeUndefined();
    });

    it('omits loader name from unresolved reason for plugin projects', async () => {
        vi.spyOn(client, 'requestVersion').mockResolvedValue([]);

        const project = makeProject({ id: 'p1', title: 'WorldEdit', project_type: 'plugin' });
        const result = await resolveCollection(client, [project], makeOptions());

        expect(result.unresolved).toHaveLength(1);
        expect(result.unresolved[0].reason).toBe('No compatible version for 1.20.1');
        expect(result.unresolved[0].reason).not.toContain('fabric');
    });

    it('resolves resourcepack via minor-version fallback when exact version missing', async () => {
        vi.spyOn(client, 'requestVersion').mockImplementation(async (_ep, _ver, opts) => {
            const queryParams = (opts as { queryParams: Record<string, string> })?.queryParams;
            // First call: exact version — returns empty
            if (queryParams?.game_versions) return [];
            // Fallback call: all versions — returns version for 1.20
            return [
                makeVersion({
                    id: 'v-fallback',
                    game_versions: ['1.20'],
                    loaders: []
                })
            ];
        });

        const project = makeProject({
            id: 'rp1',
            project_type: 'resourcepack',
            title: 'Cool Pack'
        });
        const result = await resolveVersion(
            client,
            project,
            makeOptions({ gameVersion: '1.20.1' })
        );

        expect(result).not.toBeNull();
        expect(result!.resolved.resolvedGameVersion).toBe('1.20');
        expect(result!.warnings.some((w) => w.type === 'compatible-version-used')).toBe(true);
    });

    it('does not attempt minor-version fallback for snapshot target versions', async () => {
        const spy = vi.spyOn(client, 'requestVersion').mockResolvedValue([]);

        const project = makeProject({ project_type: 'resourcepack' });
        const result = await resolveVersion(
            client,
            project,
            makeOptions({ gameVersion: '24w03a' })
        );

        expect(result).toBeNull();
        // Only 1 call (the exact version attempt), no fallback
        expect(spy).toHaveBeenCalledTimes(1);
    });

    it('fallback prefers closest patch version to target', async () => {
        vi.spyOn(client, 'requestVersion').mockImplementation(async (_ep, _ver, opts) => {
            const queryParams = (opts as { queryParams: Record<string, string> })?.queryParams;
            if (queryParams?.game_versions) return [];
            return [
                makeVersion({
                    id: 'v-far',
                    game_versions: ['1.20.4'],
                    loaders: [],
                    date_published: '2024-06-01T00:00:00Z'
                }),
                makeVersion({
                    id: 'v-close',
                    game_versions: ['1.20'],
                    loaders: [],
                    date_published: '2024-01-01T00:00:00Z'
                })
            ];
        });

        const project = makeProject({ project_type: 'resourcepack' });
        const result = await resolveVersion(
            client,
            project,
            makeOptions({ gameVersion: '1.20.1' })
        );

        expect(result).not.toBeNull();
        // 1.20 (patch 0) is closer to 1.20.1 (patch 1) than 1.20.4 (patch 4)
        expect(result!.resolved.resolvedGameVersion).toBe('1.20');
    });
});

// =============================================================================
// buildUnresolvedReason
// =============================================================================

describe('buildUnresolvedReason', () => {
    it('omits loader for loader-agnostic project types', async () => {
        const { buildUnresolvedReason } = await import('./loader-utils');
        const options = makeOptions();

        expect(buildUnresolvedReason('resourcepack', options)).toBe(
            'No compatible version for 1.20.1'
        );
        expect(buildUnresolvedReason('plugin', options)).toBe('No compatible version for 1.20.1');
    });

    it('includes loader for mod project type', async () => {
        const { buildUnresolvedReason } = await import('./loader-utils');
        const options = makeOptions();

        expect(buildUnresolvedReason('mod', options)).toBe(
            'No compatible version for fabric on 1.20.1'
        );
    });
});

// =============================================================================
// patchDistance
// =============================================================================

describe('patchDistance', () => {
    it('computes distance between two patch versions', () => {
        expect(patchDistance('1.20.1', '1.20.3')).toBe(2);
    });

    it('treats missing patch as 0', () => {
        expect(patchDistance('1.20', '1.20.1')).toBe(1);
    });

    it('handles pre-release suffixes via parseInt', () => {
        expect(patchDistance('1.20.1-pre1', '1.20.3')).toBe(2);
    });

    it('returns 0 for identical versions', () => {
        expect(patchDistance('1.20', '1.20')).toBe(0);
    });

    it('returns 0 for identical patch versions', () => {
        expect(patchDistance('1.20.1', '1.20.1')).toBe(0);
    });

    it('handles both versions missing patch segment', () => {
        expect(patchDistance('1.20', '1.21')).toBe(0);
    });
});
