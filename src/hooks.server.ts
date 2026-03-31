import type { Handle } from '@sveltejs/kit';
import { isLikelyBot } from '$lib/server/bot-detect';
import { checkRateLimit, getClientIp, getRouteKey, getRateLimitInfo } from '$lib/server/rate-limit';
import { RATE_LIMITS } from '$lib/config/constants';

export const handle: Handle = async ({ event, resolve }) => {
    const pathname = event.url.pathname;
    const ip = getClientIp(event);

    // Bot detection — before any expensive work
    if (pathname.startsWith('/api/') || pathname === '/review') {
        if (isLikelyBot(event.request)) {
            return new Response('Forbidden', { status: 403 });
        }
    }

    // Per-IP rate limiting
    const routeKey = getRouteKey(pathname);
    if (routeKey) {
        const result = checkRateLimit(ip, routeKey, RATE_LIMITS[routeKey]);
        if (!result.allowed) {
            return new Response(JSON.stringify({ error: 'Too many requests' }), {
                status: 429,
                headers: {
                    'Content-Type': 'application/json',
                    'Retry-After': String(Math.ceil(result.retryAfterMs / 1000)),
                    'X-RateLimit-Remaining': '0',
                    'X-RateLimit-Reset': String(result.resetAt)
                }
            });
        }
    }

    const response = await resolve(event);

    // Rate limit info headers on successful responses
    if (routeKey) {
        const info = getRateLimitInfo(ip, routeKey);
        response.headers.set('X-RateLimit-Remaining', String(info.remaining));
        response.headers.set('X-RateLimit-Reset', String(info.resetAt));
    }

    response.headers.set(
        'Strict-Transport-Security',
        'max-age=63072000; includeSubDomains; preload'
    );
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    response.headers.set(
        'Content-Security-Policy',
        [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' https://cdn.modrinth.com https://cdn-raw.modrinth.com https://www.bisecthosting.com data:",
            "font-src 'self'",
            "connect-src 'self' https://api.modrinth.com https://cdn.modrinth.com https://cdn-raw.modrinth.com",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'"
        ].join('; ')
    );

    return response;
};
