import Database from 'better-sqlite3';
import { mkdirSync, statSync } from 'node:fs';
import { dirname } from 'node:path';
import type { ModrinthClient } from '$lib/api/client';
import type { ModrinthVersion, ModrinthProject } from '$lib/api/types';
import type { DependencyCacheProvider } from './dependency.server';
import { resolveVersion } from './resolution.server';
import { resolveDependencies } from './dependency.server';
import { preFilterIncompatibleProjects } from './prefilter';
import { probeAlternatives as probeAlternativesFn } from './alternative-probe.server';
import { chunkArray } from '$lib/utils/array';
import {
    CACHE_TTL_VERSION,
    CACHE_TTL_PROJECT,
    CACHE_TTL_VERSION_OBJECT,
    CACHE_TTL_HARD,
    RESOLUTION_BATCH_SIZE,
    LOADER_AGNOSTIC_PROJECT_TYPES,
    CACHE_REVALIDATION_BATCH_SIZE,
    CACHE_REVALIDATION_MAX_ENTRIES,
    INTER_BATCH_DELAY_MS,
    RATE_LIMIT_SAFETY_MARGIN
} from '$lib/config/constants';
import {
    fromSerializableOptions,
    deserializeProjectTypes,
    type ResolutionCacheService,
    type ResolveRequest,
    type ResolveResult,
    type ProbeAlternativesRequest,
    type ProbeAlternativesResult,
    type CacheStats
} from './resolution-cache.types';
import type { ResolvedProject, ResolutionWarning, UnresolvedDependency } from './types';
import { logger, serializeError } from '$lib/server/logger';

const VPS_SQL_PARAM_BATCH_SIZE = 500;

const MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS version_cache (
    project_id   TEXT NOT NULL,
    game_version TEXT NOT NULL,
    loader       TEXT NOT NULL,
    resolved     INTEGER NOT NULL DEFAULT 0,
    data         TEXT,
    reason       TEXT,
    fetched_at   INTEGER NOT NULL,
    file_sha1    TEXT,
    PRIMARY KEY (project_id, game_version, loader)
);
CREATE TABLE IF NOT EXISTS project_cache (
    project_id TEXT PRIMARY KEY,
    data       TEXT NOT NULL,
    fetched_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS version_object_cache (
    version_id TEXT PRIMARY KEY,
    data       TEXT NOT NULL,
    fetched_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_version_cache_fetched ON version_cache(fetched_at);
CREATE INDEX IF NOT EXISTS idx_project_cache_fetched ON project_cache(fetched_at);
CREATE INDEX IF NOT EXISTS idx_version_object_fetched ON version_object_cache(fetched_at);
CREATE INDEX IF NOT EXISTS idx_version_cache_sha1 ON version_cache(file_sha1);
`;

let _db: Database.Database | null = null;

export function getDb(dbPath = 'data/resolution-cache.sqlite'): Database.Database {
    if (!_db) {
        mkdirSync(dirname(dbPath), { recursive: true });
        _db = new Database(dbPath);
        _db.pragma('journal_mode = WAL');
        _db.pragma('busy_timeout = 5000');
        _db.pragma('auto_vacuum = INCREMENTAL');
        _db.exec(MIGRATION_SQL);
    }
    return _db;
}

// =============================================================================
// Cache Service
// =============================================================================

export class SQLiteResolutionCache implements ResolutionCacheService {
    private db: Database.Database;

    constructor(
        private client: ModrinthClient,
        dbPath = 'data/resolution-cache.sqlite'
    ) {
        this.db = getDb(dbPath);
    }

    private effectiveLoader(project: ModrinthProject, loader: string): string {
        return LOADER_AGNOSTIC_PROJECT_TYPES.has(project.project_type) ? '*' : loader;
    }

    async resolve(request: ResolveRequest): Promise<ResolveResult> {
        const {
            projects,
            gameVersion,
            loader,
            options: serializableOptions,
            forceRefresh
        } = request;
        const options = fromSerializableOptions(serializableOptions);
        const now = Math.floor(Date.now() / 1000);
        const resolveStart = Date.now();

        const resolved: ResolvedProject[] = [];
        const warnings: ResolutionWarning[] = [];
        const unresolved: UnresolvedDependency[] = [];
        const cacheMisses: ModrinthProject[] = [];
        let sqliteHits = 0;

        // Phase 1: check SQLite cache
        const lookup = this.db.prepare(
            `SELECT * FROM version_cache
             WHERE project_id = ? AND game_version = ? AND loader = ?`
        );
        for (const project of projects) {
            if (options.excludedProjectIds.has(project.id)) continue;
            if (forceRefresh) {
                cacheMisses.push(project);
                continue;
            }
            const cacheLoader = this.effectiveLoader(project, loader);
            const row = lookup.get(project.id, gameVersion, cacheLoader) as
                | Record<string, unknown>
                | undefined;
            if (row && (row.fetched_at as number) + CACHE_TTL_VERSION > now) {
                sqliteHits++;
                if (row.resolved && row.data) {
                    resolved.push(JSON.parse(row.data as string));
                } else {
                    unresolved.push({
                        projectId: project.id,
                        requiredBy: 'collection',
                        reason: (row.reason as string) ?? 'No compatible version found'
                    });
                }
            } else {
                cacheMisses.push(project);
            }
        }

        // Phase 1.5: pre-filter cache misses that can't possibly match
        const { candidates: apiCandidates, pruned } = preFilterIncompatibleProjects(
            cacheMisses,
            gameVersion,
            loader,
            options.enableCrossLoaderFallback
        );
        unresolved.push(...pruned);

        // Phase 2: resolve cache misses via Modrinth API in rate-limit-safe chunks
        if (apiCandidates.length > 0) {
            const chunks = chunkArray(apiCandidates, RESOLUTION_BATCH_SIZE);
            const results: PromiseSettledResult<Awaited<ReturnType<typeof resolveVersion>>>[] = [];

            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                const state = this.client.getRateLimitState();
                if (state.remaining < RATE_LIMIT_SAFETY_MARGIN) {
                    const timeUntilReset = Math.max(0, state.resetAt - Date.now());
                    await new Promise((r) =>
                        setTimeout(r, Math.max(INTER_BATCH_DELAY_MS, timeUntilReset))
                    );
                }
                const chunkResults = await Promise.allSettled(
                    chunk.map((project) => resolveVersion(this.client, project, options))
                );
                results.push(...chunkResults);
            }

            // Process results + persist to SQLite
            const upsert = this.db.prepare(
                `INSERT OR REPLACE INTO version_cache
                 (project_id, game_version, loader, resolved, data, reason, fetched_at, file_sha1)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
            );

            const writeResults = this.db.transaction(() => {
                for (let i = 0; i < results.length; i++) {
                    const result = results[i];
                    const project = apiCandidates[i];
                    const cacheLoader = this.effectiveLoader(project, loader);

                    if (result.status === 'fulfilled' && result.value) {
                        resolved.push(result.value.resolved);
                        warnings.push(...result.value.warnings);
                        upsert.run(
                            project.id,
                            gameVersion,
                            cacheLoader,
                            1,
                            JSON.stringify(result.value.resolved),
                            null,
                            now,
                            result.value.resolved.fileHashes?.sha1 ?? null
                        );
                    } else if (result.status === 'fulfilled' && !result.value) {
                        unresolved.push({
                            projectId: project.id,
                            requiredBy: 'collection',
                            reason: 'No compatible version found'
                        });
                        upsert.run(
                            project.id,
                            gameVersion,
                            cacheLoader,
                            0,
                            null,
                            'No compatible version found',
                            now,
                            null
                        );
                    } else {
                        // API error — try stale fallback
                        const staleRow = this.db
                            .prepare(
                                'SELECT * FROM version_cache WHERE project_id = ? AND game_version = ? AND loader = ?'
                            )
                            .get(project.id, gameVersion, cacheLoader) as
                            | Record<string, unknown>
                            | undefined;

                        if (staleRow && (staleRow.fetched_at as number) + CACHE_TTL_HARD > now) {
                            if (staleRow.resolved && staleRow.data) {
                                resolved.push(JSON.parse(staleRow.data as string));
                                warnings.push({
                                    type: 'fallback-used',
                                    projectId: project.id,
                                    message: `${project.title}: served from stale cache due to API error`
                                });
                            } else {
                                unresolved.push({
                                    projectId: project.id,
                                    requiredBy: 'collection',
                                    reason:
                                        (staleRow.reason as string) ??
                                        'No compatible version found (stale cache)'
                                });
                            }
                        } else {
                            unresolved.push({
                                projectId: project.id,
                                requiredBy: 'collection',
                                reason: String((result as PromiseRejectedResult).reason)
                            });
                        }
                    }
                }
            });
            writeResults();
        }

        const resolveTimeMs = Date.now() - resolveStart;

        // Phase 3: dependency resolution
        const depStart = Date.now();
        const depCache = this.createDependencyCacheProvider(now);
        const depResult = options.includeDependencies
            ? await resolveDependencies(this.client, resolved, options, depCache)
            : { resolved: [], conflicts: [], warnings: [], unresolved: [] };
        const dependencyTimeMs = Date.now() - depStart;

        const mainIds = new Set(resolved.map((r) => r.projectId));
        const dedupedDeps = depResult.resolved.filter((d) => !mainIds.has(d.projectId));

        const cacheStats: CacheStats = {
            hotHits: 0,
            sqliteHits,
            misses: cacheMisses.length,
            totalProjects: projects.length,
            resolveTimeMs,
            dependencyTimeMs
        };

        return {
            resolved,
            dependencies: dedupedDeps,
            conflicts: depResult.conflicts,
            warnings: [...warnings, ...depResult.warnings],
            unresolved: [...unresolved, ...depResult.unresolved],
            cacheStats
        };
    }

    async probeAlternatives(request: ProbeAlternativesRequest): Promise<ProbeAlternativesResult> {
        const projectTypes = deserializeProjectTypes(request.projectTypes);
        return probeAlternativesFn(
            this.client,
            request.resolvedProjects,
            request.unresolvedProjectIds,
            request.gameVersion,
            request.loader,
            request.allGameVersions,
            request.excludeConfigs,
            projectTypes
        );
    }

    private createDependencyCacheProvider(now: number): DependencyCacheProvider {
        return {
            lookupVersionObjects: (ids: string[]) => {
                if (ids.length === 0) return { hits: [], misses: [] };
                const allRows: Record<string, unknown>[] = [];
                for (const chunk of chunkArray(ids, VPS_SQL_PARAM_BATCH_SIZE)) {
                    const placeholders = chunk.map(() => '?').join(', ');
                    allRows.push(
                        ...(this.db
                            .prepare(
                                `SELECT version_id, data, fetched_at FROM version_object_cache
                                 WHERE version_id IN (${placeholders})`
                            )
                            .all(...chunk) as Record<string, unknown>[])
                    );
                }
                const rowMap = new Map(allRows.map((r) => [r.version_id as string, r]));
                const hits: ModrinthVersion[] = [];
                const misses: string[] = [];
                for (const id of ids) {
                    const row = rowMap.get(id);
                    if (row && (row.fetched_at as number) + CACHE_TTL_VERSION_OBJECT > now) {
                        try {
                            hits.push(JSON.parse(row.data as string));
                        } catch {
                            misses.push(id);
                        }
                    } else {
                        misses.push(id);
                    }
                }
                return { hits, misses };
            },
            storeVersionObjects: (versions: ModrinthVersion[]) => {
                const ts = Math.floor(Date.now() / 1000);
                const stmt = this.db.prepare(
                    'INSERT OR REPLACE INTO version_object_cache (version_id, data, fetched_at) VALUES (?, ?, ?)'
                );
                this.db.transaction(() => {
                    for (const v of versions) stmt.run(v.id, JSON.stringify(v), ts);
                })();
            },
            lookupProjects: (ids: string[]) => {
                if (ids.length === 0) return { hits: [], misses: [] };
                const allRows: Record<string, unknown>[] = [];
                for (const chunk of chunkArray(ids, VPS_SQL_PARAM_BATCH_SIZE)) {
                    const placeholders = chunk.map(() => '?').join(', ');
                    allRows.push(
                        ...(this.db
                            .prepare(
                                `SELECT project_id, data, fetched_at FROM project_cache
                                 WHERE project_id IN (${placeholders})`
                            )
                            .all(...chunk) as Record<string, unknown>[])
                    );
                }
                const rowMap = new Map(allRows.map((r) => [r.project_id as string, r]));
                const hits: ModrinthProject[] = [];
                const misses: string[] = [];
                for (const id of ids) {
                    const row = rowMap.get(id);
                    if (row && (row.fetched_at as number) + CACHE_TTL_PROJECT > now) {
                        try {
                            hits.push(JSON.parse(row.data as string));
                        } catch {
                            misses.push(id);
                        }
                    } else {
                        misses.push(id);
                    }
                }
                return { hits, misses };
            },
            storeProjects: (projects: ModrinthProject[]) => {
                const ts = Math.floor(Date.now() / 1000);
                const stmt = this.db.prepare(
                    'INSERT OR REPLACE INTO project_cache (project_id, data, fetched_at) VALUES (?, ?, ?)'
                );
                this.db.transaction(() => {
                    for (const p of projects) stmt.run(p.id, JSON.stringify(p), ts);
                })();
            }
        };
    }
}

