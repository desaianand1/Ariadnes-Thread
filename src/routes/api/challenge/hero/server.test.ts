import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('$lib/server/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

vi.mock('$lib/config/env.server', () => ({
    getEnvConfig: () => ({ TURNSTILE_SECRET_KEY: 'test-secret' })
}));

const verifyTurnstileMock = vi.fn();
vi.mock('$lib/server/turnstile', () => ({
    verifyTurnstileToken: (...args: unknown[]) => verifyTurnstileMock(...args)
}));

// Import after mocks so the endpoint sees the mocked modules.
const { POST } = await import('./+server');

type MinimalEvent = {
    request: Request;
    getClientAddress: () => string;
};

function invoke(init: { body?: string; headers?: Record<string, string> } = {}) {
    const request = new Request('https://modrinth.download/api/challenge/hero', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...init.headers },
        body: init.body
    });
    return (POST as unknown as (e: MinimalEvent) => Promise<Response>)({
        request,
        getClientAddress: () => '203.0.113.10'
    });
}

beforeEach(() => {
    verifyTurnstileMock.mockReset();
});

describe('POST /api/challenge/hero', () => {
    it('returns 415 when content-type is not JSON', async () => {
        // Arrange
        const request = new Request('https://modrinth.download/api/challenge/hero', {
            method: 'POST',
            headers: { 'content-type': 'text/plain' },
            body: 'plain'
        });

        // Act
        const res = await (POST as unknown as (e: MinimalEvent) => Promise<Response>)({
            request,
            getClientAddress: () => '203.0.113.10'
        });

        // Assert
        expect(res.status).toBe(415);
    });

    it('returns 400 when body is malformed JSON', async () => {
        // Arrange
        const body = '{ not json';

        // Act
        const res = await invoke({ body });

        // Assert
        expect(res.status).toBe(400);
    });

    it('returns 400 when turnstileToken is missing', async () => {
        // Arrange
        const body = JSON.stringify({});

        // Act
        const res = await invoke({ body });

        // Assert
        expect(res.status).toBe(400);
    });

    it('returns 400 when turnstileToken is empty string', async () => {
        // Arrange
        const body = JSON.stringify({ turnstileToken: '' });

        // Act
        const res = await invoke({ body });

        // Assert
        expect(res.status).toBe(400);
    });

    it('returns 400 when turnstileToken exceeds length cap', async () => {
        // Arrange
        const body = JSON.stringify({ turnstileToken: 'x'.repeat(2049) });

        // Act
        const res = await invoke({ body });

        // Assert
        expect(res.status).toBe(400);
    });

    it('returns 403 when Turnstile verification fails', async () => {
        // Arrange
        verifyTurnstileMock.mockResolvedValue({
            success: false,
            'error-codes': ['invalid-input-response']
        });
        const body = JSON.stringify({ turnstileToken: 'bogus' });

        // Act
        const res = await invoke({ body });

        // Assert
        expect(res.status).toBe(403);
    });

    it('returns 200 when Turnstile verification succeeds', async () => {
        // Arrange
        verifyTurnstileMock.mockResolvedValue({
            success: true,
            'error-codes': [],
            hostname: 'modrinth.download',
            action: 'hero-submit'
        });
        const body = JSON.stringify({ turnstileToken: 'valid-token' });

        // Act
        const res = await invoke({ body });

        // Assert
        expect(res.status).toBe(200);
        const payload = (await res.json()) as { ok: boolean };
        expect(payload.ok).toBe(true);
    });

    it('passes the hero-submit action to verifyTurnstileToken', async () => {
        // Arrange
        verifyTurnstileMock.mockResolvedValue({
            success: true,
            'error-codes': [],
            hostname: 'modrinth.download',
            action: 'hero-submit'
        });
        const body = JSON.stringify({ turnstileToken: 'valid-token' });

        // Act
        await invoke({ body });

        // Assert
        expect(verifyTurnstileMock).toHaveBeenCalledWith(
            'test-secret',
            'valid-token',
            expect.objectContaining({ action: 'hero-submit' })
        );
    });

    it('prefers cf-connecting-ip over x-forwarded-for and getClientAddress', async () => {
        // Arrange
        verifyTurnstileMock.mockResolvedValue({
            success: true,
            'error-codes': [],
            hostname: 'modrinth.download',
            action: 'hero-submit'
        });
        const body = JSON.stringify({ turnstileToken: 'valid-token' });

        // Act
        await invoke({
            body,
            headers: {
                'cf-connecting-ip': '198.51.100.42',
                'x-forwarded-for': '10.0.0.1, 10.0.0.2'
            }
        });

        // Assert
        expect(verifyTurnstileMock).toHaveBeenCalledWith(
            'test-secret',
            'valid-token',
            expect.objectContaining({ remoteIp: '198.51.100.42' })
        );
    });

    it('falls back to getClientAddress when no forwarding headers are present', async () => {
        // Arrange
        verifyTurnstileMock.mockResolvedValue({
            success: true,
            'error-codes': [],
            hostname: 'modrinth.download',
            action: 'hero-submit'
        });
        const body = JSON.stringify({ turnstileToken: 'valid-token' });

        // Act
        await invoke({ body });

        // Assert
        expect(verifyTurnstileMock).toHaveBeenCalledWith(
            'test-secret',
            'valid-token',
            expect.objectContaining({ remoteIp: '203.0.113.10' })
        );
    });
});
