import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { verifyTurnstileToken } from '$lib/server/turnstile';
import { getEnvConfig } from '$lib/config/env.server';
import { logger } from '$lib/server/logger';

/**
 * Hero form Turnstile verification round-trip.
 *
 * The hero form submits via client-side `goto('/review?...')` — a GET — which
 * can't carry a Turnstile token body. /review URLs must remain shareable to
 * third parties without a fresh challenge, so we don't gate /review itself.
 * Instead the form POSTs the token here first; only on 200 does it proceed
 * to navigate. Tokens are single-use, so replays are rejected upstream.
 */
export const POST: RequestHandler = async ({ request, getClientAddress }) => {
    const config = getEnvConfig();

    const contentType = request.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
        return json({ error: 'Content-Type must be application/json' }, { status: 415 });
    }

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const token = (body as { turnstileToken?: unknown })?.turnstileToken;
    if (typeof token !== 'string' || token.length === 0 || token.length > 2048) {
        return json({ error: 'Missing turnstileToken' }, { status: 400 });
    }

    const remoteIp =
        request.headers.get('cf-connecting-ip') ??
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
        getClientAddress();

    const result = await verifyTurnstileToken(config.TURNSTILE_SECRET_KEY, token, {
        action: 'hero-submit',
        remoteIp
    });

    if (!result.success) {
        logger.warn('hero_turnstile_failed', { errors: result['error-codes'] });
        return json({ error: 'Bot verification failed' }, { status: 403 });
    }

    return json({ ok: true });
};
