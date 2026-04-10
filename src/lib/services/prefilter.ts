import { LOADER_AGNOSTIC_PROJECT_TYPES } from '$lib/config/constants';
import { getMinorVersionFamily } from '$lib/services/resolution.server';
import { buildLoaderList } from '$lib/services/loader-utils';
import type { ModrinthProject } from '$lib/api/types';
import type { UnresolvedDependency } from '$lib/services/types';

export interface PreFilterResult {
    candidates: ModrinthProject[];
    pruned: UnresolvedDependency[];
}

/**
 * Separates projects into API candidates and definitely-incompatible rejects
 * using only the aggregate metadata already available on ModrinthProject.
 *
 * For non-loader-agnostic projects (mods, etc.), requires an exact game version
 * match AND loader overlap with the full cross-loader fallback list.
 *
 * For loader-agnostic projects (resourcepacks, shaders, datapacks, plugins),
 * requires at least one listed game version in the same minor family — this
 * preserves the minor-version fallback path in resolveVersion().
 */
export function preFilterIncompatibleProjects(
    projects: ModrinthProject[],
    gameVersion: string,
    loader: string,
    enableCrossLoaderFallback: boolean
): PreFilterResult {
    const targetMinorFamily = getMinorVersionFamily(gameVersion);
    const allowedLoaderSet = new Set(buildLoaderList(loader, enableCrossLoaderFallback));

    const candidates: ModrinthProject[] = [];
    const pruned: UnresolvedDependency[] = [];

    for (const project of projects) {
        const isLoaderAgnostic = LOADER_AGNOSTIC_PROJECT_TYPES.has(project.project_type);

        if (isLoaderAgnostic) {
            const hasMinorFamilyMatch =
                targetMinorFamily != null &&
                project.game_versions.some((v) => getMinorVersionFamily(v) === targetMinorFamily);

            if (!hasMinorFamilyMatch) {
                pruned.push({
                    projectId: project.id,
                    requiredBy: 'collection',
                    reason: `No compatible version for ${gameVersion}`
                });
                continue;
            }
        } else {
            if (!project.game_versions.includes(gameVersion)) {
                pruned.push({
                    projectId: project.id,
                    requiredBy: 'collection',
                    reason: `No compatible version for ${loader} on ${gameVersion}`
                });
                continue;
            }

            const hasLoaderMatch = project.loaders.some((l) => allowedLoaderSet.has(l));
            if (!hasLoaderMatch) {
                pruned.push({
                    projectId: project.id,
                    requiredBy: 'collection',
                    reason: `No compatible version for ${loader} on ${gameVersion}`
                });
                continue;
            }
        }

        candidates.push(project);
    }

    return { candidates, pruned };
}
