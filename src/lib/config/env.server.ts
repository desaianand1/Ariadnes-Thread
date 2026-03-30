/**
 * Server-side environment configuration with Zod validation
 * This file should only be imported in server-side code (+server.ts, +page.server.ts, etc.)
 */

import { z } from 'zod';
import { env } from '$env/dynamic/private';
import { siteConfig } from './site';
import { APP_VERSION, MAX_RETRIES, RETRY_DELAY_MS, MAX_CONCURRENT_DOWNLOADS } from './constants';

/**
 * Retry backoff strategy options
 */
export type RetryBackoffStrategy = 'exponential' | 'linear' | 'fixed';

/**
 * Zod schema for environment variables validation
 */
const envSchema = z.object({
    // Modrinth API Configuration
    MODRINTH_API_URL: z.url().default('https://api.modrinth.com'),
    MODRINTH_USER_AGENT: z.string().min(1).default(`${siteConfig.shortName}/${APP_VERSION}`),

    // Rate Limiting
    MAX_REQUESTS_PER_MINUTE: z.coerce.number().int().positive().max(500).default(300),
    RESET_INTERVAL_SECONDS: z.coerce.number().int().positive().max(300).default(60),

    // Retry Configuration
    MAX_RETRIES: z.coerce.number().int().positive().max(10).default(MAX_RETRIES),
    RETRY_DELAY_MS: z.coerce.number().int().positive().max(10000).default(RETRY_DELAY_MS),
    RETRY_BACKOFF_STRATEGY: z
        .enum(['exponential', 'linear', 'fixed'])
        .default('exponential') as z.ZodType<RetryBackoffStrategy>,

    // Download Configuration
    MAX_CONCURRENT_DOWNLOADS: z.coerce
        .number()
        .int()
        .positive()
        .max(10)
        .default(MAX_CONCURRENT_DOWNLOADS),

    // Network
    FETCH_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),

    // Optional services
    RESEND_API_KEY: z.string().optional()
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
        console.error('Environment validation failed:', result.error.format());
        throw new Error('Invalid server configuration');
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
        return getEnvConfig();
    }

    const result = envSchema.safeParse(platformEnv);

    if (!result.success) {
        console.warn('Platform env validation failed, falling back to default env');
        return getEnvConfig();
    }

    return result.data;
}
