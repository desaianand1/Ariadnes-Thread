import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ModrinthClient } from './client';
import { ClientError, ServerError, RateLimitError, NetworkError } from './error';

vi.mock('$lib/server/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

vi.mock('$lib/config/constants', () => ({
    RATE_LIMIT_DEFAULT_RETRY_SECONDS: 5,
    MAX_RATE_LIMIT_WAIT_MS: 5_000
}));

function makeHeaders(overrides: Record<string, string> = {}): Headers {
    const headers = new Headers({
        'content-type': 'application/json',
        'X-Ratelimit-Remaining': '299',
        'X-Ratelimit-Reset': '60',
        ...overrides
    });
    return headers;
}

function mockFetchResponse(
    body: unknown = {},
    status = 200,
    headers: Record<string, string> = {}
): void {
    vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
            new Response(JSON.stringify(body), {
                status,
                headers: makeHeaders(headers)
            })
        )
    );
}

function createClient(overrides: Record<string, unknown> = {}): ModrinthClient {
    return new ModrinthClient({
        baseUrl: 'https://api.modrinth.com',
        userAgent: 'Test/1.0',
        maxRequestsPerMinute: 300,
        resetIntervalSeconds: 60,
        maxRetries: 0,
        retryDelayMs: 100,
        retryBackoffStrategy: 'fixed',
        fetchTimeoutMs: 5_000,
        maxRateLimitWaitMs: 5_000,
        ...overrides
    });
}

