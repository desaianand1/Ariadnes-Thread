import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { createClientFromPlatform } from '$lib/api/client.server';
import { reviewParamsSchema, parseReviewOptions } from '$lib/schemas/collection';
import { resolveCollection } from '$lib/services/resolution.server';
import { decimalToHex } from '$lib/utils/colors';
import type { ModrinthCollection, ModrinthProject } from '$lib/api/types';
import type {
	CollectionGroup,
	ResolvedProject,
	ResolutionWarning,
	ConflictEntry,
	UnresolvedDependency,
	ResolutionStats
} from '$lib/services/types';

interface CollectionFetchResult {
	collection: ModrinthCollection;
	projects: ModrinthProject[];
}

async function fetchCollection(
	client: import('$lib/api/client').ModrinthClient,
	collectionId: string
): Promise<CollectionFetchResult> {
	const collection = await client.request<ModrinthCollection>('collection', {
		pathParams: [collectionId],
		preferredVersion: 'v3'
	});

	const projectIds = collection.projects;
	const projects: ModrinthProject[] = [];

	for (let i = 0; i < projectIds.length; i += 100) {
		const chunk = projectIds.slice(i, i + 100);
		const batch = await client.requestVersion<ModrinthProject[]>('projects', 'v2', {
			queryParams: { ids: JSON.stringify(chunk) }
		});
		projects.push(...batch);
	}

	return { collection, projects };
}

export const load: PageServerLoad = async ({ url, platform }) => {
	const parseResult = reviewParamsSchema.safeParse(Object.fromEntries(url.searchParams));
	if (!parseResult.success) {
		error(400, 'Invalid review parameters');
	}

	const params = parseResult.data;
	const reviewOptions = parseReviewOptions(params);

	const resolutionOptions = {
		gameVersion: reviewOptions.gameVersion,
		loader: reviewOptions.loader,
		includeDependencies: reviewOptions.includeDependencies,
		includeOptionalDeps: reviewOptions.includeOptionalDeps,
		enableCrossLoaderFallback: reviewOptions.enableCrossLoaderFallback,
		allowAlphaBeta: reviewOptions.allowAlphaBeta,
		excludedProjectIds: reviewOptions.excludedProjectIds
	};

	const client = createClientFromPlatform(platform);

	// Fetch and resolve each collection in parallel
	const collectionResults = await Promise.allSettled(
		reviewOptions.collectionIds.map(async (id) => {
			const { collection, projects } = await fetchCollection(client, id);

			// Filter out modpacks
			const modpacks = projects.filter((p) => p.project_type === 'modpack');
			const filteredProjects = projects.filter((p) => p.project_type !== 'modpack');

			const modpackWarnings: ResolutionWarning[] = modpacks.map((p) => ({
				type: 'no-compatible-version' as const,
				projectId: p.id,
				message: `${p.title} is a modpack and was skipped`
			}));

			const result = await resolveCollection(client, filteredProjects, resolutionOptions);

			return {
				collection,
				result,
				modpackWarnings,
				totalProjectCount: projects.length
			};
		})
	);

	// Check if all collections failed
	const successfulResults = collectionResults.filter(
		(
			r
		): r is PromiseFulfilledResult<
			Awaited<
				ReturnType<typeof resolveCollection> & {
					collection: ModrinthCollection;
					result: Awaited<ReturnType<typeof resolveCollection>>;
					modpackWarnings: ResolutionWarning[];
					totalProjectCount: number;
				}
			>
		> => r.status === 'fulfilled'
	);

	if (successfulResults.length === 0) {
		error(502, 'Could not fetch any collections');
	}

	// Cross-collection dedup: first collection claims each project
	const claimedProjects = new Map<string, { collectionName: string; collectionIndex: number }>();
	const collections: CollectionGroup[] = [];
	const allDependencies: ResolvedProject[] = [];
	const allConflicts: ConflictEntry[] = [];
	const allWarnings: ResolutionWarning[] = [];
	const allUnresolved: UnresolvedDependency[] = [];

	// Add warnings for failed collections
	for (let i = 0; i < collectionResults.length; i++) {
		const result = collectionResults[i];
		if (result.status === 'rejected') {
			allWarnings.push({
				type: 'no-compatible-version',
				projectId: reviewOptions.collectionIds[i],
				message: `Failed to fetch collection ${reviewOptions.collectionIds[i]}: ${String(result.reason)}`
			});
		}
	}

	for (let i = 0; i < successfulResults.length; i++) {
		const { collection, result, modpackWarnings, totalProjectCount } = successfulResults[i].value;

		allWarnings.push(...modpackWarnings);
		allWarnings.push(...result.warnings);
		allConflicts.push(...result.conflicts);
		allUnresolved.push(...result.unresolved);

		// Dedup resolved projects across collections
		const alsoInMap: Record<string, string[]> = {};
		const dedupedResolved: ResolvedProject[] = [];

		for (const project of result.resolved) {
			const existing = claimedProjects.get(project.projectId);
			if (existing) {
				// Already claimed by another collection — record cross-reference
				if (!alsoInMap[project.projectId]) {
					alsoInMap[project.projectId] = [];
				}
				// Also annotate the original collection's group
				const originalGroup = collections[existing.collectionIndex];
				if (originalGroup) {
					if (!originalGroup.alsoInMap[project.projectId]) {
						originalGroup.alsoInMap[project.projectId] = [];
					}
					originalGroup.alsoInMap[project.projectId].push(collection.name);
				}
			} else {
				claimedProjects.set(project.projectId, {
					collectionName: collection.name,
					collectionIndex: collections.length
				});
				dedupedResolved.push(project);
			}
		}

		collections.push({
			id: collection.id,
			name: collection.name,
			iconUrl: collection.icon_url,
			color: decimalToHex(collection.color),
			totalProjectCount,
			resolved: dedupedResolved,
			alsoInMap
		});

		// Dedup dependencies: skip if already claimed by any collection's resolved set
		for (const dep of result.dependencies) {
			if (!claimedProjects.has(dep.projectId)) {
				claimedProjects.set(dep.projectId, {
					collectionName: '_dependencies',
					collectionIndex: -1
				});
				allDependencies.push(dep);
			}
		}
	}

	// Build project title map for dependency annotations
	const projectTitleMap: Record<string, string> = {};
	for (const group of collections) {
		for (const p of group.resolved) {
			projectTitleMap[p.projectId] = p.projectTitle;
		}
	}
	for (const dep of allDependencies) {
		projectTitleMap[dep.projectId] = dep.projectTitle;
	}

	// Aggregate stats
	const allResolved = collections.flatMap((g) => g.resolved);
	const stats: ResolutionStats = {
		totalProjects: collections.reduce((sum, g) => sum + g.totalProjectCount, 0),
		resolvedCount: allResolved.length,
		unresolvedCount: allUnresolved.length,
		dependencyCount: allDependencies.length,
		conflictCount: allConflicts.length,
		warningCount: allWarnings.length,
		totalDownloadSize:
			allResolved.reduce((sum, r) => sum + r.fileSize, 0) +
			allDependencies.reduce((sum, r) => sum + r.fileSize, 0)
	};

	return {
		collections,
		dependencies: allDependencies,
		conflicts: allConflicts,
		warnings: allWarnings,
		unresolved: allUnresolved,
		stats,
		projectTitleMap,
		context: {
			gameVersion: reviewOptions.gameVersion,
			loader: reviewOptions.loader,
			collectionIds: reviewOptions.collectionIds
		}
	};
};
