import type { ModrinthClient } from '$lib/api/client';
import type { ModrinthProject, ModrinthVersion } from '$lib/api/types';
import { getProjectFolder } from '$lib/api/types';
import { classifySide } from './side-classification';
import { MAX_DEPENDENCY_DEPTH } from '$lib/config/constants';
import { resolveVersion } from './resolution.server';
import type {
	ResolutionOptions,
	ResolvedProject,
	DependencyResult,
	DependencyNode,
	ConflictEntry,
	ResolutionWarning,
	UnresolvedDependency
} from './types';

/**
 * BFS dependency resolver. Processes all deps at each depth level
 * before descending, batching API calls where possible.
 */
export async function resolveDependencies(
	client: ModrinthClient,
	resolvedVersions: ResolvedProject[],
	options: ResolutionOptions
): Promise<DependencyResult> {
	const resolved: ResolvedProject[] = [];
	const conflicts: ConflictEntry[] = [];
	const warnings: ResolutionWarning[] = [];
	const unresolved: UnresolvedDependency[] = [];

	// Track visited project IDs to prevent cycles and duplicate work
	const visited = new Set<string>(resolvedVersions.map((r) => r.projectId));

	// We need the actual version objects to read their dependency lists.
	// Batch-fetch all initial versions.
	const versionIds = resolvedVersions.map((r) => r.versionId);
	const initialVersions = await batchFetchVersions(client, versionIds);

	// Build initial queue from the dependencies of resolved versions
	let queue: DependencyNode[] = [];
	for (const version of initialVersions) {
		for (const dep of version.dependencies) {
			const depProjectId = dep.project_id;
			if (!depProjectId) continue;

			if (dep.dependency_type === 'embedded') continue;

			if (dep.dependency_type === 'incompatible') {
				if (visited.has(depProjectId)) {
					conflicts.push({
						projectId: depProjectId,
						conflictsWith: version.project_id,
						declaredBy: version.project_id
					});
				}
				continue;
			}

			// Skip optional deps if not requested
			if (dep.dependency_type === 'optional' && !options.includeOptionalDeps) continue;

			if (visited.has(depProjectId) || options.excludedProjectIds.has(depProjectId)) continue;

			queue.push({
				projectId: depProjectId,
				versionId: dep.version_id,
				dependencyType: dep.dependency_type,
				requiredBy: version.project_id,
				depth: 1
			});
		}
	}

	// BFS loop
	while (queue.length > 0) {
		const currentDepth = queue[0].depth;

		if (currentDepth > MAX_DEPENDENCY_DEPTH) {
			for (const node of queue) {
				warnings.push({
					type: 'depth-exceeded',
					projectId: node.projectId,
					message: `Dependency depth limit (${MAX_DEPENDENCY_DEPTH}) exceeded for ${node.projectId}`
				});
			}
			break;
		}

		// Separate this level's nodes from deeper ones
		const thisLevel = queue.filter((n) => n.depth === currentDepth);
		queue = queue.filter((n) => n.depth !== currentDepth);

		// Deduplicate within this level
		const uniqueNodes = deduplicateNodes(thisLevel, visited);
		if (uniqueNodes.length === 0) continue;

		// Mark as visited immediately to prevent cycles from parallel branches
		for (const node of uniqueNodes) {
			visited.add(node.projectId);
		}

		// Split into pinned (have version_id) vs unpinned (need resolution)
		const pinned = uniqueNodes.filter((n) => n.versionId);
		const unpinned = uniqueNodes.filter((n) => !n.versionId);

		// Fetch pinned versions in batch
		const pinnedVersionIds = pinned.map((n) => n.versionId!);
		const pinnedVersions =
			pinnedVersionIds.length > 0 ? await batchFetchVersions(client, pinnedVersionIds) : [];

		// Fetch project info for all unique projects we haven't fetched yet
		const allProjectIds = uniqueNodes.map((n) => n.projectId);
		const projects = await batchFetchProjects(client, allProjectIds);
		const projectMap = new Map(projects.map((p) => [p.id, p]));

		// Process pinned deps
		const pinnedResolved = processPinnedDeps(pinned, pinnedVersions, projectMap, options);
		resolved.push(...pinnedResolved.resolved);
		warnings.push(...pinnedResolved.warnings);
		unresolved.push(...pinnedResolved.unresolved);

		// Resolve unpinned deps in parallel
		const unpinnedResolved = await resolveUnpinnedDeps(client, unpinned, projectMap, options);
		resolved.push(...unpinnedResolved.resolved);
		warnings.push(...unpinnedResolved.warnings);
		unresolved.push(...unpinnedResolved.unresolved);

		// Gather version objects for all newly resolved deps to scan their deps
		const newVersionIds = [...pinnedResolved.resolved, ...unpinnedResolved.resolved].map(
			(r) => r.versionId
		);
		const newVersions =
			newVersionIds.length > 0 ? await batchFetchVersions(client, newVersionIds) : [];

		// Queue next level
		for (const version of newVersions) {
			for (const dep of version.dependencies) {
				const depProjectId = dep.project_id;
				if (!depProjectId) continue;
				if (dep.dependency_type === 'embedded') continue;

				if (dep.dependency_type === 'incompatible') {
					if (visited.has(depProjectId)) {
						conflicts.push({
							projectId: depProjectId,
							conflictsWith: version.project_id,
							declaredBy: version.project_id
						});
					}
					continue;
				}

				if (dep.dependency_type === 'optional' && !options.includeOptionalDeps) continue;
				if (visited.has(depProjectId) || options.excludedProjectIds.has(depProjectId)) continue;

				queue.push({
					projectId: depProjectId,
					versionId: dep.version_id,
					dependencyType: dep.dependency_type,
					requiredBy: version.project_id,
					depth: currentDepth + 1
				});
			}
		}
	}

	return { resolved, conflicts, warnings, unresolved };
}

