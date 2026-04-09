import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ModrinthClient } from './client';

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
