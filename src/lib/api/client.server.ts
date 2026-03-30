/**
 * Server-only client creation utilities
 * This file can only be imported in server-side code
 */

import { getEnvConfigFromPlatform } from '$lib/config/env.server';
import { ModrinthClient } from './client';

/**
 * Module-level singleton so all requests in the same process share
 * rate-limit state. In Cloudflare Workers each isolate is short-lived
 * so this is effectively per-request, but in Node dev mode it prevents
 * concurrent requests from each thinking they have a full quota.
 */
let _sharedClient: ModrinthClient | null = null;

export function createClientFromPlatform(platform?: App.Platform): ModrinthClient {
    if (_sharedClient) return _sharedClient;

    const platformEnv = platform?.env as Record<string, string | undefined> | undefined;
    const config = getEnvConfigFromPlatform(platformEnv);

    _sharedClient = new ModrinthClient({
        baseUrl: config.MODRINTH_API_URL,
        userAgent: config.MODRINTH_USER_AGENT,
        maxRequestsPerMinute: config.MAX_REQUESTS_PER_MINUTE,
        resetIntervalSeconds: config.RESET_INTERVAL_SECONDS,
        maxRetries: config.MAX_RETRIES,
        retryDelayMs: config.RETRY_DELAY_MS,
        retryBackoffStrategy: config.RETRY_BACKOFF_STRATEGY,
        fetchTimeoutMs: config.FETCH_TIMEOUT_MS
    });

    return _sharedClient;
}
