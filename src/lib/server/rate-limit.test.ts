import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { checkRateLimit, getRouteKey, getClientIp, _resetForTesting } from './rate-limit';
import type { RequestEvent } from '@sveltejs/kit';

beforeEach(() => {
    _resetForTesting();
});

afterEach(() => {
    _resetForTesting();
});

describe('checkRateLimit', () => {
    const config = { maxRequests: 3, windowMs: 10_000 };

    it('allows requests within the limit', () => {
        const r1 = checkRateLimit('1.2.3.4', 'API', config);
        const r2 = checkRateLimit('1.2.3.4', 'API', config);
        const r3 = checkRateLimit('1.2.3.4', 'API', config);

        expect(r1.allowed).toBe(true);
        expect(r1.remaining).toBe(2);
        expect(r2.allowed).toBe(true);
        expect(r2.remaining).toBe(1);
        expect(r3.allowed).toBe(true);
        expect(r3.remaining).toBe(0);
    });

    it('blocks requests exceeding the limit', () => {
        checkRateLimit('1.2.3.4', 'API', config);
        checkRateLimit('1.2.3.4', 'API', config);
        checkRateLimit('1.2.3.4', 'API', config);
        const r4 = checkRateLimit('1.2.3.4', 'API', config);

        expect(r4.allowed).toBe(false);
        expect(r4.remaining).toBe(0);
        expect(r4.retryAfterMs).toBeGreaterThan(0);
    });

    it('resets counter after window expires', () => {
        vi.useFakeTimers();
        checkRateLimit('1.2.3.4', 'API', config);
        checkRateLimit('1.2.3.4', 'API', config);
        checkRateLimit('1.2.3.4', 'API', config);

        vi.advanceTimersByTime(10_001);

        const result = checkRateLimit('1.2.3.4', 'API', config);
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(2);
        vi.useRealTimers();
    });

    it('tracks different IPs independently', () => {
        checkRateLimit('1.1.1.1', 'API', config);
        checkRateLimit('1.1.1.1', 'API', config);
        checkRateLimit('1.1.1.1', 'API', config);

        const blocked = checkRateLimit('1.1.1.1', 'API', config);
        const allowed = checkRateLimit('2.2.2.2', 'API', config);

        expect(blocked.allowed).toBe(false);
        expect(allowed.allowed).toBe(true);
    });

    it('tracks different route keys independently', () => {
        checkRateLimit('1.2.3.4', 'API', config);
        checkRateLimit('1.2.3.4', 'API', config);
        checkRateLimit('1.2.3.4', 'API', config);

        const blockedApi = checkRateLimit('1.2.3.4', 'API', config);
        const allowedReview = checkRateLimit('1.2.3.4', 'REVIEW', config);

        expect(blockedApi.allowed).toBe(false);
        expect(allowedReview.allowed).toBe(true);
    });

    it('returns correct retryAfterMs when blocked', () => {
        vi.useFakeTimers({ now: 1000 });

        checkRateLimit('1.2.3.4', 'API', config);
        checkRateLimit('1.2.3.4', 'API', config);
        checkRateLimit('1.2.3.4', 'API', config);

        vi.advanceTimersByTime(3000);

        const result = checkRateLimit('1.2.3.4', 'API', config);
        expect(result.allowed).toBe(false);
        // Window started at t=1000, resetAt = 1000 + 10000 = 11000, now = 4000
        expect(result.retryAfterMs).toBe(7000);
        vi.useRealTimers();
    });
});

describe('getRouteKey', () => {
    it('maps /api/modrinth/* to API', () => {
        expect(getRouteKey('/api/modrinth/tags/game-versions')).toBe('API');
        expect(getRouteKey('/api/modrinth/collection/abc')).toBe('API');
    });

    it('maps /review to REVIEW', () => {
        expect(getRouteKey('/review')).toBe('REVIEW');
    });

    it('maps /api/share/* to EMAIL', () => {
        expect(getRouteKey('/api/share/email')).toBe('EMAIL');
    });

    it('returns null for unmatched routes', () => {
        expect(getRouteKey('/')).toBeNull();
        expect(getRouteKey('/about')).toBeNull();
        expect(getRouteKey('/review/something')).toBeNull();
    });
});

describe('getClientIp', () => {
    function mockEvent(headers: Record<string, string>, fallbackIp?: string): RequestEvent {
        return {
            request: {
                headers: new Headers(headers)
            },
            getClientAddress: () => fallbackIp ?? '127.0.0.1'
        } as unknown as RequestEvent;
    }

    it('prefers cf-connecting-ip', () => {
        const event = mockEvent({
            'cf-connecting-ip': '10.0.0.1',
            'x-forwarded-for': '10.0.0.2'
        });
        expect(getClientIp(event)).toBe('10.0.0.1');
    });

    it('falls back to x-forwarded-for first entry', () => {
        const event = mockEvent({
            'x-forwarded-for': '10.0.0.2, 10.0.0.3'
        });
        expect(getClientIp(event)).toBe('10.0.0.2');
    });

    it('falls back to getClientAddress', () => {
        const event = mockEvent({}, '192.168.1.1');
        expect(getClientIp(event)).toBe('192.168.1.1');
    });
});
