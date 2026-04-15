import type {
    ResolvedProject,
    CollectionGroup,
    ConflictEntry,
    UnresolvedDependency,
    ResolutionWarning,
    SideClassification,
    AlternativeProbe
} from './types';
import type { VersionType } from '$lib/api/types';
import { formatVersionNumber, getLoaderDisplayName, LOADER_DISPLAY_NAMES } from '$lib/utils/format';
import { ADVISOR_MIN_IMPROVEMENT_PERCENT, isPluginLoader } from '$lib/config/constants';
import { getLoaderCategory } from '$lib/config/constants';

// --- Category Summary ---

/**
 * Collects category tags from resolved projects and returns the top 5
 * by frequency, capitalized for display.
 */
export function computeCategorySummary(
    projects: ResolvedProject[]
): Array<{ category: string; count: number }> {
    const counts = new Map<string, number>();
    for (const p of projects) {
        if (!p.categories) continue;
        for (const cat of p.categories) {
            const normalized = cat.toLowerCase();
            counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
        }
    }

    return [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([category, count]) => ({
            category: category.charAt(0).toUpperCase() + category.slice(1),
            count
        }));
}

// --- Types ---

export interface AutoResolvedItem {
    type:
        | 'fallback'
        | 'beta-version'
        | 'auto-excluded'
        | 'loader-independent'
        | 'compatible-version-used';
    message: string;
    reasonText: string;
    projectTitle: string;
    projectId: string;
    iconUrl?: string;
    versionNumber?: string;
    fileSize?: number;
    side?: SideClassification;
    loaders?: string[];
    versionType?: VersionType;
    resolvedLoader?: string;
    /** For auto-excluded: the mod that conflicts with this one */
    conflictModName?: string;
    /** For compatible-version-used: the actual MC version the file was built for */
    resolvedGameVersion?: string;
    /** For compatible-version-used: the target MC version requested */
    targetGameVersion?: string;
    /** For loader-independent / compatible-version-used: the project type */
    projectType?: string;
}

export interface AutoResolutionResult {
    items: AutoResolvedItem[];
    autoExcludedIds: Set<string>;
}

export type ResolutionState = 'allClear' | 'hasIssues' | 'noMods';

export type ViewMode = 'simple' | 'detailed';

export interface ConflictItem {
    projectA: { id: string; title: string; iconUrl?: string };
    projectB: { id: string; title: string; iconUrl?: string };
    declaredBy: string;
}

export interface MissingDepItem {
    projectId: string;
    projectTitle: string;
    requiredBy: string[];
    reason: string;
}

export interface SideStats {
    count: number;
    downloadSize: number;
}

export type ModStatus = 'compatible' | 'warning' | 'conflict';

export interface DerivedModStatus {
    status: ModStatus;
    statusMessage: string | undefined;
    borderClass: string;
}

const STATUS_BORDER_CLASSES: Record<ModStatus, string> = {
    conflict: 'border-l-2 border-l-red-400',
    warning: 'border-l-2 border-l-yellow-400',
    compatible: ''
};

export function deriveModStatus(
    isConflict: boolean,
    warnings: ResolutionWarning[]
): DerivedModStatus {
    if (isConflict) {
        return {
            status: 'conflict',
            statusMessage: 'Incompatible',
            borderClass: STATUS_BORDER_CLASSES.conflict
        };
    }
    if (warnings.length > 0) {
        return {
            status: 'warning',
            statusMessage: warnings[0].message,
            borderClass: STATUS_BORDER_CLASSES.warning
        };
    }
    return {
        status: 'compatible',
        statusMessage: undefined,
        borderClass: STATUS_BORDER_CLASSES.compatible
    };
}

export interface ModFilterCriteria {
    searchQuery: string;
    typeFilter: string;
    sideFilter: string;
    issuesOnly: boolean;
    warningsByProject: Map<string, ResolutionWarning[]>;
    conflictProjectIds: Set<string>;
}

export function matchesModFilters(project: ResolvedProject, criteria: ModFilterCriteria): boolean {
    if (
        criteria.searchQuery &&
        !project.projectTitle.toLowerCase().includes(criteria.searchQuery.toLowerCase())
    )
        return false;
    if (criteria.typeFilter !== 'all' && project.projectType !== criteria.typeFilter) return false;
    if (criteria.sideFilter !== 'all' && project.side !== criteria.sideFilter) return false;
    if (criteria.issuesOnly) {
        const hasIssue =
            criteria.warningsByProject.has(project.projectId) ||
            criteria.conflictProjectIds.has(project.projectId);
        if (!hasIssue) return false;
    }
    return true;
}

