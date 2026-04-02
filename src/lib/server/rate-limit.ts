import { RATE_LIMITS, RATE_LIMIT_CLEANUP_INTERVAL_MS } from '$lib/config/constants';
import type { RequestEvent } from '@sveltejs/kit';

export interface RateLimitConfig {
    maxRequests: number;
    windowMs: number;
}

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetAt: number;
    retryAfterMs: number;
}

interface WindowEntry {
    count: number;
    resetAt: number;
}

// Known limitation: in-memory rate limiting resets on deploy and is per-isolate
// on edge runtimes (e.g. Cloudflare Workers). For production scale, migrate to
// Cloudflare KV or Durable Objects for shared, durable counters.
const windows = new Map<string, WindowEntry>();
const recipientWindows = new Map<string, WindowEntry>();
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanup(): void {
    if (cleanupTimer) return;
    cleanupTimer = setInterval(() => {
        const now = Date.now();
        for (const [key, entry] of windows) {
            if (now >= entry.resetAt) {
                windows.delete(key);
            }
        }
        for (const [key, entry] of recipientWindows) {
            if (now >= entry.resetAt) {
                recipientWindows.delete(key);
            }
        }
        if (windows.size === 0 && recipientWindows.size === 0 && cleanupTimer) {
            clearInterval(cleanupTimer);
            cleanupTimer = null;
        }
    }, RATE_LIMIT_CLEANUP_INTERVAL_MS);
}

export function checkRateLimit(
    ip: string,
    routeKey: string,
    config: RateLimitConfig
): RateLimitResult {
    ensureCleanup();

    const key = `${routeKey}:${ip}`;
    const now = Date.now();
    const entry = windows.get(key);

    if (!entry || now >= entry.resetAt) {
        const resetAt = now + config.windowMs;
        windows.set(key, { count: 1, resetAt });
        return { allowed: true, remaining: config.maxRequests - 1, resetAt, retryAfterMs: 0 };
    }

    entry.count++;
    if (entry.count > config.maxRequests) {
        const retryAfterMs = entry.resetAt - now;
        return { allowed: false, remaining: 0, resetAt: entry.resetAt, retryAfterMs };
    }

    return {
        allowed: true,
        remaining: config.maxRequests - entry.count,
        resetAt: entry.resetAt,
        retryAfterMs: 0
    };
}

export function checkRecipientRateLimit(
    email: string,
    config: { MAX_PER_RECIPIENT: number; WINDOW_MS: number }
): RateLimitResult {
    ensureCleanup();
    const key = `recipient:${email.toLowerCase().trim()}`;
    const now = Date.now();
    const entry = recipientWindows.get(key);

    if (!entry || now >= entry.resetAt) {
        const resetAt = now + config.WINDOW_MS;
        recipientWindows.set(key, { count: 1, resetAt });
        return { allowed: true, remaining: config.MAX_PER_RECIPIENT - 1, resetAt, retryAfterMs: 0 };
    }

    entry.count++;
    if (entry.count > config.MAX_PER_RECIPIENT) {
        return {
            allowed: false,
            remaining: 0,
            resetAt: entry.resetAt,
            retryAfterMs: entry.resetAt - now
        };
    }

    return {
        allowed: true,
        remaining: config.MAX_PER_RECIPIENT - entry.count,
        resetAt: entry.resetAt,
        retryAfterMs: 0
    };
}

export function getRateLimitInfo(
    ip: string,
    routeKey: string
): { remaining: number; resetAt: number } {
    const key = `${routeKey}:${ip}`;
    const entry = windows.get(key);
    if (!entry) return { remaining: -1, resetAt: 0 };
    return {
        remaining: Math.max(0, entry.resetAt > Date.now() ? 0 : -1),
        resetAt: entry.resetAt
    };
}

export function getClientIp(event: RequestEvent): string {
    return (
        event.request.headers.get('cf-connecting-ip') ??
        event.request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
        event.getClientAddress() ??
        'unknown'
    );
}

export function getRouteKey(pathname: string): keyof typeof RATE_LIMITS | null {
    if (pathname.startsWith('/api/modrinth')) return 'API';
    if (pathname === '/review') return 'REVIEW';
    if (pathname.startsWith('/api/share')) return 'EMAIL';
    return null;
}

/** Exposed for testing — clears all rate limit state */
export function _resetForTesting(): void {
    windows.clear();
    recipientWindows.clear();
    if (cleanupTimer) {
        clearInterval(cleanupTimer);
        cleanupTimer = null;
    }
}
