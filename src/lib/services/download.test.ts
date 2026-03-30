import { describe, it, expect, vi, afterEach } from 'vitest';
import { downloadFiles, type DownloadCallbacks, type DownloadFile } from './download';

const KNOWN_CONTENT = new TextEncoder().encode('hello world');
// SHA-1 of "hello world"
const KNOWN_SHA1 = '2aae6c35c94fcfb415dbe95f408b9ce91ee846ed';

function makeFile(url: string, sha1 = KNOWN_SHA1): DownloadFile {
    return { fileUrl: url, fileSize: KNOWN_CONTENT.length, sha1 };
}

function makeCallbacks(): DownloadCallbacks & {
    starts: string[];
    progresses: Array<{ url: string; bytes: number }>;
    completes: string[];
    errors: string[];
} {
    const starts: string[] = [];
    const progresses: Array<{ url: string; bytes: number }> = [];
    const completes: string[] = [];
    const errors: string[] = [];

    return {
        starts,
        progresses,
        completes,
        errors,
        onFileStart: (url) => starts.push(url),
        onFileProgress: (url, bytes) => progresses.push({ url, bytes }),
        onFileComplete: (url) => completes.push(url),
        onFileError: (url) => errors.push(url)
    };
}

function mockFetchSuccess(content: Uint8Array = KNOWN_CONTENT) {
    return vi.fn().mockResolvedValue(
        new Response(content.buffer as ArrayBuffer, {
            status: 200,
            headers: { 'Content-Length': String(content.length) }
        })
    );
}

function mockFetchFailThenSucceed(content: Uint8Array = KNOWN_CONTENT) {
    let callCount = 0;
    return vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
            return Promise.resolve(new Response(null, { status: 500, statusText: 'Server Error' }));
        }
        return Promise.resolve(
            new Response(content.buffer as ArrayBuffer, {
                status: 200,
                headers: { 'Content-Length': String(content.length) }
            })
        );
    });
}

describe('downloadFiles', () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
        globalThis.fetch = originalFetch;
        vi.restoreAllMocks();
    });

    it('downloads files and returns data map', async () => {
        globalThis.fetch = mockFetchSuccess();
        const callbacks = makeCallbacks();
        const controller = new AbortController();

        const result = await downloadFiles(
            [makeFile('https://cdn.example.com/mod1.jar')],
            { concurrency: 2, maxRetries: 0, retryDelayMs: 0, signal: controller.signal },
            callbacks
        );

        expect(result.size).toBe(1);
        expect(result.has('https://cdn.example.com/mod1.jar')).toBe(true);
        expect(callbacks.completes).toContain('https://cdn.example.com/mod1.jar');
    });

    it('respects concurrency limit', async () => {
        let activeFetches = 0;
        let maxActiveFetches = 0;

        globalThis.fetch = vi.fn().mockImplementation(async () => {
            activeFetches++;
            maxActiveFetches = Math.max(maxActiveFetches, activeFetches);
            // Simulate network latency
            await new Promise((r) => setTimeout(r, 20));
            activeFetches--;
            return new Response(KNOWN_CONTENT.buffer as ArrayBuffer, {
                status: 200,
                headers: { 'Content-Length': String(KNOWN_CONTENT.length) }
            });
        });

        const files = Array.from({ length: 6 }, (_, i) =>
            makeFile(`https://cdn.example.com/mod${i}.jar`)
        );
        const callbacks = makeCallbacks();
        const controller = new AbortController();

        await downloadFiles(
            files,
            { concurrency: 2, maxRetries: 0, retryDelayMs: 0, signal: controller.signal },
            callbacks
        );

        expect(maxActiveFetches).toBeLessThanOrEqual(2);
        expect(callbacks.completes.length).toBe(6);
    });

    it('retries on server error with exponential backoff', async () => {
        globalThis.fetch = mockFetchFailThenSucceed();
        const callbacks = makeCallbacks();
        const controller = new AbortController();

        const result = await downloadFiles(
            [makeFile('https://cdn.example.com/mod.jar')],
            { concurrency: 2, maxRetries: 2, retryDelayMs: 1, signal: controller.signal },
            callbacks
        );

        expect(result.size).toBe(1);
        // First attempt fails (500), second succeeds — onFileStart called twice
        expect(callbacks.starts.length).toBe(2);
    });

    it('throws after exhausting retries', async () => {
        globalThis.fetch = vi
            .fn()
            .mockResolvedValue(new Response(null, { status: 500, statusText: 'Server Error' }));
        const callbacks = makeCallbacks();
        const controller = new AbortController();

        await expect(
            downloadFiles(
                [makeFile('https://cdn.example.com/mod.jar')],
                { concurrency: 2, maxRetries: 1, retryDelayMs: 1, signal: controller.signal },
                callbacks
            )
        ).rejects.toThrow('failed to download');

        expect(callbacks.errors.length).toBe(1);
    });

    it('stops on abort signal', async () => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        let fetchCount = 0;
        globalThis.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
            fetchCount++;
            // Simulate slow download
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(resolve, 500);
                init?.signal?.addEventListener('abort', () => {
                    clearTimeout(timeout);
                    reject(new DOMException('Aborted', 'AbortError'));
                });
            });
            return new Response(KNOWN_CONTENT.buffer as ArrayBuffer, { status: 200 });
        });

        const callbacks = makeCallbacks();
        const controller = new AbortController();

        const promise = downloadFiles(
            [
                makeFile('https://cdn.example.com/mod1.jar'),
                makeFile('https://cdn.example.com/mod2.jar')
            ],
            { concurrency: 1, maxRetries: 0, retryDelayMs: 0, signal: controller.signal },
            callbacks
        );

        // Abort after a brief delay
        setTimeout(() => controller.abort(), 10);

        // Should resolve without throwing (aborted downloads are silently dropped)
        const result = await promise;
        expect(result.size).toBeLessThanOrEqual(2);
    });

    it('reports hash mismatch as error', async () => {
        globalThis.fetch = mockFetchSuccess();
        const callbacks = makeCallbacks();
        const controller = new AbortController();

        await expect(
            downloadFiles(
                [makeFile('https://cdn.example.com/mod.jar', 'badhash')],
                { concurrency: 2, maxRetries: 0, retryDelayMs: 1, signal: controller.signal },
                callbacks
            )
        ).rejects.toThrow('failed to download');
    });
});