// --- Formatting ---

/**
 * Formats a technical resolution reason into a display-friendly string.
 */
export function formatTechnicalReason(reason: string): string {
    return reason
        .replace(
            /No compatible version for (\w+) on (.+)/,
            (_, l, v) => `No ${getLoaderDisplayName(l)} version for ${v}`
        )
        .replace(/^No compatible version for ([\d.]+)$/, (_, v) => `Not available for ${v}`)
        .replace(/no compatible version\b.*/i, 'Not available')
        .replace(
            /using version built for ([\d.]+\S*) instead of ([\d.]+\S*)/i,
            (_, actual, target) => `Using ${actual} build (target: ${target})`
        );
}

/**
 * Returns a plain-English explanation for why a mod is unavailable.
 */
export function getFriendlyIssueReason(
    reason: string,
    isNearMiss: boolean,
    hasAdvisorSuggestion: boolean,
    availableLoaders?: string[]
): string {
    const lower = reason.toLowerCase();

    if (lower.includes('dependency') || lower.includes('required')) {
        return "This mod needs another mod that isn't available for your setup";
    }
    if (
        lower.includes('loader') ||
        lower.includes('fabric') ||
        lower.includes('forge') ||
        lower.includes('quilt') ||
        lower.includes('neoforge')
    ) {
        if (availableLoaders && availableLoaders.length > 0) {
            const loaderNames = [...new Set(availableLoaders)].map(getLoaderDisplayName).join(', ');
            return `This mod is available on ${loaderNames}`;
        }
        return 'This mod was made for a different mod loader';
    }
    if (isNearMiss && hasAdvisorSuggestion) {
        return 'This mod is available on another Minecraft version — try switching above';
    }
    if (isNearMiss) {
        return 'This mod is available on a different Minecraft version';
    }
    return "This mod hasn't been updated for this Minecraft version yet";
}

// --- Functions ---

/**
 * Compute auto-resolved items and auto-excluded IDs from resolution data.
 * Auto-excludes dependency-only conflicts, flags fallback/beta versions.
 */
