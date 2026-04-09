/**
 * Durable Object that caches Modrinth version resolution in SQLite.
 * Bundled separately by the post-build Vite plugin — not part of the
 * SvelteKit server bundle.
 */

/// <reference types="@cloudflare/workers-types" />

import { DurableObject } from 'cloudflare:workers';
import { logger, serializeError } from '$lib/server/logger';
import { resolveVersion } from '$lib/services/resolution.server';
import { resolveDependencies } from '$lib/services/dependency.server';
import type { DependencyCacheProvider } from '$lib/services/dependency.server';
import { ModrinthClient } from '$lib/api/client';
import { getEnvConfigFromPlatform } from '$lib/config/env.server';
import {
    CACHE_TTL_VERSION,
    CACHE_TTL_PROJECT,
    CACHE_TTL_VERSION_OBJECT,
    CACHE_TTL_TAG,
    CACHE_TTL_HARD,
    CACHE_ALARM_INTERVAL_MS,
    HOT_CACHE_MAX_ENTRIES,
    LOADER_AGNOSTIC_PROJECT_TYPES,
    CACHE_REVALIDATION_BATCH_SIZE,
    CACHE_REVALIDATION_MAX_ENTRIES,
    DO_MAX_PROJECTS_PER_REQUEST
} from '$lib/config/constants';
import { probeAlternatives as probeAlternativesFn } from '$lib/services/alternative-probe.server';
import {
    fromSerializableOptions,
    deserializeProjectTypes
} from '$lib/services/resolution-cache.types';
import type {
    ResolveRequest,
    ResolveResult,
    ProbeAlternativesRequest,
    ProbeAlternativesResult,
    CacheStats
} from '$lib/services/resolution-cache.types';
import type { ResolvedProject, ResolutionWarning, UnresolvedDependency } from '$lib/services/types';
import type { ModrinthProject, ModrinthVersion } from '$lib/api/types';

// =============================================================================
// Types for SQLite rows
// =============================================================================

interface VersionCacheRow extends Record<string, SqlStorageValue> {
    project_id: string;
    game_version: string;
    loader: string;
    resolved: number;
    data: string | null;
    reason: string | null;
    fetched_at: number;
    file_sha1: string | null;
}

interface HotCacheEntry {
    data: string;
    fetchedAt: number;
}

// =============================================================================
// SQL Statements
// =============================================================================

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

