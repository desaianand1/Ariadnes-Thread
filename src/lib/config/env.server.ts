/**
 * Server-side environment configuration with Zod validation
 * This file should only be imported in server-side code (+server.ts, +page.server.ts, etc.)
 */

import { z } from 'zod';
import { env } from '$env/dynamic/private';

/**
 * Retry backoff strategy options
 */
export type RetryBackoffStrategy = 'exponential' | 'linear' | 'fixed';

/**
 * Zod schema for environment variables validation
 */
const envSchema = z.object({
	// Modrinth API Configuration
	MODRINTH_API_URL: z.string().url().default('https://api.modrinth.com'),
	MODRINTH_USER_AGENT: z.string().min(1).default('AriadnesThread/1.0.0'),

	// Rate Limiting
	MAX_REQUESTS_PER_MINUTE: z.coerce.number().int().positive().max(500).default(300),
	RESET_INTERVAL_SECONDS: z.coerce.number().int().positive().max(300).default(60),

	// Retry Configuration
	MAX_RETRIES: z.coerce.number().int().positive().max(10).default(3),
	RETRY_DELAY_MS: z.coerce.number().int().positive().max(10000).default(1000),
	RETRY_BACKOFF_STRATEGY: z
		.enum(['exponential', 'linear', 'fixed'])
		.default('exponential') as z.ZodType<RetryBackoffStrategy>,

	// Download Configuration
	MAX_CONCURRENT_DOWNLOADS: z.coerce.number().int().positive().max(10).default(5)
});

/**
 * Parsed environment configuration type
 */
export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Parse and validate environment variables
 * Returns validated config or throws an error with details
 */
function parseEnv(): EnvConfig {
	const result = envSchema.safeParse(env);

	if (!result.success) {
		const formatted = result.error.format();
		console.error('Environment validation failed:', formatted);
		throw new Error(`Invalid environment configuration: ${JSON.stringify(formatted, null, 2)}`);
	}

	return result.data;
}

/**
 * Validated environment configuration
 * Lazily parsed on first access to avoid issues during module initialization
 */
let _config: EnvConfig | null = null;

export function getEnvConfig(): EnvConfig {
	if (!_config) {
		_config = parseEnv();
	}
	return _config;
}

/**
 * Get environment config from Cloudflare platform bindings
 * Use this in request handlers that have access to platform.env
 */
export function getEnvConfigFromPlatform(
	platformEnv: Record<string, string | undefined> | undefined
): EnvConfig {
	if (!platformEnv) {
		// Fallback to SvelteKit's $env/dynamic/private
		return getEnvConfig();
	}

	const result = envSchema.safeParse(platformEnv);

	if (!result.success) {
		console.warn('Platform env validation failed, falling back to default env');
		return getEnvConfig();
	}

	return result.data;
}

/**
 * Default configuration values (for reference)
 */
export const DEFAULT_CONFIG: Readonly<EnvConfig> = Object.freeze({
	MODRINTH_API_URL: 'https://api.modrinth.com',
	MODRINTH_USER_AGENT: 'AriadnesThread/1.0.0',
	MAX_REQUESTS_PER_MINUTE: 300,
	RESET_INTERVAL_SECONDS: 60,
	MAX_RETRIES: 3,
	RETRY_DELAY_MS: 1000,
	RETRY_BACKOFF_STRATEGY: 'exponential',
	MAX_CONCURRENT_DOWNLOADS: 5
});