// =============================================================================
// Helpers
// =============================================================================

function deduplicateNodes(nodes: DependencyNode[], visited: Set<string>): DependencyNode[] {
	const seen = new Set<string>();
	const result: DependencyNode[] = [];
	for (const node of nodes) {
		if (visited.has(node.projectId) || seen.has(node.projectId)) continue;
		seen.add(node.projectId);
		result.push(node);
	}
	return result;
}

/** Batch-fetch versions by ID, chunking at 100 per request */
async function batchFetchVersions(
	client: ModrinthClient,
	versionIds: string[]
): Promise<ModrinthVersion[]> {
	if (versionIds.length === 0) return [];

	const chunks = chunkArray(versionIds, 100);
	const results = await Promise.allSettled(
		chunks.map((chunk) =>
			client.requestVersion<ModrinthVersion[]>('versions', 'v2', {
				queryParams: { ids: JSON.stringify(chunk) }
			})
		)
	);

	const versions: ModrinthVersion[] = [];
	for (let i = 0; i < results.length; i++) {
		const result = results[i];
		if (result.status === 'fulfilled') {
			versions.push(...result.value);
		} else {
			console.warn(`Failed to fetch version batch [${chunks[i].join(', ')}]: ${result.reason}`);
		}
	}
	return versions;
}

/** Batch-fetch projects by ID, chunking at 100 per request */
async function batchFetchProjects(
	client: ModrinthClient,
	projectIds: string[]
): Promise<ModrinthProject[]> {
	if (projectIds.length === 0) return [];

	const chunks = chunkArray(projectIds, 100);
	const results = await Promise.allSettled(
		chunks.map((chunk) =>
			client.requestVersion<ModrinthProject[]>('projects', 'v2', {
				queryParams: { ids: JSON.stringify(chunk) }
			})
		)
	);

	const projects: ModrinthProject[] = [];
	for (let i = 0; i < results.length; i++) {
		const result = results[i];
		if (result.status === 'fulfilled') {
			projects.push(...result.value);
		} else {
			console.warn(`Failed to fetch project batch [${chunks[i].join(', ')}]: ${result.reason}`);
		}
	}
	return projects;
}

