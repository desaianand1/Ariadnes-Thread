import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { shareEmailSchema } from '$lib/schemas/share';
import { sendShareEmail } from '$lib/server/email/resend';
import { getEnvConfig } from '$lib/config/env.server';
import { checkRecipientRateLimit } from '$lib/server/rate-limit';
import { MIN_FORM_SUBMIT_TIME_MS, EMAIL_RECIPIENT_LIMITS } from '$lib/config/constants';
import { siteConfig } from '$lib/config/site';

export const POST: RequestHandler = async ({ request }) => {
    const contentType = request.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
        return json({ error: 'Content-Type must be application/json' }, { status: 415 });
    }

    const body = await request.json();
    const parsed = shareEmailSchema.safeParse(body);

    if (!parsed.success) {
        return json({ error: 'Invalid input' }, { status: 400 });
    }

    const data = parsed.data;

    // Defense-in-depth: reject share URLs not from our domain
    if (!data.shareUrl.startsWith(`${siteConfig.url}/`)) {
        return json({ error: 'Invalid share URL' }, { status: 400 });
    }

    // Anti-bot: honeypot (silent success to avoid revealing mechanism)
    if (data.website) return json({ success: true });

    // Anti-bot: timing check (silent success)
    if (Date.now() - data.loadedAt < MIN_FORM_SUBMIT_TIME_MS) {
        return json({ success: true });
    }

    // Per-recipient rate limit
    const recipientCheck = checkRecipientRateLimit(data.recipientEmail, EMAIL_RECIPIENT_LIMITS);
    if (!recipientCheck.allowed) {
        return json({ error: 'Too many emails to this recipient' }, { status: 429 });
    }

    // Check API key availability
    const config = getEnvConfig();
    if (!config.RESEND_API_KEY) {
        return json({ error: 'Email service unavailable' }, { status: 503 });
    }

    const result = await sendShareEmail(data.recipientEmail, {
        curatorName: data.curatorName,
        message: data.message ?? '',
        collectionNames: data.collectionNames,
        shareUrl: data.shareUrl
    });

    if (!result.success) {
        return json({ error: 'Failed to send email' }, { status: 502 });
    }

    return json({ success: true });
};