CREATE TABLE IF NOT EXISTS tag_cache (
    cache_key  TEXT PRIMARY KEY,
    data       TEXT NOT NULL,
    fetched_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_version_cache_fetched ON version_cache(fetched_at);
CREATE INDEX IF NOT EXISTS idx_project_cache_fetched ON project_cache(fetched_at);
CREATE INDEX IF NOT EXISTS idx_version_object_fetched ON version_object_cache(fetched_at);
CREATE INDEX IF NOT EXISTS idx_tag_cache_fetched ON tag_cache(fetched_at);
CREATE INDEX IF NOT EXISTS idx_version_cache_sha1 ON version_cache(file_sha1);
`;

// Idempotent column addition for existing tables created before file_sha1 was added
const MIGRATION_ADD_SHA1_COLUMN = `
ALTER TABLE version_cache ADD COLUMN file_sha1 TEXT;
`;

// =============================================================================
// Durable Object
// =============================================================================

export class ResolutionCache extends DurableObject {
    private sql: SqlStorage;
    private client: ModrinthClient;
    private hotCache = new Map<string, HotCacheEntry>();

    constructor(ctx: DurableObjectState, env: Record<string, unknown>) {
        super(ctx, env);
        this.sql = ctx.storage.sql;

        const config = getEnvConfigFromPlatform(env as Record<string, string | undefined>);
        this.client = new ModrinthClient({
            baseUrl: config.MODRINTH_API_URL,
            userAgent: config.MODRINTH_USER_AGENT,
            maxRequestsPerMinute: config.MAX_REQUESTS_PER_MINUTE,
            resetIntervalSeconds: config.RESET_INTERVAL_SECONDS,
            maxRetries: config.MAX_RETRIES,
            retryDelayMs: config.RETRY_DELAY_MS,
            retryBackoffStrategy: config.RETRY_BACKOFF_STRATEGY,
            fetchTimeoutMs: config.FETCH_TIMEOUT_MS
        });

        ctx.blockConcurrencyWhile(async () => {
            this.migrate();
            await this.ensureAlarm();
        });
    }

    // ─── Schema migration ────────────────────────────────────────────────

    private migrate(): void {
        this.sql.exec(MIGRATION_SQL);

        // Idempotent: add file_sha1 column if table existed before this migration
        try {
            this.sql.exec(MIGRATION_ADD_SHA1_COLUMN);
        } catch {
            // Column already exists — expected on subsequent starts
        }
    }

    // ─── Alarm management ────────────────────────────────────────────────

    private async ensureAlarm(): Promise<void> {
        const existing = await this.ctx.storage.getAlarm();
        if (!existing) {
            await this.ctx.storage.setAlarm(Date.now() + CACHE_ALARM_INTERVAL_MS);
        }
    }

    override async alarm(info?: AlarmInvocationInfo): Promise<void> {
        const now = Math.floor(Date.now() / 1000);

        try {
            this.sql.exec(
                'DELETE FROM version_cache WHERE fetched_at < ?',
                now - CACHE_TTL_VERSION
            );
            this.sql.exec(
                'DELETE FROM project_cache WHERE fetched_at < ?',
                now - CACHE_TTL_PROJECT
            );
            this.sql.exec(
                'DELETE FROM version_object_cache WHERE fetched_at < ?',
                now - CACHE_TTL_VERSION_OBJECT
            );
            this.sql.exec('DELETE FROM tag_cache WHERE fetched_at < ?', now - CACHE_TTL_TAG);
            this.hotCache.clear();
        } catch (e) {
            if (info && info.retryCount < 5) {
                throw e;
            }
            logger.error('alarm_cleanup_failed', serializeError(e));
        }

        // Batch re-validation: check entries approaching TTL expiry
        try {
            await this.revalidateApproachingExpiry(now);
        } catch (e) {
            logger.error('revalidation_failed', serializeError(e));
        }

        logger.info('alarm_cleanup', { databaseSizeBytes: this.sql.databaseSize });
        await this.ctx.storage.setAlarm(Date.now() + CACHE_ALARM_INTERVAL_MS);
    }

    // ─── Batch re-validation ─────────────────────────────────────────────

    private async revalidateApproachingExpiry(now: number): Promise<void> {
        // Find resolved entries at 75%+ of their TTL via the indexed file_sha1 column
        const threshold = now - Math.floor(CACHE_TTL_VERSION * 0.75);
        const rows = this.sql
            .exec<{ file_sha1: string; fetched_at: number }>(
                `SELECT file_sha1, fetched_at FROM version_cache
                 WHERE resolved = 1 AND file_sha1 IS NOT NULL AND fetched_at < ?
                 ORDER BY fetched_at ASC LIMIT ?`,
                threshold,
                CACHE_REVALIDATION_MAX_ENTRIES
            )
            .toArray();

        if (rows.length === 0) return;

        const allHashes = rows.map((r) => r.file_sha1);

        // Process in batches
        const { chunkArray } = await import('$lib/utils/array');
        const chunks = chunkArray(allHashes, CACHE_REVALIDATION_BATCH_SIZE);

        for (const chunk of chunks) {
            try {
                const response = await this.client.requestVersion<Record<string, ModrinthVersion>>(
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
                        const returnedFile = returnedVersion.files.find(
                            (f) => f.hashes.sha1 === hash
                        );
                        if (returnedFile) {
                            // Same file still exists — extend cache TTL
                            this.sql.exec(
                                'UPDATE version_cache SET fetched_at = ? WHERE file_sha1 = ?',
                                now,
                                hash
                            );
                        } else {
                            // File hash changed — invalidate
                            this.sql.exec('DELETE FROM version_cache WHERE file_sha1 = ?', hash);
                        }
                    } else {
                        // Hash missing from response — file removed, invalidate
                        this.sql.exec('DELETE FROM version_cache WHERE file_sha1 = ?', hash);
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

    // ─── Hot cache helpers ───────────────────────────────────────────────

    private hotGet(key: string): HotCacheEntry | undefined {
        return this.hotCache.get(key);
    }

    private hotSet(key: string, data: string, fetchedAt: number): void {
        this.hotCache.set(key, { data, fetchedAt });

        const excess = this.hotCache.size - HOT_CACHE_MAX_ENTRIES;
        if (excess > 0) {
            const entries = [...this.hotCache.entries()].sort(
                (a, b) => a[1].fetchedAt - b[1].fetchedAt
            );
            for (let i = 0; i < excess; i++) {
                this.hotCache.delete(entries[i][0]);
            }
        }
    }

    // ─── Cache key ───────────────────────────────────────────────────────

    // Colon-delimited key is safe: Modrinth IDs are base62, MC versions use
    // dots/dashes, and loader slugs are lowercase alpha — none contain colons.
    private versionCacheKey(projectId: string, gameVersion: string, loader: string): string {
        return `v:${projectId}:${gameVersion}:${loader}`;
    }

    private effectiveLoader(project: ModrinthProject, loader: string): string {
        return LOADER_AGNOSTIC_PROJECT_TYPES.has(project.project_type) ? '*' : loader;
    }

    // ─── Dependency cache provider (version objects + projects) ────────

    /**
     * Builds a parameterized IN clause: `(?, ?, ?)` with one placeholder per id.
     * SqlStorage binds each `?` individually — no array binding support — so we
     * generate the right number of placeholders and spread the ids as args.
     */
    private inClause(ids: string[]): { placeholders: string; args: string[] } {
        return {
            placeholders: ids.map(() => '?').join(', '),
            args: ids
        };
    }

    private createDependencyCacheProvider(): DependencyCacheProvider {
        const now = Math.floor(Date.now() / 1000);
        return {
            lookupVersionObjects: (ids: string[]) => {
                if (ids.length === 0) return { hits: [], misses: [] };

                const { placeholders, args } = this.inClause(ids);
                const rows = this.sql
                    .exec<{ version_id: string; data: string; fetched_at: number }>(
                        `SELECT version_id, data, fetched_at FROM version_object_cache
                         WHERE version_id IN (${placeholders})`,
                        ...args
                    )
                    .toArray();

                const rowMap = new Map(rows.map((r) => [r.version_id, r]));
                const hits: ModrinthVersion[] = [];
                const misses: string[] = [];

                for (const id of ids) {
                    const row = rowMap.get(id);
                    if (row && row.fetched_at + CACHE_TTL_VERSION_OBJECT > now) {
                        try {
                            hits.push(JSON.parse(row.data) as ModrinthVersion);
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
                for (const v of versions) {
                    this.sql.exec(
                        'INSERT OR REPLACE INTO version_object_cache (version_id, data, fetched_at) VALUES (?, ?, ?)',
                        v.id,
                        JSON.stringify(v),
                        now
                    );
                }
            },
            lookupProjects: (ids: string[]) => {
                if (ids.length === 0) return { hits: [], misses: [] };

                const { placeholders, args } = this.inClause(ids);
                const rows = this.sql
                    .exec<{ project_id: string; data: string; fetched_at: number }>(
                        `SELECT project_id, data, fetched_at FROM project_cache
                         WHERE project_id IN (${placeholders})`,
                        ...args
                    )
                    .toArray();

                const rowMap = new Map(rows.map((r) => [r.project_id, r]));
                const hits: ModrinthProject[] = [];
                const misses: string[] = [];

                for (const id of ids) {
                    const row = rowMap.get(id);
                    if (row && row.fetched_at + CACHE_TTL_PROJECT > now) {
                        try {
                            hits.push(JSON.parse(row.data) as ModrinthProject);
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
                for (const p of projects) {
                    this.sql.exec(
                        'INSERT OR REPLACE INTO project_cache (project_id, data, fetched_at) VALUES (?, ?, ?)',
                        p.id,
                        JSON.stringify(p),
                        now
                    );
                }
            }
        };
    }

    // ─── Cache lookup (3-tier) ───────────────────────────────────────────

    private lookupVersionCache(
        projectId: string,
        gameVersion: string,
        loader: string,
        forceRefresh: boolean
    ):
        | {
              hit: true;
              tier: 'hot' | 'sqlite';
              resolved: ResolvedProject | null;
              reason: string | null;
          }
        | { hit: false } {
        if (forceRefresh) return { hit: false };

        const now = Math.floor(Date.now() / 1000);
        const key = this.versionCacheKey(projectId, gameVersion, loader);

        // Tier 1: hot cache
        const hot = this.hotGet(key);
        if (hot && hot.fetchedAt + CACHE_TTL_VERSION > now) {
            try {
                const parsed = JSON.parse(hot.data) as VersionCacheRow;
                return {
                    hit: true,
                    tier: 'hot',
                    resolved:
                        parsed.resolved && parsed.data
                            ? (JSON.parse(parsed.data) as ResolvedProject)
                            : null,
                    reason: parsed.reason
                };
            } catch {
                this.hotCache.delete(key);
                return { hit: false };
            }
        }

        // Tier 2: SQLite
        const rows = this.sql
            .exec<VersionCacheRow>(
                'SELECT * FROM version_cache WHERE project_id = ? AND game_version = ? AND loader = ?',
                projectId,
                gameVersion,
                loader
            )
            .toArray();

        if (rows.length === 0) return { hit: false };

        const row = rows[0];

        if (row.fetched_at + CACHE_TTL_VERSION > now) {
            try {
                // Fresh — promote to hot cache
                this.hotSet(key, JSON.stringify(row), row.fetched_at);
                return {
                    hit: true,
                    tier: 'sqlite',
                    resolved:
                        row.resolved && row.data ? (JSON.parse(row.data) as ResolvedProject) : null,
                    reason: row.reason
                };
            } catch {
                this.hotCache.delete(key);
                return { hit: false };
            }
        }

        // Stale but within hard TTL — will be used as fallback if API fails
        if (row.fetched_at + CACHE_TTL_HARD > now) {
            return { hit: false };
        }

        return { hit: false };
    }

    // ─── Write cache entry ───────────────────────────────────────────────

    /** SQL-only write — safe to call inside transactionSync */
    private writeVersionCacheSql(
        projectId: string,
        gameVersion: string,
        loader: string,
        resolvedProject: ResolvedProject | null,
        reason: string | null
    ): { row: VersionCacheRow; now: number } {
        const now = Math.floor(Date.now() / 1000);
        const isResolved = resolvedProject ? 1 : 0;
        const data = resolvedProject ? JSON.stringify(resolvedProject) : null;
        const fileSha1 = resolvedProject?.fileHashes?.sha1 ?? null;

        this.sql.exec(
            `INSERT OR REPLACE INTO version_cache (project_id, game_version, loader, resolved, data, reason, fetched_at, file_sha1)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            projectId,
            gameVersion,
            loader,
            isResolved,
            data,
            reason,
            now,
            fileSha1
        );

        return {
            row: {
                project_id: projectId,
                game_version: gameVersion,
                loader,
                resolved: isResolved,
                data,
                reason,
                fetched_at: now,
                file_sha1: fileSha1
            },
            now
        };
    }

    // ─── Stale fallback (hard TTL) ───────────────────────────────────────

    private getStaleEntry(
        projectId: string,
        gameVersion: string,
        loader: string
    ): { resolved: ResolvedProject | null; reason: string | null } | null {
        const now = Math.floor(Date.now() / 1000);
        const rows = this.sql
            .exec<VersionCacheRow>(
                'SELECT * FROM version_cache WHERE project_id = ? AND game_version = ? AND loader = ?',
                projectId,
                gameVersion,
                loader
            )
            .toArray();

        if (rows.length === 0) return null;
        const row = rows[0];

        if (row.fetched_at + CACHE_TTL_HARD > now) {
            try {
                return {
                    resolved:
                        row.resolved && row.data ? (JSON.parse(row.data) as ResolvedProject) : null,
                    reason: row.reason
                };
            } catch {
                return null;
            }
        }

        return null;
    }

    // ─── Main RPC method ─────────────────────────────────────────────────

    async resolve(request: ResolveRequest): Promise<ResolveResult> {
        const {
            projects,
            gameVersion,
            loader,
            options: serializableOptions,
            forceRefresh = false
        } = request;

        if (projects.length > DO_MAX_PROJECTS_PER_REQUEST) {
            throw new Error(`Request exceeds maximum of ${DO_MAX_PROJECTS_PER_REQUEST} projects`);
        }

        const options = fromSerializableOptions(serializableOptions);

        const resolved: ResolvedProject[] = [];
        const warnings: ResolutionWarning[] = [];
        const unresolved: UnresolvedDependency[] = [];
        const cacheMisses: ModrinthProject[] = [];
        const resolveStart = Date.now();
        let hotHits = 0;
        let sqliteHits = 0;

        // Phase 1: check cache for each project
        for (const project of projects) {
            if (options.excludedProjectIds.has(project.id)) continue;

            const cacheLoader = this.effectiveLoader(project, loader);
            const cached = this.lookupVersionCache(
                project.id,
                gameVersion,
                cacheLoader,
                forceRefresh
            );
            if (cached.hit) {
                if (cached.tier === 'hot') hotHits++;
                else sqliteHits++;
                if (cached.resolved) {
                    resolved.push(cached.resolved);
                } else {
                    unresolved.push({
                        projectId: project.id,
                        requiredBy: 'collection',
                        reason: cached.reason ?? 'No compatible version found'
                    });
                }
            } else {
                cacheMisses.push(project);
            }
        }

        // Phase 2: resolve cache misses via Modrinth API
        if (cacheMisses.length > 0) {
            const results = await Promise.allSettled(
                cacheMisses.map((project) => resolveVersion(this.client, project, options))
            );

            const hotCacheUpdates: Array<{ key: string; data: string; fetchedAt: number }> = [];
            let transactionFailed = false;

            // Collect results regardless of transaction outcome
            for (let i = 0; i < results.length; i++) {
                const result = results[i];
                const project = cacheMisses[i];
                const cacheLoader = this.effectiveLoader(project, loader);

                if (result.status === 'fulfilled' && result.value) {
                    resolved.push(result.value.resolved);
                    warnings.push(...result.value.warnings);
                } else if (result.status === 'fulfilled' && !result.value) {
                    unresolved.push({
                        projectId: project.id,
                        requiredBy: 'collection',
                        reason: 'No compatible version found'
                    });
                } else {
                    // API error — try stale cache before giving up
                    const stale = this.getStaleEntry(project.id, gameVersion, cacheLoader);
                    if (stale) {
                        if (stale.resolved) {
                            resolved.push(stale.resolved);
                            warnings.push({
                                type: 'fallback-used',
                                projectId: project.id,
                                message: `${project.title}: served from stale cache due to API error`
                            });
                        } else {
                            unresolved.push({
                                projectId: project.id,
                                requiredBy: 'collection',
                                reason: stale.reason ?? 'No compatible version found (stale cache)'
                            });
                        }
                    } else {
                        const reason = String((result as PromiseRejectedResult).reason);
                        unresolved.push({
                            projectId: project.id,
                            requiredBy: 'collection',
                            reason
                        });
                    }
                }
            }

            // Persist to SQLite — results are valid even if this fails
            try {
                this.ctx.storage.transactionSync(() => {
                    for (let i = 0; i < results.length; i++) {
                        const result = results[i];
                        if (result.status !== 'fulfilled') continue;

                        const project = cacheMisses[i];
                        const cacheLoader = this.effectiveLoader(project, loader);

                        const { row, now } = this.writeVersionCacheSql(
                            project.id,
                            gameVersion,
                            cacheLoader,
                            result.value?.resolved ?? null,
                            result.value ? null : 'No compatible version found'
                        );
                        hotCacheUpdates.push({
                            key: this.versionCacheKey(project.id, gameVersion, cacheLoader),
                            data: JSON.stringify(row),
                            fetchedAt: now
                        });
                    }
                });
            } catch (e) {
                transactionFailed = true;
                logger.error('sqlite_transaction_failed', serializeError(e));
            }

            if (!transactionFailed) {
                for (const update of hotCacheUpdates) {
                    this.hotSet(update.key, update.data, update.fetchedAt);
                }
            }
        }

        const resolveTimeMs = Date.now() - resolveStart;

        // Phase 3: dependency resolution (BFS inside DO — cache provider avoids redundant fetches)
        const depStart = Date.now();
        const depCache = this.createDependencyCacheProvider();
        const depResult = options.includeDependencies
            ? await resolveDependencies(this.client, resolved, options, depCache)
            : { resolved: [], conflicts: [], warnings: [], unresolved: [] };
        const dependencyTimeMs = Date.now() - depStart;

        const mainIds = new Set(resolved.map((r) => r.projectId));
        const dedupedDeps = depResult.resolved.filter((d) => !mainIds.has(d.projectId));

        const cacheStats: CacheStats = {
            hotHits,
            sqliteHits,
            misses: cacheMisses.length,
            totalProjects: projects.length,
            resolveTimeMs,
            dependencyTimeMs
        };

        logger.info('do_resolve', { ...cacheStats });

        return {
            resolved,
            dependencies: dedupedDeps,
            conflicts: depResult.conflicts,
            warnings: [...warnings, ...depResult.warnings],
            unresolved: [...unresolved, ...depResult.unresolved],
            cacheStats
        };
    }

    // ─── Advisor RPC ─────────────────────────────────────────────────────

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
}