export function computeAutoResolution(
    projects: ResolvedProject[],
    conflicts: ConflictEntry[],
    collectionProjectIds: Set<string>,
    titleMap: Record<string, string>,
    gameVersion?: string,
    loader?: string
): AutoResolutionResult {
    const items: AutoResolvedItem[] = [];
    const autoExcludedIds = new Set<string>();

    const projectMap = new Map<string, ResolvedProject>();
    for (const p of projects) {
        projectMap.set(p.projectId, p);
    }

    for (const p of projects) {
        if (p.usedFallbackLoader && p.resolvedLoader) {
            items.push({
                type: 'fallback',
                message: `${p.projectTitle}: resolved via ${getLoaderDisplayName(p.resolvedLoader)} compatibility`,
                reasonText: `Using ${getLoaderDisplayName(p.resolvedLoader)} version (cross-loader compatible)`,
                projectTitle: p.projectTitle,
                projectId: p.projectId,
                iconUrl: p.iconUrl,
                versionNumber: p.versionNumber,
                fileSize: p.fileSize,
                side: p.side,
                loaders: p.loaders,
                versionType: p.versionType,
                resolvedLoader: p.resolvedLoader
            });
        }

        // Only flag plugins as loader-independent when the user selected a mod loader
        if (p.projectType === 'plugin' && (!loader || !isPluginLoader(loader))) {
            items.push({
                type: 'loader-independent',
                message: `${p.projectTitle}: plugin — works without a mod loader`,
                reasonText: 'Plugin — works without a mod loader',
                projectTitle: p.projectTitle,
                projectId: p.projectId,
                iconUrl: p.iconUrl,
                versionNumber: p.versionNumber,
                fileSize: p.fileSize,
                side: p.side,
                loaders: p.loaders,
                versionType: p.versionType,
                projectType: p.projectType
            });
        }

        if (p.resolvedGameVersion && gameVersion && p.resolvedGameVersion !== gameVersion) {
            items.push({
                type: 'compatible-version-used',
                message: `${p.projectTitle}: built for ${p.resolvedGameVersion}, not ${gameVersion}`,
                reasonText: `Built for ${p.resolvedGameVersion}, not ${gameVersion} — minor differences possible`,
                projectTitle: p.projectTitle,
                projectId: p.projectId,
                iconUrl: p.iconUrl,
                versionNumber: p.versionNumber,
                fileSize: p.fileSize,
                side: p.side,
                loaders: p.loaders,
                versionType: p.versionType,
                resolvedGameVersion: p.resolvedGameVersion,
                targetGameVersion: gameVersion,
                projectType: p.projectType
            });
        }

        if (p.versionType !== 'release') {
            items.push({
                type: 'beta-version',
                message: `${p.projectTitle}: using ${p.versionType} (no stable release available)`,
                reasonText: `No stable release available — using ${p.versionType} ${formatVersionNumber(p.versionNumber)}`,
                projectTitle: p.projectTitle,
                projectId: p.projectId,
                iconUrl: p.iconUrl,
                versionNumber: p.versionNumber,
                fileSize: p.fileSize,
                side: p.side,
                loaders: p.loaders,
                versionType: p.versionType,
                resolvedLoader: p.resolvedLoader
            });
        }
    }

    const seen = new Set<string>();
    for (const conflict of conflicts) {
        const key = [conflict.projectId, conflict.conflictsWith].sort().join(':');
        if (seen.has(key)) continue;
        seen.add(key);

        const aInCollection = collectionProjectIds.has(conflict.projectId);
        const bInCollection = collectionProjectIds.has(conflict.conflictsWith);

        if (aInCollection && !bInCollection) {
            autoExcludedIds.add(conflict.conflictsWith);
            const proj = projectMap.get(conflict.conflictsWith);
            const conflictName = titleMap[conflict.projectId] ?? conflict.projectId;
            items.push({
                type: 'auto-excluded',
                message: `${titleMap[conflict.conflictsWith] ?? conflict.conflictsWith}: auto-excluded (incompatible with ${conflictName})`,
                reasonText: `Conflicts with ${conflictName} — automatically excluded`,
                conflictModName: conflictName,
                projectTitle: titleMap[conflict.conflictsWith] ?? conflict.conflictsWith,
                projectId: conflict.conflictsWith,
                iconUrl: proj?.iconUrl,
                versionNumber: proj?.versionNumber,
                fileSize: proj?.fileSize,
                side: proj?.side,
                loaders: proj?.loaders,
                versionType: proj?.versionType
            });
        } else if (!aInCollection && bInCollection) {
            autoExcludedIds.add(conflict.projectId);
            const proj = projectMap.get(conflict.projectId);
            const conflictName = titleMap[conflict.conflictsWith] ?? conflict.conflictsWith;
            items.push({
                type: 'auto-excluded',
                message: `${titleMap[conflict.projectId] ?? conflict.projectId}: auto-excluded (incompatible with ${conflictName})`,
                reasonText: `Conflicts with ${conflictName} — automatically excluded`,
                conflictModName: conflictName,
                projectTitle: titleMap[conflict.projectId] ?? conflict.projectId,
                projectId: conflict.projectId,
                iconUrl: proj?.iconUrl,
                versionNumber: proj?.versionNumber,
                fileSize: proj?.fileSize,
                side: proj?.side,
                loaders: proj?.loaders,
                versionType: proj?.versionType
            });
        }
    }

    return { items, autoExcludedIds };
}

/**
 * Extract conflicts requiring user input — both sides are in user's collections.
 */
export function getUserActionableConflicts(
    conflicts: ConflictEntry[],
    collectionProjectIds: Set<string>,
    titleMap: Record<string, string>,
    iconMap: Record<string, string | undefined>
): ConflictItem[] {
    const seen = new Set<string>();
    const result: ConflictItem[] = [];

    for (const c of conflicts) {
        const key = [c.projectId, c.conflictsWith].sort().join(':');
        if (seen.has(key)) continue;
        seen.add(key);

        if (collectionProjectIds.has(c.projectId) && collectionProjectIds.has(c.conflictsWith)) {
            result.push({
                projectA: {
                    id: c.projectId,
                    title: titleMap[c.projectId] ?? c.projectId,
                    iconUrl: iconMap[c.projectId]
                },
                projectB: {
                    id: c.conflictsWith,
                    title: titleMap[c.conflictsWith] ?? c.conflictsWith,
                    iconUrl: iconMap[c.conflictsWith]
                },
                declaredBy: c.declaredBy
            });
        }
    }

    return result;
}

