/**
 * Modrinth API Client with v3/v2 fallback, rate limiting, and retry logic
 */

import { ClientError, ServerError, RateLimitError, NetworkError, isRetryableError } from './error';
import type { ModrinthAPIVersion } from './types';
import type { RetryBackoffStrategy } from '$lib/config/env.server';

/**
 * API Client configuration
 */
export interface APIClientConfig {
    baseUrl: string;
    userAgent: string;
    maxRequestsPerMinute: number;
    resetIntervalSeconds: number;
    maxRetries: number;
    retryDelayMs: number;
    retryBackoffStrategy: RetryBackoffStrategy;
    fetchTimeoutMs: number;
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: APIClientConfig = {
    baseUrl: 'https://api.modrinth.com',
    userAgent: 'AriadnesThread/1.0.0',
    maxRequestsPerMinute: 300,
    resetIntervalSeconds: 60,
    maxRetries: 3,
    retryDelayMs: 1000,
    retryBackoffStrategy: 'exponential',
    fetchTimeoutMs: 30_000
};

/**
 * Request options for the client
 */
export interface RequestOptions {
    preferredVersion?: ModrinthAPIVersion;
    pathParams?: string[];
    queryParams?: Record<string, string>;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    body?: unknown;
}

/**
 * Modrinth API Client
 *
 * Features:
 * - Automatic v3 → v2 fallback for endpoints not available in v3
 * - Rate limiting with request tracking
 * - Configurable retry logic with exponential/linear/fixed backoff
 * - Proper error classification
 */
export class ModrinthClient {
    private config: APIClientConfig;
    private remainingRequests: number;
    private lastResetTime: number;
    private requestQueue: Promise<void> = Promise.resolve();

    constructor(config: Partial<APIClientConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.remainingRequests = this.config.maxRequestsPerMinute;
        this.lastResetTime = Date.now();
    }

    /**
     * Makes a request with automatic v3 → v2 fallback
     */
    async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
        const {
            preferredVersion = 'v3',
            pathParams = [],
            queryParams = {},
            method = 'GET',
            body
        } = options;

        // Try preferred version first
        try {
            return await this.makeRequest<T>(
                endpoint,
                preferredVersion,
                pathParams,
                queryParams,
                method,
                body
            );
        } catch (error) {
            // Fallback to v2 on specific errors
            if (this.shouldFallbackToV2(error, preferredVersion)) {
                console.warn(`${preferredVersion} API failed for ${endpoint}, falling back to v2`);
                return await this.makeRequest<T>(
                    endpoint,
                    'v2',
                    pathParams,
                    queryParams,
                    method,
                    body
                );
            }
            throw error;
        }
    }

    /**
     * Force a specific API version (no fallback)
     */
    async requestVersion<T>(
        endpoint: string,
        version: ModrinthAPIVersion,
        options: Omit<RequestOptions, 'preferredVersion'> = {}
    ): Promise<T> {
        const { pathParams = [], queryParams = {}, method = 'GET', body } = options;
        return this.makeRequest<T>(endpoint, version, pathParams, queryParams, method, body);
    }

    /**
     * Determines if we should fallback to v2 API
     */
    private shouldFallbackToV2(error: unknown, currentVersion: ModrinthAPIVersion): boolean {
        if (currentVersion === 'v2') return false;

        if (error instanceof ClientError) {
            return error.status === 410 || error.status === 404;
        }
        return false;
    }

    /**
     * Makes the actual HTTP request with rate limiting and retries
     */
    private async makeRequest<T>(
        endpoint: string,
        version: ModrinthAPIVersion,
        pathParams: string[],
        queryParams: Record<string, string>,
        method: string,
        body?: unknown
    ): Promise<T> {
        await this.handleRateLimit();

        const url = this.buildUrl(endpoint, version, pathParams, queryParams);

        const requestFn = async (): Promise<T> => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.config.fetchTimeoutMs);

