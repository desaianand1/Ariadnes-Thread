import type { ModrinthClient } from '$lib/api/client';
import type { ModrinthProject, ModrinthVersion, ModrinthFile } from '$lib/api/types';
import { getProjectFolder } from '$lib/api/types';
import { classifySide } from './side-classification';
import { CROSS_LOADER_FALLBACKS } from '$lib/config/constants';
import type {
	ResolutionOptions,
	ResolvedProject,
	ResolutionResult,
	ResolutionWarning,
	UnresolvedDependency,
	ResolutionStats
} from './types';
import { resolveDependencies } from './dependency.server';

// =============================================================================
// Version Type Ranking
// =============================================================================

const VERSION_TYPE_RANK: Record<string, number> = {
	release: 0,
	beta: 1,
	alpha: 2
};

// =============================================================================
// Project types that ignore the loader filter
// =============================================================================

const LOADER_AGNOSTIC_TYPES = new Set(['resourcepack', 'shader', 'datapack']);

// =============================================================================
// resolveVersion
// =============================================================================

export interface VersionResolution {
	resolved: ResolvedProject;
	warnings: ResolutionWarning[];
}

/**
 * Resolves the best matching version for a single project given the
 * game version and loader constraints.
 */
export async function resolveVersion(
	client: ModrinthClient,
	project: ModrinthProject,
	options: ResolutionOptions
): Promise<VersionResolution | null> {
	const warnings: ResolutionWarning[] = [];
	const isLoaderAgnostic = LOADER_AGNOSTIC_TYPES.has(project.project_type);

	// Build the ordered list of loaders to try
	const loaders = isLoaderAgnostic
		? []
		: buildLoaderList(options.loader, options.enableCrossLoaderFallback);

	const versions = await fetchVersions(client, project.id, options.gameVersion, loaders);

	if (versions.length === 0) {
		return null;
	}

	// Filter alpha/beta if not allowed, but fall back with warning if nothing remains
	let candidates = versions;
	if (!options.allowAlphaBeta) {
		const stableOnly = versions.filter((v) => v.version_type === 'release');
		if (stableOnly.length > 0) {
			candidates = stableOnly;
		} else {
			warnings.push({
				type: 'alpha-beta-version',
				projectId: project.id,
				message: `${project.title}: no stable release found, using ${versions[0].version_type} version`
			});
		}
	}

	// Sort: version_type rank → featured → date_published desc
	candidates.sort((a, b) => {
		const rankDiff =
			(VERSION_TYPE_RANK[a.version_type] ?? 99) - (VERSION_TYPE_RANK[b.version_type] ?? 99);
		if (rankDiff !== 0) return rankDiff;

		if (a.featured !== b.featured) return a.featured ? -1 : 1;

		return new Date(b.date_published).getTime() - new Date(a.date_published).getTime();
	});

	const best = candidates[0];
	const file = selectPrimaryFile(best.files);
	if (!file) return null;

	// Detect if we fell back to a different loader
	const usedFallbackLoader = !isLoaderAgnostic && !best.loaders.includes(options.loader);
	const resolvedLoader = usedFallbackLoader
		? best.loaders.find((l) => loaders.includes(l))
		: undefined;

	if (usedFallbackLoader && resolvedLoader) {
		warnings.push({
			type: 'fallback-used',
			projectId: project.id,
			message: `${project.title}: no ${options.loader} version, using ${resolvedLoader} version`
		});
	}

	const side = classifySide(project.client_side, project.server_side);

	const resolved: ResolvedProject = {
		projectId: project.id,
		projectSlug: project.slug,
		projectTitle: project.title,
		projectDescription: project.description,
		projectType: project.project_type,
		iconUrl: project.icon_url,
		versionId: best.id,
		versionNumber: best.version_number,
		versionType: best.version_type,
		fileName: file.filename,
		fileUrl: file.url,
		fileSize: file.size,
		fileHashes: { sha1: file.hashes.sha1, sha512: file.hashes.sha512 },
		loaders: best.loaders,
		dependencyCount: best.dependencies.length,
		side,
		folder: getProjectFolder(project.project_type),
		clientSide: project.client_side,
		serverSide: project.server_side,
		usedFallbackLoader,
		resolvedLoader
	};

	return { resolved, warnings };
}