function processPinnedDeps(
	nodes: DependencyNode[],
	versions: ModrinthVersion[],
	projectMap: Map<string, ModrinthProject>,
	options: ResolutionOptions
): {
	resolved: ResolvedProject[];
	warnings: ResolutionWarning[];
	unresolved: UnresolvedDependency[];
} {
	const resolved: ResolvedProject[] = [];
	const warnings: ResolutionWarning[] = [];
	const unresolvedDeps: UnresolvedDependency[] = [];

	const versionMap = new Map(versions.map((v) => [v.id, v]));

	for (const node of nodes) {
		const version = versionMap.get(node.versionId!);
		const project = projectMap.get(node.projectId);

		if (!version || !project) {
			warnings.push({
				type: 'dependency-not-found',
				projectId: node.projectId,
				message: `Dependency ${node.projectId} (pinned version ${node.versionId}) not found`
			});
			unresolvedDeps.push({
				projectId: node.projectId,
				requiredBy: node.requiredBy,
				reason: 'Pinned version or project not found'
			});
			continue;
		}

		const file = version.files.find((f) => f.primary) ?? version.files[0];
		if (!file) {
			unresolvedDeps.push({
				projectId: node.projectId,
				requiredBy: node.requiredBy,
				reason: 'Version has no downloadable files'
			});
			continue;
		}

		if (!options.allowAlphaBeta && version.version_type !== 'release') {
			warnings.push({
				type: 'alpha-beta-version',
				projectId: project.id,
				message: `${project.title}: pinned dependency uses ${version.version_type} version`
			});
		}

		const side = classifySide(project.client_side, project.server_side);

		resolved.push({
			projectId: project.id,
			projectSlug: project.slug,
			projectTitle: project.title,
			projectDescription: project.description,
			projectType: project.project_type,
			iconUrl: project.icon_url,
			versionId: version.id,
			versionNumber: version.version_number,
			versionType: version.version_type,
			fileName: file.filename,
			fileUrl: file.url,
			fileSize: file.size,
			fileHashes: { sha1: file.hashes.sha1, sha512: file.hashes.sha512 },
			loaders: version.loaders,
			dependencyCount: version.dependencies.length,
			side,
			folder: getProjectFolder(project.project_type),
			clientSide: project.client_side,
			serverSide: project.server_side,
			dependencyOf: node.requiredBy,
			dependencyType: node.dependencyType,
			dependencyDepth: node.depth,
			usedFallbackLoader: false
		});
	}

	return { resolved, warnings, unresolved: unresolvedDeps };
}

async function resolveUnpinnedDeps(
	client: ModrinthClient,
	nodes: DependencyNode[],
	projectMap: Map<string, ModrinthProject>,
	options: ResolutionOptions
): Promise<{
	resolved: ResolvedProject[];
	warnings: ResolutionWarning[];
	unresolved: UnresolvedDependency[];
}> {
	const resolved: ResolvedProject[] = [];
	const warnings: ResolutionWarning[] = [];
	const unresolvedDeps: UnresolvedDependency[] = [];

	const results = await Promise.allSettled(
		nodes.map(async (node) => {
			const project = projectMap.get(node.projectId);
			if (!project) return { node, resolution: null };
			const resolution = await resolveVersion(client, project, options);
			return { node, resolution };
		})
	);

	for (const result of results) {
		if (result.status === 'rejected') continue;

		const { node, resolution } = result.value;
		if (resolution) {
			const dep = {
				...resolution.resolved,
				dependencyOf: node.requiredBy,
				dependencyType: node.dependencyType,
				dependencyDepth: node.depth
			};
			resolved.push(dep);
			warnings.push(...resolution.warnings);
		} else {
			const project = projectMap.get(node.projectId);
			warnings.push({
				type: 'dependency-not-found',
				projectId: node.projectId,
				message: `Dependency ${project?.title ?? node.projectId}: no compatible version`
			});
			unresolvedDeps.push({
				projectId: node.projectId,
				requiredBy: node.requiredBy,
				reason: `No compatible version for ${options.loader} on ${options.gameVersion}`
			});
		}
	}

	return { resolved, warnings, unresolved: unresolvedDeps };
}

function chunkArray<T>(arr: T[], size: number): T[][] {
	const chunks: T[][] = [];
	for (let i = 0; i < arr.length; i += size) {
		chunks.push(arr.slice(i, i + size));
	}
	return chunks;
}
