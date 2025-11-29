/**
 * Server-only client creation utilities
 * This file can only be imported in server-side code
 */

import { getEnvConfigFromPlatform } from '$lib/config/env.server';
import { ModrinthClient } from './client';

/**
 * Create a Modrinth client from SvelteKit platform bindings
 * Uses Zod-validated environment configuration
 *
 * @param platform - SvelteKit platform object (from RequestEvent or ServerLoadEvent)
 * @returns Configured ModrinthClient instance
 *
 * @example
 * ```typescript
 * // In +server.ts
 * export const GET: RequestHandler = async ({ platform }) => {
 *   const client = createClientFromPlatform(platform);
 *   const data = await client.request('tag/game_version');
 *   return json(data);
 * };
 * ```
 */
export function createClientFromPlatform(platform?: App.Platform): ModrinthClient {
	// Cast platform.env to the expected Record type
	// The App.Platform interface defines specific properties, but we need a generic Record for Zod parsing
	const platformEnv = platform?.env as Record<string, string | undefined> | undefined;
	const config = getEnvConfigFromPlatform(platformEnv);

	return new ModrinthClient({
		baseUrl: config.MODRINTH_API_URL,
		userAgent: config.MODRINTH_USER_AGENT,
		maxRequestsPerMinute: config.MAX_REQUESTS_PER_MINUTE,
		resetIntervalSeconds: config.RESET_INTERVAL_SECONDS,
		maxRetries: config.MAX_RETRIES,
		retryDelayMs: config.RETRY_DELAY_MS,
		retryBackoffStrategy: config.RETRY_BACKOFF_STRATEGY
	});
}
