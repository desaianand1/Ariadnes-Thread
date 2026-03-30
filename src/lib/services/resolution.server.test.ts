import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ModrinthClient } from '$lib/api/client';
import type { ModrinthProject, ModrinthVersion } from '$lib/api/types';
import { resolveVersion, resolveCollection } from './resolution.server';
import type { ResolutionOptions } from './types';

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

	it('returns null when no versions match', async () => {
		vi.spyOn(client, 'requestVersion').mockResolvedValueOnce([]);

		const result = await resolveVersion(client, makeProject(), makeOptions());
		expect(result).toBeNull();
	});

	it('prefers release over beta/alpha', async () => {
		const beta = makeVersion({ id: 'vbeta', version_type: 'beta', version_number: '2.0.0-beta' });
		const release = makeVersion({ id: 'vrel', version_type: 'release', version_number: '1.0.0' });

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
});
