import {
    BOT_UA_PATTERNS,
    CRAWLER_ALLOWLIST,
    BOT_SCORE_WEIGHTS,
    BOT_SCORE_THRESHOLD
} from '$lib/config/constants';

export function getBotScore(request: Request): number {
    const ua = request.headers.get('user-agent')?.toLowerCase() ?? '';

    if (CRAWLER_ALLOWLIST.some((crawler) => ua.includes(crawler))) {
        return 0;
    }

    let score = 0;
    if (!request.headers.has('accept')) score += BOT_SCORE_WEIGHTS.MISSING_ACCEPT;
    if (!request.headers.has('accept-language')) score += BOT_SCORE_WEIGHTS.MISSING_ACCEPT_LANGUAGE;
    if (!request.headers.has('sec-fetch-site')) score += BOT_SCORE_WEIGHTS.MISSING_SEC_FETCH;
    if (!ua) score += BOT_SCORE_WEIGHTS.EMPTY_USER_AGENT;
    if (BOT_UA_PATTERNS.some((pattern) => ua.includes(pattern)))
        score += BOT_SCORE_WEIGHTS.KNOWN_BOT_UA;

    return score;
}

export function isLikelyBot(request: Request): boolean {
    return getBotScore(request) >= BOT_SCORE_THRESHOLD;
}