/**
 * Map unresolved dependencies to user-friendly missing dep items.
 * Groups multiple "required by" entries for the same dependency.
 */
export function getMissingDeps(
    unresolved: UnresolvedDependency[],
    titleMap: Record<string, string>
): MissingDepItem[] {
    const grouped = new Map<string, MissingDepItem>();
    for (const u of unresolved) {
        const existing = grouped.get(u.projectId);
        if (existing) {
            existing.requiredBy.push(titleMap[u.requiredBy] ?? u.requiredBy);
        } else {
            grouped.set(u.projectId, {
                projectId: u.projectId,
                projectTitle: titleMap[u.projectId] ?? u.projectId,
                requiredBy: [titleMap[u.requiredBy] ?? u.requiredBy],
                reason: formatReasonLoaderNames(u.reason)
            });
        }
    }
    return [...grouped.values()];
}

// Derive known slugs from the canonical map + common ones that capitalize cleanly
const KNOWN_LOADER_SLUGS = [
    ...Object.keys(LOADER_DISPLAY_NAMES),
    'fabric',
    'forge',
    'quilt',
    'modloader'
];
const LOADER_SLUG_PATTERN = new RegExp(
    `\\b(${[...new Set(KNOWN_LOADER_SLUGS)].join('|')})\\b`,
    'gi'
);

function formatReasonLoaderNames(reason: string): string {
    return reason.replace(LOADER_SLUG_PATTERN, (match) =>
        getLoaderDisplayName(match.toLowerCase())
    );
}

/**
 * Derive the overall resolution state.
 */
export function getResolutionState(
    totalModCount: number,
    userConflictCount: number,
    missingDepCount: number
): ResolutionState {
    if (totalModCount === 0) return 'noMods';
    if (userConflictCount > 0 || missingDepCount > 0) return 'hasIssues';
    return 'allClear';
}

/**
 * Compute per-side download stats from visible projects.
 * "both" mods count toward both client and server.
 */
export function computeSideStats(projects: ResolvedProject[]): {
    client: SideStats;
    server: SideStats;
    total: SideStats;
} {
    const client = { count: 0, downloadSize: 0 };
    const server = { count: 0, downloadSize: 0 };

    for (const p of projects) {
        if (p.side === 'client' || p.side === 'both') {
            client.count++;
            client.downloadSize += p.fileSize;
        }
        if (p.side === 'server' || p.side === 'both') {
            server.count++;
            server.downloadSize += p.fileSize;
        }
    }

    return {
        client,
        server,
        total: {
            count: projects.length,
            downloadSize: projects.reduce((sum, p) => sum + p.fileSize, 0)
        }
    };
}

/**
 * Build a map of projectId -> collection name for "from:" metadata.
 * First collection wins for dedup.
 */
export function buildCollectionNameMap(collections: CollectionGroup[]): Record<string, string> {
    const map: Record<string, string> = {};
    for (const group of collections) {
        for (const p of group.resolved) {
            if (!map[p.projectId]) {
                map[p.projectId] = group.name;
            }
        }
    }
    return map;
}

/**
 * Build a map of projectId -> iconUrl for conflict display.
 */
export function buildIconMap(
    collections: CollectionGroup[],
    dependencies: ResolvedProject[]
): Record<string, string | undefined> {
    const map: Record<string, string | undefined> = {};
    for (const group of collections) {
        for (const p of group.resolved) {
            map[p.projectId] = p.iconUrl;
        }
    }
    for (const p of dependencies) {
        map[p.projectId] = p.iconUrl;
    }
    return map;
}

/**
 * Get the set of all project IDs directly in user collections (not deps).
 */
export function getCollectionProjectIds(collections: CollectionGroup[]): Set<string> {
    return new Set(collections.flatMap((g) => g.resolved.map((r) => r.projectId)));
}

/**
 * Count projects by type for filter chips.
 */
export function countByProjectType(projects: ResolvedProject[]): Record<string, number> {
    return projects.reduce(
        (map, p) => {
            map[p.projectType] = (map[p.projectType] ?? 0) + 1;
            return map;
        },
        {} as Record<string, number>
    );
}

/**
 * Build a map of projectId -> warnings for quick lookup.
 */
export function buildWarningsMap(warnings: ResolutionWarning[]): Map<string, ResolutionWarning[]> {
    return warnings.reduce((map, w) => {
        const existing = map.get(w.projectId);
        if (existing) {
            existing.push(w);
        } else {
            map.set(w.projectId, [w]);
        }
        return map;
    }, new Map<string, ResolutionWarning[]>());
}

