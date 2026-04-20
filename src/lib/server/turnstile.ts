import { TURNSTILE_VERIFY_URL } from '$lib/config/constants';
import { siteConfig } from '$lib/config/site';

export interface TurnstileVerifyResult {
    success: boolean;
    'error-codes': string[];
    challenge_ts?: string;
    hostname?: string;
    action?: string;
    cdata?: string;
}

export interface VerifyTurnstileOptions {
    /**
     * Action label that the widget was rendered with. Must match exactly on the
     * server — prevents an attacker who has a valid token for a different form
     * from replaying it here. Cloudflare returns the action in the verify
     * response; we compare and reject mismatches.
     */
    action: string;
    /** Client IP passed through to Cloudflare for additional signal (optional). */
    remoteIp?: string;
    /**
     * Hostname the token was issued for. Defaults to siteConfig.domain. Tests
     * may pass the sentinel `*` to skip the check when using Cloudflare's
     * always-passes dev keys (`1x00000000000000000000AA`), which return
     * hostname: '' and action: ''.
     */
    expectedHostname?: string;
}

/**
 * Verify a Turnstile token against Cloudflare's siteverify endpoint.
 *
 * In addition to the upstream success flag, we enforce:
 *   - `hostname` equals our site domain (blocks tokens minted on attacker domains)
 *   - `action` equals the caller-supplied value (blocks cross-form replay)
 *
 * Tokens are single-use and expire after 300 seconds.
 */
export async function verifyTurnstileToken(
    secret: string,
    token: string,
    options: VerifyTurnstileOptions
): Promise<TurnstileVerifyResult> {
    const body = new FormData();
    body.append('secret', secret);
    body.append('response', token);

    if (options.remoteIp) {
        body.append('remoteip', options.remoteIp);
    }

    let result: TurnstileVerifyResult;
    try {
        const res = await fetch(TURNSTILE_VERIFY_URL, { method: 'POST', body });
        result = (await res.json()) as TurnstileVerifyResult;
    } catch {
        return { success: false, 'error-codes': ['internal-error'] };
    }

    if (!result.success) return result;

    const expectedHostname = options.expectedHostname ?? siteConfig.domain;
    if (expectedHostname !== '*' && result.hostname !== expectedHostname) {
        return { ...result, success: false, 'error-codes': ['hostname-mismatch'] };
    }

    if (result.action !== options.action) {
        return { ...result, success: false, 'error-codes': ['action-mismatch'] };
    }

    return result;
}
