import { describe, it, expect, vi, afterEach } from 'vitest';
import { downloadFiles, type DownloadCallbacks, type DownloadFile } from './download';

const KNOWN_CONTENT = new TextEncoder().encode('hello world');
// SHA-1 of "hello world"
const KNOWN_SHA1 = '2aae6c35c94fcfb415dbe95f408b9ce91ee846ed';
// SHA-512 of "hello world"
const KNOWN_SHA512 =
    '309ecc489c12d6eb4cc40f50c902f2b4d0ed77ee511a7c7a9bcd3ca86d4cd86f989dd35bc5ff499670da34255b45b0cfd830e81f605dcf7dc5542e93ae9cd76f';

function makeFile(url: string, sha1 = KNOWN_SHA1, sha512?: string): DownloadFile {
    return { fileUrl: url, fileSize: KNOWN_CONTENT.length, sha1, sha512 };
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
            [makeFile('https://cdn.modrinth.com/mod1.jar')],
            { concurrency: 2, maxRetries: 0, retryDelayMs: 0, signal: controller.signal },
            callbacks
        );

        expect(result.size).toBe(1);
        expect(result.has('https://cdn.modrinth.com/mod1.jar')).toBe(true);
        expect(callbacks.completes).toContain('https://cdn.modrinth.com/mod1.jar');
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
            makeFile(`https://cdn.modrinth.com/mod${i}.jar`)
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
            [makeFile('https://cdn.modrinth.com/mod.jar')],
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
                [makeFile('https://cdn.modrinth.com/mod.jar')],
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
                makeFile('https://cdn.modrinth.com/mod1.jar'),
                makeFile('https://cdn.modrinth.com/mod2.jar')
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

    it('completes partial downloads when some files fail after retry exhaustion', async () => {
        const badUrl = 'https://cdn.modrinth.com/bad.jar';
        const goodUrls = [
            'https://cdn.modrinth.com/good1.jar',
            'https://cdn.modrinth.com/good2.jar'
        ];

        globalThis.fetch = vi.fn().mockImplementation((url: string) => {
            if (url === badUrl) {
                return Promise.resolve(
                    new Response(null, { status: 500, statusText: 'Server Error' })
                );
            }
            return Promise.resolve(
                new Response(KNOWN_CONTENT.buffer as ArrayBuffer, {
                    status: 200,
                    headers: { 'Content-Length': String(KNOWN_CONTENT.length) }
                })
            );
        });

        const callbacks = makeCallbacks();
        const controller = new AbortController();

        await expect(
            downloadFiles(
                [makeFile(goodUrls[0]), makeFile(badUrl), makeFile(goodUrls[1])],
                { concurrency: 4, maxRetries: 2, retryDelayMs: 1, signal: controller.signal },
                callbacks
            )
        ).rejects.toThrow('failed to download');

        // Good files completed via callbacks
        expect(callbacks.completes).toContain(goodUrls[0]);
        expect(callbacks.completes).toContain(goodUrls[1]);

        // Bad file errored
        expect(callbacks.errors).toContain(badUrl);

        // Bad file was retried: 1 initial + 2 retries = 3 starts for the bad URL
        const badStarts = callbacks.starts.filter((u) => u === badUrl);
        expect(badStarts.length).toBe(3);
    });

    it('reports hash mismatch as error', async () => {
        globalThis.fetch = mockFetchSuccess();
        const callbacks = makeCallbacks();
        const controller = new AbortController();

        await expect(
            downloadFiles(
                [makeFile('https://cdn.modrinth.com/mod.jar', 'badhash')],
                { concurrency: 2, maxRetries: 0, retryDelayMs: 1, signal: controller.signal },
                callbacks
            )
        ).rejects.toThrow('failed to download');
    });

    it('rejects URLs not from Modrinth CDN', async () => {
        const fetchSpy = mockFetchSuccess();
        globalThis.fetch = fetchSpy;
        const callbacks = makeCallbacks();
        const controller = new AbortController();

        await expect(
            downloadFiles(
                [makeFile('https://evil.example.com/malware.jar')],
                { concurrency: 2, maxRetries: 0, retryDelayMs: 0, signal: controller.signal },
                callbacks
            )
        ).rejects.toThrow('failed to download');

        // fetch should never have been called — rejected before network request
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('allows cdn-raw.modrinth.com URLs', async () => {
        globalThis.fetch = mockFetchSuccess();
        const callbacks = makeCallbacks();
        const controller = new AbortController();

        const result = await downloadFiles(
            [makeFile('https://cdn-raw.modrinth.com/mod.jar')],
            { concurrency: 2, maxRetries: 0, retryDelayMs: 0, signal: controller.signal },
            callbacks
        );

        expect(result.size).toBe(1);
    });

    it('verifies SHA-512 when provided alongside SHA-1', async () => {
        globalThis.fetch = mockFetchSuccess();
        const callbacks = makeCallbacks();
        const controller = new AbortController();

        const result = await downloadFiles(
            [makeFile('https://cdn.modrinth.com/mod.jar', KNOWN_SHA1, KNOWN_SHA512)],
            { concurrency: 2, maxRetries: 0, retryDelayMs: 0, signal: controller.signal },
            callbacks
        );

        expect(result.size).toBe(1);
        expect(callbacks.completes).toContain('https://cdn.modrinth.com/mod.jar');
    });

    it('reports SHA-512 mismatch as error', async () => {
        globalThis.fetch = mockFetchSuccess();
        const callbacks = makeCallbacks();
        const controller = new AbortController();

        await expect(
            downloadFiles(
                [makeFile('https://cdn.modrinth.com/mod.jar', KNOWN_SHA1, 'bad512hash')],
                { concurrency: 2, maxRetries: 0, retryDelayMs: 0, signal: controller.signal },
                callbacks
            )
        ).rejects.toThrow('failed to download');
    });

    it('skips SHA-512 verification when hash is not provided', async () => {
        globalThis.fetch = mockFetchSuccess();
        const callbacks = makeCallbacks();
        const controller = new AbortController();

        const result = await downloadFiles(
            [makeFile('https://cdn.modrinth.com/mod.jar', KNOWN_SHA1)],
            { concurrency: 2, maxRetries: 0, retryDelayMs: 0, signal: controller.signal },
            callbacks
        );

        expect(result.size).toBe(1);
        expect(callbacks.completes).toContain('https://cdn.modrinth.com/mod.jar');
    });

    it('returns empty map for zero files without error', async () => {
        const callbacks = makeCallbacks();
        const controller = new AbortController();

        const result = await downloadFiles(
            [],
            { concurrency: 2, maxRetries: 0, retryDelayMs: 0, signal: controller.signal },
            callbacks
        );

        expect(result.size).toBe(0);
        expect(callbacks.starts).toHaveLength(0);
        expect(callbacks.errors).toHaveLength(0);
    });

    it('fails immediately without retrying when maxRetries is 0', async () => {
        const fetchSpy = vi
            .fn()
            .mockResolvedValue(new Response(null, { status: 500, statusText: 'Server Error' }));
        globalThis.fetch = fetchSpy;
        const callbacks = makeCallbacks();
        const controller = new AbortController();

        await expect(
            downloadFiles(
                [makeFile('https://cdn.modrinth.com/mod.jar')],
                { concurrency: 2, maxRetries: 0, retryDelayMs: 0, signal: controller.signal },
                callbacks
            )
        ).rejects.toThrow('failed to download');

        expect(fetchSpy).toHaveBeenCalledTimes(1);
        expect(callbacks.starts).toHaveLength(1);
    });

    it('rejects URLs with subdomain spoofing of Modrinth CDN', async () => {
        const fetchSpy = mockFetchSuccess();
        globalThis.fetch = fetchSpy;
        const callbacks = makeCallbacks();
        const controller = new AbortController();

        await expect(
            downloadFiles(
                [makeFile('https://cdn.modrinth.com.evil.com/mod.jar')],
                { concurrency: 2, maxRetries: 0, retryDelayMs: 0, signal: controller.signal },
                callbacks
            )
        ).rejects.toThrow('failed to download');

        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('cancels immediately during retry wait', async () => {
        // Always return 500 to force retries
        globalThis.fetch = vi
            .fn()
            .mockResolvedValue(new Response(null, { status: 500, statusText: 'Server Error' }));
        const callbacks = makeCallbacks();
        const controller = new AbortController();

        const promise = downloadFiles(
            [makeFile('https://cdn.modrinth.com/mod.jar')],
            { concurrency: 1, maxRetries: 3, retryDelayMs: 60_000, signal: controller.signal },
            callbacks
        );

        // Abort shortly after the first attempt fails and retry wait begins
        setTimeout(() => controller.abort(), 50);

        // Should resolve quickly (not wait 60s for retry delay)
        const result = await promise;
        expect(result.size).toBe(0);
    });
});