// =============================================================================
// resolveCollection
// =============================================================================

/**
 * Resolves versions for all projects in a collection, then resolves
 * their dependencies via BFS.
 */
export async function resolveCollection(
	client: ModrinthClient,
	projects: ModrinthProject[],
	options: ResolutionOptions
): Promise<ResolutionResult> {
	const warnings: ResolutionWarning[] = [];
	const unresolved: UnresolvedDependency[] = [];

	// Filter out excluded projects
	const eligible = projects.filter((p) => !options.excludedProjectIds.has(p.id));

	// Fan out version resolution in parallel
	const results = await Promise.allSettled(
		eligible.map((project) => resolveVersion(client, project, options))
	);

	const resolved: ResolvedProject[] = [];

	for (let i = 0; i < results.length; i++) {
		const result = results[i];
		const project = eligible[i];

		if (result.status === 'fulfilled' && result.value) {
			resolved.push(result.value.resolved);
			warnings.push(...result.value.warnings);
		} else {
			const reason =
				result.status === 'rejected'
					? String(result.reason)
					: `No compatible version for ${options.loader} on ${options.gameVersion}`;

			warnings.push({
				type: 'no-compatible-version',
				projectId: project.id,
				message: `${project.title}: ${reason}`
			});
			unresolved.push({
				projectId: project.id,
				requiredBy: 'collection',
				reason
			});
		}
	}

	// Resolve dependencies (skipped entirely when includeDependencies is false)
	const depResult = options.includeDependencies
		? await resolveDependencies(client, resolved, options)
		: { resolved: [], conflicts: [], warnings: [], unresolved: [] };

	// Deduplicate: deps already in the main resolved set are skipped
	const mainIds = new Set(resolved.map((r) => r.projectId));
	const dedupedDeps = depResult.resolved.filter((d) => !mainIds.has(d.projectId));

	const allWarnings = [...warnings, ...depResult.warnings];
	const allUnresolved = [...unresolved, ...depResult.unresolved];

	const stats: ResolutionStats = {
		totalProjects: eligible.length,
		resolvedCount: resolved.length,
		unresolvedCount: allUnresolved.length,
		dependencyCount: dedupedDeps.length,
		conflictCount: depResult.conflicts.length,
		warningCount: allWarnings.length,
		totalDownloadSize:
			resolved.reduce((sum, r) => sum + r.fileSize, 0) +
			dedupedDeps.reduce((sum, r) => sum + r.fileSize, 0)
	};

	return {
		resolved,
		dependencies: dedupedDeps,
		conflicts: depResult.conflicts,
		warnings: allWarnings,
		unresolved: allUnresolved,
		stats
	};
}

// =============================================================================
// Helpers
// =============================================================================

function buildLoaderList(primary: string, enableFallback: boolean): string[] {
	const loaders = [primary];
	if (enableFallback) {
		const fallbacks = CROSS_LOADER_FALLBACKS[primary];
		if (fallbacks) loaders.push(...fallbacks);
	}
	return loaders;
}

async function fetchVersions(
	client: ModrinthClient,
	projectId: string,
	gameVersion: string,
	loaders: string[]
): Promise<ModrinthVersion[]> {
	const queryParams: Record<string, string> = {
		game_versions: JSON.stringify([gameVersion])
	};

	if (loaders.length > 0) {
		queryParams.loaders = JSON.stringify(loaders);
	}

	return client.requestVersion<ModrinthVersion[]>('project', 'v2', {
		pathParams: [projectId, 'version'],
		queryParams
	});
}

function selectPrimaryFile(files: ModrinthFile[]): ModrinthFile | undefined {
	return files.find((f) => f.primary) ?? files[0];
}
