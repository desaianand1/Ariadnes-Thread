import { TURNSTILE_VERIFY_URL } from '$lib/config/constants';

export interface TurnstileVerifyResult {
    success: boolean;
    'error-codes': string[];
    challenge_ts?: string;
    hostname?: string;
}

/**
 * Verify a Turnstile token server-side against Cloudflare's siteverify endpoint.
 * Tokens are single-use and expire after 300 seconds.
 */
export async function verifyTurnstileToken(
    secret: string,
    token: string,
    remoteIp?: string
): Promise<TurnstileVerifyResult> {
    const body = new FormData();
    body.append('secret', secret);
    body.append('response', token);

    if (remoteIp) {
        body.append('remoteip', remoteIp);
    }

    try {
        const res = await fetch(TURNSTILE_VERIFY_URL, { method: 'POST', body });
        return (await res.json()) as TurnstileVerifyResult;
    } catch {
        return { success: false, 'error-codes': ['internal-error'] };
    }
}
