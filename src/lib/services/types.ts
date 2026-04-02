import type { ProjectType, SideRequirement, VersionType, DependencyType } from '$lib/api/types';

// =============================================================================
// Side Classification
// =============================================================================

export type SideClassification = 'client' | 'server' | 'both';

// =============================================================================
// Resolution Options & Results
// =============================================================================

export interface ResolutionOptions {
    gameVersion: string;
    loader: string;
    /** Master toggle: when false, skip dependency resolution entirely */
    includeDependencies: boolean;
    /** When true, also include optional dependencies */
    includeOptionalDeps: boolean;
    enableCrossLoaderFallback: boolean;
    allowAlphaBeta: boolean;
    excludedProjectIds: Set<string>;
}

export interface ResolvedProject {
    projectId: string;
    projectSlug: string;
    projectTitle: string;
    projectDescription: string;
    projectType: ProjectType;
    iconUrl?: string;

    versionId: string;
    versionNumber: string;
    versionType: VersionType;
    fileName: string;
    fileUrl: string;
    fileSize: number;
    fileHashes: { sha1: string; sha512: string };

    loaders: string[];
    dependencyCount: number;

    side: SideClassification;
    folder: string;
    clientSide: SideRequirement;
    serverSide: SideRequirement;

    /** Set when this project was resolved as a dependency of another */
    dependencyOf?: string;
    dependencyType?: DependencyType;
    dependencyDepth?: number;

    /** True if the resolved version came from a fallback loader (e.g. Quilt→Fabric) */
    usedFallbackLoader: boolean;
    /** The actual loader the resolved version targets, if different from requested */
    resolvedLoader?: string;

    // Tier 2
    color?: number;
    categories?: string[];
    downloadCount?: number;
    licenseName?: string;
    licenseUrl?: string;
    lastUpdated?: string;

    // Tier 3
    changelog?: string;
    gallery?: Array<{ url: string; featured: boolean; title?: string; description?: string }>;
}

// =============================================================================
// Collection Grouping (for review page)
// =============================================================================

export interface CollectionGroup {
    id: string;
    name: string;
    iconUrl?: string;
    color?: string;
    totalProjectCount: number;
    resolved: ResolvedProject[];
    /** projectId → names of other collections containing it */
    alsoInMap: Record<string, string[]>;
}

// =============================================================================
// Dependencies
// =============================================================================

export interface DependencyNode {
    projectId: string;
    /** The version_id pinned by the parent, if any */
    versionId?: string;
    dependencyType: DependencyType;
    requiredBy: string;
    depth: number;
    resolved?: ResolvedProject;
}

export interface DependencyResult {
    resolved: ResolvedProject[];
    conflicts: ConflictEntry[];
    warnings: ResolutionWarning[];
    unresolved: UnresolvedDependency[];
}

// =============================================================================
// Conflicts & Warnings
// =============================================================================

export interface ConflictEntry {
    projectId: string;
    conflictsWith: string;
    declaredBy: string;
}

export type ResolutionWarningType =
    | 'no-compatible-version'
    | 'depth-exceeded'
    | 'cycle'
    | 'fallback-used'
    | 'alpha-beta-version'
    | 'dependency-not-found';

export interface ResolutionWarning {
    type: ResolutionWarningType;
    projectId: string;
    message: string;
}

export interface UnresolvedDependency {
    projectId: string;
    projectTitle?: string;
    projectDescription?: string;
    projectIconUrl?: string;
    requiredBy: string;
    reason: string;
}

// =============================================================================
// Full Resolution Result
// =============================================================================

export interface ResolutionStats {
    totalProjects: number;
    resolvedCount: number;
    unresolvedCount: number;
    dependencyCount: number;
    conflictCount: number;
    warningCount: number;
    totalDownloadSize: number;
}

export interface ResolutionResult {
    resolved: ResolvedProject[];
    dependencies: ResolvedProject[];
    conflicts: ConflictEntry[];
    warnings: ResolutionWarning[];
    unresolved: UnresolvedDependency[];
    stats: ResolutionStats;
}