            try {
                const response = await fetch(url, {
                    method,
                    headers: this.getHeaders(),
                    body: body ? JSON.stringify(body) : undefined,
                    signal: controller.signal
                });

                this.updateRateLimitFromResponse(response);

                return this.handleResponse<T>(response, url);
            } catch (error) {
                if (error instanceof Error && error.name === 'AbortError') {
                    throw new NetworkError(
                        `Request timed out after ${this.config.fetchTimeoutMs}ms`,
                        error
                    );
                }
                if (error instanceof Error && error.name === 'TypeError') {
                    throw new NetworkError('Failed to connect to Modrinth API', error);
                }
                throw error;
            } finally {
                clearTimeout(timeoutId);
            }
        };

        return this.withRetry(requestFn, url);
    }

    /**
     * Builds the full URL for the request
     */
    private buildUrl(
        endpoint: string,
        version: ModrinthAPIVersion,
        pathParams: string[],
        queryParams: Record<string, string>
    ): string {
        const path = pathParams.length > 0 ? `/${pathParams.join('/')}` : '';
        const url = new URL(`${version}/${endpoint}${path}`, this.config.baseUrl);

        Object.entries(queryParams).forEach(([key, value]) => {
            url.searchParams.append(key, value);
        });

        return url.toString();
    }

    /**
     * Returns standard headers for Modrinth API
     */
    private getHeaders(): Record<string, string> {
        return {
            'User-Agent': this.config.userAgent,
            Accept: 'application/json',
            'Content-Type': 'application/json'
        };
    }

    /**
     * Handles rate limiting with request tracking using queue-based approach
     * to prevent race conditions with concurrent requests
     */
    private async handleRateLimit(): Promise<void> {
        return new Promise((resolve) => {
            this.requestQueue = this.requestQueue.then(async () => {
                const now = Date.now();
                const timeSinceReset = now - this.lastResetTime;

                // Reset counter if interval has passed
                if (timeSinceReset >= this.config.resetIntervalSeconds * 1000) {
                    this.remainingRequests = this.config.maxRequestsPerMinute;
                    this.lastResetTime = now;
                }

                // Wait if we've exhausted our quota
                if (this.remainingRequests <= 0) {
                    const waitTime = Math.max(
                        0,
                        this.config.resetIntervalSeconds * 1000 - timeSinceReset
                    );
                    console.warn(`Rate limit reached. Waiting ${waitTime}ms...`);
                    await this.sleep(waitTime);
                    this.remainingRequests = this.config.maxRequestsPerMinute;
                    this.lastResetTime = Date.now();
                }

                this.remainingRequests--;
                resolve();
            });
        });
    }

    /**
     * Updates rate limit tracking from response headers
     */
    private updateRateLimitFromResponse(response: Response): void {
        const remaining = response.headers.get('X-Ratelimit-Remaining');
        const reset = response.headers.get('X-Ratelimit-Reset');

        if (remaining !== null) {
            const parsed = parseInt(remaining, 10);
            if (!isNaN(parsed)) {
                this.remainingRequests = Math.min(this.remainingRequests, parsed);
            }
        }

        if (reset !== null) {
            const resetTime = parseInt(reset, 10) * 1000;
            if (!isNaN(resetTime) && resetTime > this.lastResetTime) {
                this.lastResetTime = resetTime;
            }
        }
    }

    /**
     * Handles the HTTP response and throws appropriate errors
     */
    private async handleResponse<T>(response: Response, url: string): Promise<T> {
        const contentType = response.headers.get('content-type');
        const isJson = contentType?.includes('application/json');
        const endpoint = new URL(url).pathname;

        if (!response.ok) {
            // Safely parse error details with fallback
            let errorDetails: unknown = response.statusText;
            if (isJson) {
                try {
                    errorDetails = await response.json();
                } catch {
                    // JSON parsing failed, use statusText as fallback
                }
            }

            if (response.status === 410) {
                throw new ClientError('API endpoint deprecated', 410, endpoint, errorDetails);
            }

            if (response.status === 429) {
                const retryAfter = parseInt(
                    response.headers.get('Retry-After') || String(this.config.resetIntervalSeconds),
                    10
                );
                throw new RateLimitError(retryAfter, endpoint, errorDetails);
            }

            if (response.status >= 500) {
                throw new ServerError(
                    `Server error: ${response.statusText}`,
                    response.status,
                    endpoint,
                    errorDetails
                );
            }

            if (response.status >= 400) {
                throw new ClientError(
                    `Client error: ${response.statusText}`,
                    response.status,
                    endpoint,
                    errorDetails
                );
            }
        }

        if (!isJson) {
            throw new Error(`Unexpected response format: ${contentType}`);
        }

        return response.json() as Promise<T>;
    }

    /**
     * Retry wrapper with configurable backoff strategy
     */
    private async withRetry<T>(
        operation: () => Promise<T>,
        url: string,
        attempt: number = 0
    ): Promise<T> {
        try {
            return await operation();
        } catch (error) {
            // Don't retry on non-retryable errors
            if (!isRetryableError(error)) {
                throw error;
            }

            // Don't retry if we've exhausted attempts
            if (attempt >= this.config.maxRetries) {
                console.error(`Max retries reached for ${url}. Request failed.`);
                throw error;
            }

            // Special handling for rate limit errors
            if (error instanceof RateLimitError && error.retryAfter !== 'never') {
                console.warn(`Rate limited. Waiting ${error.retryAfter}s before retry...`);
                await this.sleep(error.retryAfter * 1000);
                return this.withRetry(operation, url, attempt + 1);
            }

            // Calculate delay based on strategy
            const delay = this.calculateDelay(attempt);
            console.warn(
                `Retrying request to ${url}... Attempt ${attempt + 1}/${this.config.maxRetries}`
            );
            await this.sleep(delay);

            return this.withRetry(operation, url, attempt + 1);
        }
    }

    /**
     * Calculates retry delay based on configured strategy
     */
    private calculateDelay(attempt: number): number {
        const baseDelay = this.config.retryDelayMs;

        switch (this.config.retryBackoffStrategy) {
            case 'exponential':
                return baseDelay * Math.pow(2, attempt);
            case 'linear':
                return baseDelay * (attempt + 1);
            case 'fixed':
            default:
                return baseDelay;
        }
    }

    /**
     * Sleep utility
     */
    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /**
     * Get remaining requests count (for debugging/monitoring)
     */
    getRemainingRequests(): number {
        return this.remainingRequests;
    }
}

/**
 * Create a new Modrinth client instance
 */
export function createModrinthClient(config?: Partial<APIClientConfig>): ModrinthClient {
    return new ModrinthClient(config);
}

// For server-side usage with Zod-validated config, use:
// import { createClientFromPlatform } from '$lib/api/client.server';
//
// Example:
// ```typescript
// // In +server.ts
// import { createClientFromPlatform } from '$lib/api/client.server';
//
// export const GET: RequestHandler = async ({ platform }) => {
//   const client = createClientFromPlatform(platform);
//   const data = await client.request('tag/game_version');
//   return json(data);
// };
// ```
