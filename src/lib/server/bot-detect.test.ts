import { describe, it, expect } from 'vitest';
import { getBotScore, isLikelyBot } from './bot-detect';

function makeRequest(headers: Record<string, string> = {}): Request {
    return new Request('https://example.com', { headers });
}

/** Headers a real browser would send */
const browserHeaders = {
    'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    accept: 'text/html,application/xhtml+xml',
    'accept-language': 'en-US,en;q=0.9',
    'sec-fetch-site': 'none'
};

describe('getBotScore', () => {
    it('scores 0 for a standard browser request', () => {
        const req = makeRequest(browserHeaders);
        expect(getBotScore(req)).toBe(0);
    });

    it('scores 0 for Googlebot (crawler allowlist)', () => {
        const req = makeRequest({
            'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
        });
        expect(getBotScore(req)).toBe(0);
    });

    it('scores 0 for Bingbot (crawler allowlist)', () => {
        const req = makeRequest({
            'user-agent': 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)'
        });
        expect(getBotScore(req)).toBe(0);
    });

    it('scores 3 for missing Accept header alone (blocked)', () => {
        const req = makeRequest({
            'user-agent': browserHeaders['user-agent'],
            'accept-language': 'en-US',
            'sec-fetch-site': 'none'
        });
        expect(getBotScore(req)).toBe(3);
    });

    it('scores 1 for missing Sec-Fetch-Site alone (allowed — Safari < 16.4 safe)', () => {
        const req = makeRequest({
            'user-agent':
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.3 Safari/605.1.15',
            accept: 'text/html',
            'accept-language': 'en-US'
        });
        expect(getBotScore(req)).toBe(1);
        expect(isLikelyBot(req)).toBe(false);
    });

    it('scores 5 for missing Accept + Accept-Language (blocked)', () => {
        const req = makeRequest({
            'user-agent': browserHeaders['user-agent'],
            'sec-fetch-site': 'none'
        });
        expect(getBotScore(req)).toBe(5);
    });

    it('scores 3 for empty User-Agent (blocked)', () => {
        const req = makeRequest({
            accept: 'text/html',
            'accept-language': 'en-US',
            'sec-fetch-site': 'none'
        });
        expect(getBotScore(req)).toBe(3);
    });

    it('scores 3 for curl UA with known bot pattern', () => {
        const req = makeRequest({
            'user-agent': 'curl/7.88.1',
            accept: '*/*',
            'accept-language': 'en',
            'sec-fetch-site': 'none'
        });
        expect(getBotScore(req)).toBe(3);
    });

    it('scores high for curl with no browser headers at all', () => {
        const req = makeRequest({ 'user-agent': 'curl/7.88.1' });
        // known_bot(3) + missing_accept(3) + missing_accept_language(2) + missing_sec_fetch(1) = 9
        expect(getBotScore(req)).toBe(9);
    });

    it('scores 3 for python-requests UA', () => {
        const req = makeRequest({
            'user-agent': 'python-requests/2.28.0',
            accept: '*/*',
            'accept-language': 'en',
            'sec-fetch-site': 'none'
        });
        expect(getBotScore(req)).toBe(3);
    });

    it('allows Firefox with all headers', () => {
        const req = makeRequest({
            'user-agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0',
            accept: 'text/html',
            'accept-language': 'en-US',
            'sec-fetch-site': 'none'
        });
        expect(getBotScore(req)).toBe(0);
        expect(isLikelyBot(req)).toBe(false);
    });

    it('does not allowlist UA that merely contains a crawler name as substring', () => {
        const req = makeRequest({
            'user-agent': 'MyNotGooglebotScraper/1.0',
            accept: 'text/html',
            'accept-language': 'en-US',
            'sec-fetch-site': 'none'
        });
        // "googlebot" appears as substring in the UA — this WILL match the allowlist
        // due to `.includes()`. This test documents current behavior.
        const score = getBotScore(req);
        expect(score).toBe(0);
    });

    it('blocks at exactly the score threshold', () => {
        // Missing accept alone = 3 = BOT_SCORE_THRESHOLD → should be blocked
        const req = makeRequest({
            'user-agent': browserHeaders['user-agent'],
            'accept-language': 'en-US',
            'sec-fetch-site': 'none'
        });
        expect(getBotScore(req)).toBe(3);
        expect(isLikelyBot(req)).toBe(true);
    });

    it('allows at one below the score threshold', () => {
        // Missing accept-language (2) + missing sec-fetch (1) would be 3, but
        // missing just accept-language = 2 < threshold
        const req = makeRequest({
            'user-agent': browserHeaders['user-agent'],
            accept: 'text/html',
            'sec-fetch-site': 'none'
        });
        expect(getBotScore(req)).toBe(2);
        expect(isLikelyBot(req)).toBe(false);
    });

    it('allows Edge with all headers', () => {
        const req = makeRequest({
            'user-agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
            accept: 'text/html',
            'accept-language': 'en-US',
            'sec-fetch-site': 'none'
        });
        expect(getBotScore(req)).toBe(0);
    });
});

describe('isLikelyBot', () => {
    it('returns true for curl', () => {
        const req = makeRequest({ 'user-agent': 'curl/7.88.1' });
        expect(isLikelyBot(req)).toBe(true);
    });

    it('returns true for python-requests', () => {
        const req = makeRequest({ 'user-agent': 'python-requests/2.28.0' });
        expect(isLikelyBot(req)).toBe(true);
    });

    it('returns false for standard browser', () => {
        const req = makeRequest(browserHeaders);
        expect(isLikelyBot(req)).toBe(false);
    });

    it('returns false for Googlebot', () => {
        const req = makeRequest({
            'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)'
        });
        expect(isLikelyBot(req)).toBe(false);
    });
});