// =============================================================================
// Cleanup & Revalidation
// =============================================================================

export async function cleanupExpiredEntries(): Promise<void> {
    const db = getDb();
    const now = Math.floor(Date.now() / 1000);

    // Per-table TTL deletion (matches DO alarm handler)
    db.prepare('DELETE FROM version_cache WHERE fetched_at < ?').run(now - CACHE_TTL_VERSION);
    db.prepare('DELETE FROM project_cache WHERE fetched_at < ?').run(now - CACHE_TTL_PROJECT);
    db.prepare('DELETE FROM version_object_cache WHERE fetched_at < ?').run(
        now - CACHE_TTL_VERSION_OBJECT
    );

    // Reclaim freed pages
    db.pragma('incremental_vacuum');

    // Log database size for monitoring
    try {
        const { size } = statSync('data/resolution-cache.sqlite');
        logger.info('cache_cleanup', { databaseSizeBytes: size });
    } catch {
        /* file may not exist yet */
    }

    // Revalidation: check entries approaching TTL expiry
    await revalidateApproachingExpiry(db, now);
}

async function revalidateApproachingExpiry(db: Database.Database, now: number): Promise<void> {
    const threshold = now - Math.floor(CACHE_TTL_VERSION * 0.75);
    const rows = db
        .prepare(
            `SELECT file_sha1, fetched_at FROM version_cache
             WHERE resolved = 1 AND file_sha1 IS NOT NULL AND fetched_at < ?
             ORDER BY fetched_at ASC LIMIT ?`
        )
        .all(threshold, CACHE_REVALIDATION_MAX_ENTRIES) as {
        file_sha1: string;
        fetched_at: number;
    }[];

    if (rows.length === 0) return;

    const allHashes = rows.map((r) => r.file_sha1);
    const chunks = chunkArray(allHashes, CACHE_REVALIDATION_BATCH_SIZE);

    // Revalidation needs its own client — import lazily to avoid circular deps
    const { createModrinthClient } = await import('$lib/api/client');
    const client = createModrinthClient();

    for (const chunk of chunks) {
        try {
            const response = await client.requestVersion<Record<string, ModrinthVersion>>(
                'version_files/update',
                'v2',
                {
                    method: 'POST',
                    body: {
                        hashes: chunk,
                        algorithm: 'sha1'
                    }
                }
            );

            const returnedHashes = new Set(Object.keys(response));

            for (const hash of chunk) {
                if (returnedHashes.has(hash)) {
                    const returnedVersion = response[hash];
                    const returnedFile = returnedVersion.files.find((f) => f.hashes.sha1 === hash);
                    if (returnedFile) {
                        db.prepare(
                            'UPDATE version_cache SET fetched_at = ? WHERE file_sha1 = ?'
                        ).run(now, hash);
                    } else {
                        db.prepare('DELETE FROM version_cache WHERE file_sha1 = ?').run(hash);
                    }
                } else {
                    db.prepare('DELETE FROM version_cache WHERE file_sha1 = ?').run(hash);
                }
            }
        } catch (e) {
            logger.warn('revalidation_batch_failed', serializeError(e));
            break;
        }
    }

    if (allHashes.length > 0) {
        logger.info('revalidation', { entriesChecked: allHashes.length });
    }
}
