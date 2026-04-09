import type {
    ResolvedProject,
    ResolutionOptions,
    ConflictEntry,
    ResolutionWarning,
    UnresolvedDependency,
    AlternativeProbe,
    ModAvailability
} from './types';
import type { ModrinthProject, ModrinthGameVersion } from '$lib/api/types';
import type { ProbeConfig } from './alternative-probe.server';

// =============================================================================
// Serializable Options (Set<string> → string[] for RPC boundary)
// =============================================================================

export interface SerializableResolutionOptions {
    gameVersion: string;
    loader: string;
    includeDependencies: boolean;
    includeOptionalDeps: boolean;
    enableCrossLoaderFallback: boolean;
    allowAlphaBeta: boolean;
    excludedProjectIds: string[];
}

export function toSerializableOptions(options: ResolutionOptions): SerializableResolutionOptions {
    return {
        gameVersion: options.gameVersion,
        loader: options.loader,
        includeDependencies: options.includeDependencies,
        includeOptionalDeps: options.includeOptionalDeps,
        enableCrossLoaderFallback: options.enableCrossLoaderFallback,
        allowAlphaBeta: options.allowAlphaBeta,
        excludedProjectIds: Array.from(options.excludedProjectIds)
    };
}

export function fromSerializableOptions(options: SerializableResolutionOptions): ResolutionOptions {
    return {
        gameVersion: options.gameVersion,
        loader: options.loader,
        includeDependencies: options.includeDependencies,
        includeOptionalDeps: options.includeOptionalDeps,
        enableCrossLoaderFallback: options.enableCrossLoaderFallback,
        allowAlphaBeta: options.allowAlphaBeta,
        excludedProjectIds: new Set(options.excludedProjectIds)
    };
}

// =============================================================================
// Shared deserialization helpers
// =============================================================================

export function deserializeProjectTypes(
    projectTypes: Record<string, string> | undefined
): Map<string, string> | undefined {
    return projectTypes ? new Map(Object.entries(projectTypes)) : undefined;
}

// =============================================================================
// RPC Contract
// =============================================================================

export interface ResolveRequest {
    projects: ModrinthProject[];
    gameVersion: string;
    loader: string;
    options: SerializableResolutionOptions;
    forceRefresh?: boolean;
}

export interface ResolveResult {
    resolved: ResolvedProject[];
    dependencies: ResolvedProject[];
    conflicts: ConflictEntry[];
    warnings: ResolutionWarning[];
    unresolved: UnresolvedDependency[];
    cacheStats?: CacheStats;
}

// =============================================================================
// Advisor RPC Contract
// =============================================================================

export interface ProbeAlternativesRequest {
    resolvedProjects: ResolvedProject[];
    unresolvedProjectIds: string[];
    gameVersion: string;
    loader: string;
    allGameVersions: ModrinthGameVersion[];
    excludeConfigs?: ProbeConfig[];
    projectTypes?: Record<string, string>;
}

export interface ProbeAlternativesResult {
    alternatives: AlternativeProbe[];
    modAvailability: Record<string, ModAvailability>;
}

// =============================================================================
// Cache Stats (structured logging)
// =============================================================================

export interface CacheStats {
    hotHits: number;
    sqliteHits: number;
    misses: number;
    totalProjects: number;
    resolveTimeMs: number;
    dependencyTimeMs: number;
}

// =============================================================================
// Service Interface (platform portability)
// =============================================================================

export interface ResolutionCacheService {
    resolve(request: ResolveRequest): Promise<ResolveResult>;
    probeAlternatives(request: ProbeAlternativesRequest): Promise<ProbeAlternativesResult>;
}