/**
 * Get the set of all project IDs involved in conflicts.
 */
export function getConflictProjectIds(conflicts: ConflictEntry[]): Set<string> {
    return new Set(conflicts.flatMap((c) => [c.projectId, c.conflictsWith]));
}

// =============================================================================
// Availability Grouping
// =============================================================================

export interface LoaderVersionGroup {
    loader: string;
    versions: string[];
}

/**
 * Groups availability data by loader, deduplicates versions per loader,
 * sorts loaders by category (popular first), versions descending within each.
 */
export function groupAvailabilityByLoader(
    availableOn: Array<{ version: string; loader: string }>
): LoaderVersionGroup[] {
    if (availableOn.length === 0) return [];

    // Group by loader, dedup versions
    const grouped = new Map<string, Set<string>>();
    for (const { loader, version } of availableOn) {
        if (!grouped.has(loader)) grouped.set(loader, new Set());
        grouped.get(loader)!.add(version);
    }

    // Convert to array and sort versions descending within each loader
    const result: LoaderVersionGroup[] = [];
    for (const [loader, versionSet] of grouped) {
        const versions = [...versionSet].sort((a, b) => {
            // Simple version comparison: split on dots, compare numerically
            const aParts = a.split('.').map(Number);
            const bParts = b.split('.').map(Number);
            for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
                const diff = (bParts[i] ?? 0) - (aParts[i] ?? 0);
                if (diff !== 0) return diff;
            }
            return 0;
        });
        result.push({ loader, versions });
    }

    // Sort loaders: popular > plugin > other, then alphabetical within category
    const categoryOrder: Record<string, number> = { popular: 0, plugin: 1, other: 2 };
    result.sort((a, b) => {
        const aCat = categoryOrder[getLoaderCategory(a.loader)] ?? 2;
        const bCat = categoryOrder[getLoaderCategory(b.loader)] ?? 2;
        if (aCat !== bCat) return aCat - bCat;
        return a.loader.localeCompare(b.loader);
    });

    return result;
}

// =============================================================================
// Best Configuration Advisor Helpers
// =============================================================================

/**
 * Whether the advisor callout should be shown based on the best alternative's
 * net gain as a percentage of total mods.
 */
export function shouldShowAdvisor(
    bestAlternative: AlternativeProbe | null,
    totalMods: number
): boolean {
    if (!bestAlternative || totalMods === 0) return false;
    return (bestAlternative.netGain / totalMods) * 100 >= ADVISOR_MIN_IMPROVEMENT_PERCENT;
}

// =============================================================================
// Dependency Cascade Helpers
// =============================================================================

/**
 * Find resolved mods that depend on the given project.
 * Returns titles of mods that would be affected by excluding this project.
 */
export function getDependentMods(projectId: string, allProjects: ResolvedProject[]): string[] {
    return allProjects.filter((p) => p.dependencyOf === projectId).map((p) => p.projectTitle);
}

// =============================================================================
// Donut Chart Helpers
// =============================================================================

export interface DonutSegment {
    category: string;
    count: number;
    color: string;
}

/**
 * Builds the donut chart segment array, filtering out zero-count segments.
 */
export function computeDonutSegments(
    collectionModCount: number,
    depModCount: number,
    autoFixedCount: number,
    unresolvedCount: number
): DonutSegment[] {
    const segments: DonutSegment[] = [];
    const directResolved = collectionModCount - autoFixedCount;

    if (directResolved > 0) {
        segments.push({
            category: 'resolved',
            count: directResolved,
            color: 'var(--color-resolved)'
        });
    }
    if (depModCount > 0) {
        segments.push({
            category: 'dependencies',
            count: depModCount,
            color: 'var(--color-dependencies)'
        });
    }
    if (autoFixedCount > 0) {
        segments.push({
            category: 'autofixed',
            count: autoFixedCount,
            color: 'var(--color-autofixed)'
        });
    }
    if (unresolvedCount > 0) {
        segments.push({
            category: 'unavailable',
            count: unresolvedCount,
            color: 'var(--color-unavailable)'
        });
    }
    return segments;
}

/**
 * Computes resolution percentage with zero-denominator safety.
 */
export function computeResolutionPercentage(totalReady: number, totalAttempted: number): number {
    if (totalAttempted === 0) return 0;
    return Math.round((totalReady / totalAttempted) * 100);
}
