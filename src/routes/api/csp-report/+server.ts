import type { RequestHandler } from './$types';
import { logger } from '$lib/server/logger';

/**
 * Collector for browser-generated CSP violation reports.
 *
 * Browsers send two shapes:
 *  - Legacy `report-uri`: `{ "csp-report": { ... } }` with Content-Type
 *    `application/csp-report` or `application/json`.
 *  - Modern `report-to` / Reporting API: an array of `[{ type, age, url, body }]`
 *    with Content-Type `application/reports+json`.
 *
 * We log a `csp_violation` warn entry so dependency upgrades that introduce
 * unexpected script sources or eval calls surface in observability before they
 * mask a real exploit. Response is 204 regardless of parse success; we don't
 * want to reveal whether the parser accepted the payload.
 *
 * The endpoint falls under the global per-IP rate limit via hooks.server.ts
 * (no route-specific bucket needed — browsers rarely burst more than a few
 * reports per navigation).
 */
export const POST: RequestHandler = async ({ request }) => {
    try {
        const raw = await request.text();
        if (raw.length === 0 || raw.length > 16_384) {
            // Truncate/ignore oversized reports — browsers emit small JSON.
            return new Response(null, { status: 204 });
        }

        const parsed = JSON.parse(raw) as unknown;

        if (Array.isArray(parsed)) {
            // Reporting API batch
            for (const entry of parsed) {
                const e = entry as Record<string, unknown>;
                if (e?.type === 'csp-violation') {
                    logger.warn('csp_violation', {
                        source: 'report-to',
                        url: e.url,
                        body: e.body
                    });
                }
            }
        } else if (parsed && typeof parsed === 'object' && 'csp-report' in parsed) {
            logger.warn('csp_violation', {
                source: 'report-uri',
                body: (parsed as Record<string, unknown>)['csp-report']
            });
        }
    } catch {
        // Malformed JSON from the wire: ignore. Browsers occasionally truncate.
    }

    return new Response(null, { status: 204 });
};