beforeEach(() => {
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

// =========================================================================
// Fix 2: X-Ratelimit-Reset interpreted as relative seconds
// =========================================================================

describe('updateRateLimitFromResponse — reset header interpretation', () => {
    it('treats X-Ratelimit-Reset as relative seconds from now', async () => {
        vi.setSystemTime(1_000_000);
        const client = createClient();
        mockFetchResponse({}, 200, {
            'X-Ratelimit-Remaining': '100',
            'X-Ratelimit-Reset': '45'
        });

        await client.request('test');
        const state = client.getRateLimitState();

        // resetAt should be ~(now + 45s + 60s interval) but getRateLimitState adds
        // resetIntervalSeconds to lastResetTime. lastResetTime = now + 45*1000.
        // So resetAt = 1_000_000 + 45_000 + 60_000 = 1_105_000
        expect(state.resetAt).toBe(1_000_000 + 45_000 + 60_000);
    });

    it('ignores X-Ratelimit-Reset: 0', async () => {
        vi.setSystemTime(1_000_000);
        const client = createClient();
        mockFetchResponse({}, 200, {
            'X-Ratelimit-Remaining': '100',
            'X-Ratelimit-Reset': '0'
        });

        await client.request('test');
        const state = client.getRateLimitState();

        // lastResetTime stays at construction time (1_000_000), so resetAt = 1_000_000 + 60_000
        expect(state.resetAt).toBe(1_000_000 + 60_000);
    });
});

// =========================================================================
// Fix 1: Wait capped at maxRateLimitWaitMs
// =========================================================================

describe('handleRateLimit — wait time capping', () => {
    it('caps rate-limit sleep to maxRateLimitWaitMs instead of waiting for full window', async () => {
        const client = createClient({ maxRateLimitWaitMs: 100 });
        mockFetchResponse({}, 200, { 'X-Ratelimit-Remaining': '0', 'X-Ratelimit-Reset': '55' });

        // First request exhausts remaining
        await client.request('test');
        expect(client.getRemainingRequests()).toBe(0);

        // Second request should sleep at most 100ms, not 55s
        mockFetchResponse({}, 200, { 'X-Ratelimit-Remaining': '299' });
        const requestPromise = client.request('test2');

        // Advance past the 100ms cap but not the full 55s window
        await vi.advanceTimersByTimeAsync(150);
        const result = await requestPromise;

        expect(result).toEqual({});
    });

    it('logs capped warning when wait is reduced', async () => {
        const { logger } = await import('$lib/server/logger');
        const client = createClient({ maxRateLimitWaitMs: 100 });
        mockFetchResponse({}, 200, { 'X-Ratelimit-Remaining': '0', 'X-Ratelimit-Reset': '55' });

        await client.request('exhaust');

        mockFetchResponse({}, 200, { 'X-Ratelimit-Remaining': '299' });
        const requestPromise = client.request('capped');
        await vi.advanceTimersByTimeAsync(150);
        await requestPromise;

        expect(logger.warn).toHaveBeenCalledWith(
            'api_rate_limit_wait_capped',
            expect.objectContaining({ cappedWaitMs: 100 })
        );
    });
});

// =========================================================================
// Fix 3: ensureFreshWindow()
// =========================================================================

describe('ensureFreshWindow', () => {
    it('resets counters when the rate-limit window has elapsed', async () => {
        vi.setSystemTime(1_000_000);
        const client = createClient();
        mockFetchResponse({}, 200, { 'X-Ratelimit-Remaining': '0', 'X-Ratelimit-Reset': '10' });

        await client.request('exhaust');
        expect(client.getRemainingRequests()).toBe(0);

        // Advance past the window
        vi.setSystemTime(1_000_000 + 75_000);
        client.ensureFreshWindow();

        expect(client.getRemainingRequests()).toBe(300);
    });

    it('preserves counters when window is still active', async () => {
        vi.setSystemTime(1_000_000);
        const client = createClient();
        mockFetchResponse({}, 200, { 'X-Ratelimit-Remaining': '50', 'X-Ratelimit-Reset': '40' });

        await client.request('partial');

        // Advance only 30s — still within the window (reset at now + 40s)
        vi.setSystemTime(1_000_000 + 30_000);
        client.ensureFreshWindow();

        expect(client.getRemainingRequests()).toBe(50);
    });
});

// =========================================================================
// Fix 5: Abort signal support
// =========================================================================

describe('abort signal', () => {
    it('cancels rate-limit sleep when signal is aborted', async () => {
        const client = createClient({ maxRateLimitWaitMs: 10_000 });
        mockFetchResponse({}, 200, { 'X-Ratelimit-Remaining': '0', 'X-Ratelimit-Reset': '55' });

        await client.request('exhaust');

        mockFetchResponse({}, 200, { 'X-Ratelimit-Remaining': '299' });
        const controller = new AbortController();
        const requestPromise = client.request('aborted', { signal: controller.signal });

        // Abort after 50ms — well before the 10s cap
        await vi.advanceTimersByTimeAsync(50);
        controller.abort(new Error('Test abort'));

        await expect(requestPromise).rejects.toThrow('Test abort');
    });

    it('rejects immediately if signal is already aborted', async () => {
        const client = createClient();
        mockFetchResponse();

        const controller = new AbortController();
        controller.abort(new Error('Pre-aborted'));

        await expect(client.request('test', { signal: controller.signal })).rejects.toThrow(
            'Pre-aborted'
        );
    });
});

// =========================================================================
// Error classification
// =========================================================================

describe('error classification', () => {
    it('classifies 400 as ClientError', async () => {
        const client = createClient();
        mockFetchResponse({ error: 'bad request' }, 400);

        await expect(client.request('test')).rejects.toBeInstanceOf(ClientError);
    });

    it('classifies 500 as ServerError', async () => {
        const client = createClient();
        mockFetchResponse({ error: 'internal error' }, 500);

        await expect(client.request('test')).rejects.toBeInstanceOf(ServerError);
    });

    it('classifies 429 with Retry-After header as RateLimitError with correct retryAfter', async () => {
        const client = createClient();
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue(
                new Response(JSON.stringify({}), {
                    status: 429,
                    headers: makeHeaders({ 'Retry-After': '30' })
                })
            )
        );

        try {
            await client.request('test');
            expect.unreachable('should have thrown');
        } catch (err) {
            expect(err).toBeInstanceOf(RateLimitError);
            expect((err as RateLimitError).retryAfter).toBe(30);
        }
    });

    it('classifies 429 with body retry_after as RateLimitError', async () => {
        const client = createClient();
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue(
                new Response(JSON.stringify({ retry_after: 42 }), {
                    status: 429,
                    headers: makeHeaders()
                })
            )
        );

        try {
            await client.request('test');
            expect.unreachable('should have thrown');
        } catch (err) {
            expect(err).toBeInstanceOf(RateLimitError);
            expect((err as RateLimitError).retryAfter).toBe(42);
        }
    });

    it('classifies 429 with no hints as RateLimitError with default retry', async () => {
        const client = createClient();
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue(
                new Response(JSON.stringify({}), {
                    status: 429,
                    headers: makeHeaders()
                })
            )
        );

        try {
            await client.request('test');
            expect.unreachable('should have thrown');
        } catch (err) {
            expect(err).toBeInstanceOf(RateLimitError);
            // RATE_LIMIT_DEFAULT_RETRY_SECONDS is mocked to 5
            expect((err as RateLimitError).retryAfter).toBe(5);
        }
    });
});

// =========================================================================
// Retry logic
// =========================================================================

describe('retry logic', () => {
    it('retries on ServerError up to maxRetries then succeeds', async () => {
        vi.useRealTimers();
        const client = createClient({
            maxRetries: 2,
            retryDelayMs: 1,
            retryBackoffStrategy: 'fixed'
        });
        let callCount = 0;
        vi.stubGlobal(
            'fetch',
            vi.fn().mockImplementation(() => {
                callCount++;
                if (callCount <= 2) {
                    return Promise.resolve(
                        new Response(JSON.stringify({ error: 'server error' }), {
                            status: 500,
                            headers: makeHeaders()
                        })
                    );
                }
                return Promise.resolve(
                    new Response(JSON.stringify({ data: 'ok' }), {
                        status: 200,
                        headers: makeHeaders()
                    })
                );
            })
        );

        const result = await client.request('test');

        expect(result).toEqual({ data: 'ok' });
        expect(callCount).toBe(3);
    });

    it('retries on NetworkError from TypeError', async () => {
        vi.useRealTimers();
        const client = createClient({
            maxRetries: 1,
            retryDelayMs: 1,
            retryBackoffStrategy: 'fixed'
        });
        let callCount = 0;
        vi.stubGlobal(
            'fetch',
            vi.fn().mockImplementation(() => {
                callCount++;
                if (callCount === 1) {
                    return Promise.reject(new TypeError('Failed to fetch'));
                }
                return Promise.resolve(
                    new Response(JSON.stringify({ data: 'recovered' }), {
                        status: 200,
                        headers: makeHeaders()
                    })
                );
            })
        );

        const result = await client.request('test');

        expect(result).toEqual({ data: 'recovered' });
        expect(callCount).toBe(2);
    });

    it('does NOT retry on ClientError', async () => {
        vi.useRealTimers();
        const client = createClient({ maxRetries: 2, retryDelayMs: 1 });
        // Use 400 (not 404) — 404 triggers v3→v2 fallback which is a separate path
        mockFetchResponse({ error: 'bad request' }, 400);

        await expect(client.request('test')).rejects.toBeInstanceOf(ClientError);
        expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    });

    it('exhausts maxRetries then throws', async () => {
        vi.useRealTimers();
        const client = createClient({
            maxRetries: 2,
            retryDelayMs: 1,
            retryBackoffStrategy: 'fixed'
        });
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue(
                new Response(JSON.stringify({ error: 'down' }), {
                    status: 500,
                    headers: makeHeaders()
                })
            )
        );

        await expect(client.request('test')).rejects.toBeInstanceOf(ServerError);
        // initial + 2 retries = 3 total calls
        expect(vi.mocked(fetch)).toHaveBeenCalledTimes(3);
    });

    it('applies exponential backoff delay pattern', async () => {
        vi.useRealTimers();
        const client = createClient({
            maxRetries: 2,
            retryDelayMs: 1,
            retryBackoffStrategy: 'exponential'
        });
        vi.stubGlobal(
            'fetch',
            vi
                .fn()
                .mockResolvedValue(
                    new Response(JSON.stringify({}), { status: 500, headers: makeHeaders() })
                )
        );

        await expect(client.request('test')).rejects.toBeInstanceOf(ServerError);
        expect(vi.mocked(fetch)).toHaveBeenCalledTimes(3);
    });

    it('applies linear backoff delay pattern', async () => {
        vi.useRealTimers();
        const client = createClient({
            maxRetries: 2,
            retryDelayMs: 1,
            retryBackoffStrategy: 'linear'
        });
        vi.stubGlobal(
            'fetch',
            vi
                .fn()
                .mockResolvedValue(
                    new Response(JSON.stringify({}), { status: 500, headers: makeHeaders() })
                )
        );

        await expect(client.request('test')).rejects.toBeInstanceOf(ServerError);
        expect(vi.mocked(fetch)).toHaveBeenCalledTimes(3);
    });

    it('applies fixed backoff delay pattern', async () => {
        vi.useRealTimers();
        const client = createClient({
            maxRetries: 2,
            retryDelayMs: 1,
            retryBackoffStrategy: 'fixed'
        });
        vi.stubGlobal(
            'fetch',
            vi
                .fn()
                .mockResolvedValue(
                    new Response(JSON.stringify({}), { status: 500, headers: makeHeaders() })
                )
        );

        await expect(client.request('test')).rejects.toBeInstanceOf(ServerError);
        expect(vi.mocked(fetch)).toHaveBeenCalledTimes(3);
    });
});

// =========================================================================
// v3 → v2 fallback
// =========================================================================

describe('v3 → v2 fallback', () => {
    it('falls back to v2 on 404 from v3', async () => {
        const client = createClient();
        vi.stubGlobal(
            'fetch',
            vi.fn().mockImplementation((url: string) => {
                if (url.includes('/v3/')) {
                    return Promise.resolve(
                        new Response(JSON.stringify({ error: 'not found' }), {
                            status: 404,
                            headers: makeHeaders()
                        })
                    );
                }
                return Promise.resolve(
                    new Response(JSON.stringify({ data: 'v2-response' }), {
                        status: 200,
                        headers: makeHeaders()
                    })
                );
            })
        );

        const result = await client.request('test');
        expect(result).toEqual({ data: 'v2-response' });
        const calls = vi.mocked(fetch).mock.calls;
        expect(calls[0][0]).toContain('/v3/');
        expect(calls[1][0]).toContain('/v2/');
    });

    it('falls back to v2 on 410 from v3', async () => {
        const client = createClient();
        vi.stubGlobal(
            'fetch',
            vi.fn().mockImplementation((url: string) => {
                if (url.includes('/v3/')) {
                    return Promise.resolve(
                        new Response(JSON.stringify({ error: 'gone' }), {
                            status: 410,
                            headers: makeHeaders()
                        })
                    );
                }
                return Promise.resolve(
                    new Response(JSON.stringify({ data: 'v2-response' }), {
                        status: 200,
                        headers: makeHeaders()
                    })
                );
            })
        );

        const result = await client.request('test');
        expect(result).toEqual({ data: 'v2-response' });
    });

    it('does NOT fallback on 400 from v3', async () => {
        const client = createClient();
        mockFetchResponse({ error: 'bad request' }, 400);

        await expect(client.request('test')).rejects.toBeInstanceOf(ClientError);
        expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    });
});

// =========================================================================
// Rate limit header edge cases
// =========================================================================

describe('rate limit header edge cases', () => {
    it('ignores non-numeric X-Ratelimit-Remaining', async () => {
        vi.setSystemTime(1_000_000);
        const client = createClient();
        mockFetchResponse({}, 200, { 'X-Ratelimit-Remaining': 'not-a-number' });

        await client.request('test');

        // Non-numeric value skipped; remaining decremented by handleRateLimit only
        expect(client.getRemainingRequests()).toBe(299);
    });

    it('handles missing rate limit headers gracefully', async () => {
        vi.setSystemTime(1_000_000);
        const client = createClient();
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue(
                new Response(JSON.stringify({}), {
                    status: 200,
                    headers: new Headers({ 'content-type': 'application/json' })
                })
            )
        );

        await client.request('test');

        expect(client.getRemainingRequests()).toBe(299);
    });
});

// =========================================================================
// Fetch timeout
// =========================================================================

describe('fetch timeout', () => {
    it('throws NetworkError when exceeding fetchTimeoutMs', async () => {
        vi.useRealTimers();
        const client = createClient({ fetchTimeoutMs: 50 });
        vi.stubGlobal(
            'fetch',
            vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
                return new Promise((resolve, reject) => {
                    const timer = setTimeout(
                        () =>
                            resolve(
                                new Response(JSON.stringify({}), {
                                    status: 200,
                                    headers: makeHeaders()
                                })
                            ),
                        5000
                    );
                    init?.signal?.addEventListener('abort', () => {
                        clearTimeout(timer);
                        reject(new DOMException('The operation was aborted.', 'AbortError'));
                    });
                });
            })
        );

        await expect(client.request('test')).rejects.toBeInstanceOf(NetworkError);
    });

    it('does not throw when response arrives before timeout', async () => {
        vi.useRealTimers();
        const client = createClient({ fetchTimeoutMs: 5_000 });
        mockFetchResponse({ data: 'ok' });

        const result = await client.request('test');
        expect(result).toEqual({ data: 'ok' });
    });
});
