/**
 * Concurrent file download engine.
 * Fetches files from Modrinth CDN with configurable parallelism,
 * streaming progress, exponential retry, and abort support.
 */

import {
    MAX_CONCURRENT_DOWNLOADS,
    MAX_RETRIES,
    RETRY_DELAY_MS,
    DOWNLOAD_TIMEOUT_MS
} from '$lib/config/constants';
import { verifySha1, verifySha512 } from './integrity';

export interface DownloadFile {
    fileUrl: string;
    fileSize: number;
    sha1: string;
    sha512?: string;
}

export interface DownloadCallbacks {
    onFileStart: (fileUrl: string) => void;
    onFileProgress: (fileUrl: string, bytesDownloaded: number) => void;
    onFileComplete: (fileUrl: string, data: Uint8Array) => void;
    onFileError: (fileUrl: string, error: Error) => void;
}

export interface DownloadOptions {
    concurrency?: number;
    maxRetries?: number;
    retryDelayMs?: number;
    timeoutMs?: number;
    signal: AbortSignal;
}

const ALLOWED_CDN_HOSTS = ['cdn.modrinth.com', 'cdn-raw.modrinth.com'];

function assertModrinthCdnUrl(url: string): void {
    const parsed = new URL(url);
    if (!ALLOWED_CDN_HOSTS.includes(parsed.hostname)) {
        throw new Error(`Download URL not from Modrinth CDN: ${parsed.hostname}`);
    }
}

async function fetchWithProgress(
    url: string,
    expectedSize: number,
    signal: AbortSignal,
    onProgress: (bytesDownloaded: number) => void,
    timeoutMs: number = DOWNLOAD_TIMEOUT_MS
): Promise<Uint8Array> {
    assertModrinthCdnUrl(url);
    const combinedSignal = AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]);
    const response = await fetch(url, { signal: combinedSignal });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
        // Fallback: no streaming support, read the whole response
        const buffer = await response.arrayBuffer();
        onProgress(buffer.byteLength);
        return new Uint8Array(buffer);
    }

    const chunks: Uint8Array[] = [];
    let bytesReceived = 0;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        bytesReceived += value.length;
        onProgress(bytesReceived);
    }

    // Concatenate chunks into a single buffer
    const result = new Uint8Array(bytesReceived);
    let offset = 0;
    for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
    }

    return result;
}

async function downloadWithRetry(
    file: DownloadFile,
    maxRetries: number,
    retryDelayMs: number,
    signal: AbortSignal,
    callbacks: DownloadCallbacks,
    timeoutMs: number = DOWNLOAD_TIMEOUT_MS
): Promise<{ url: string; data: Uint8Array }> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        if (signal.aborted) {
            throw new DOMException('Download cancelled', 'AbortError');
        }

        try {
            callbacks.onFileStart(file.fileUrl);

            const data = await fetchWithProgress(
                file.fileUrl,
                file.fileSize,
                signal,
                (bytes) => callbacks.onFileProgress(file.fileUrl, bytes),
                timeoutMs
            );

            const valid = await verifySha1(data, file.sha1);
            if (!valid) {
                throw new Error('SHA-1 hash mismatch — file may be corrupted');
            }

            if (file.sha512) {
                const sha512Valid = await verifySha512(data, file.sha512);
                if (!sha512Valid) {
                    throw new Error('SHA-512 hash mismatch — file may be corrupted');
                }
            }

            callbacks.onFileComplete(file.fileUrl, data);
            return { url: file.fileUrl, data };
        } catch (error) {
            if (signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
                throw new DOMException('Download cancelled', 'AbortError');
            }

            lastError = error instanceof Error ? error : new Error(String(error));

            if (attempt < maxRetries) {
                const delay = retryDelayMs * Math.pow(2, attempt);
                await new Promise<void>((resolve, reject) => {
                    const timer = setTimeout(resolve, delay);
                    signal.addEventListener(
                        'abort',
                        () => {
                            clearTimeout(timer);
                            reject(new DOMException('Download cancelled', 'AbortError'));
                        },
                        { once: true }
                    );
                });
            }
        }
    }

    callbacks.onFileError(file.fileUrl, lastError!);
    throw lastError;
}

/**
 * Download multiple files concurrently with a semaphore-based limit.
 * Returns a Map of fileUrl → downloaded Uint8Array for all successful downloads.
 */
export async function downloadFiles(
    files: DownloadFile[],
    options: DownloadOptions,
    callbacks: DownloadCallbacks
): Promise<Map<string, Uint8Array>> {
    const {
        concurrency = MAX_CONCURRENT_DOWNLOADS,
        maxRetries = MAX_RETRIES,
        retryDelayMs = RETRY_DELAY_MS,
        timeoutMs = DOWNLOAD_TIMEOUT_MS,
        signal
    } = options;

    const results = new Map<string, Uint8Array>();
    const errors: Array<{ url: string; error: Error }> = [];

    // Semaphore-based concurrency
    let activeCount = 0;
    const queue: Array<() => void> = [];

    function release() {
        activeCount--;
        const next = queue.shift();
        if (next) next();
    }

    function acquire(): Promise<void> {
        if (activeCount < concurrency) {
            activeCount++;
            return Promise.resolve();
        }
        return new Promise((resolve) => {
            queue.push(() => {
                activeCount++;
                resolve();
            });
        });
    }

    const tasks = files.map(async (file) => {
        await acquire();

        if (signal.aborted) {
            release();
            return;
        }

        try {
            const { url, data } = await downloadWithRetry(
                file,
                maxRetries,
                retryDelayMs,
                signal,
                callbacks,
                timeoutMs
            );
            results.set(url, data);
        } catch (error) {
            if (error instanceof DOMException && error.name === 'AbortError') {
                // Cancelled — don't record as error
            } else {
                errors.push({
                    url: file.fileUrl,
                    error: error instanceof Error ? error : new Error(String(error))
                });
            }
        } finally {
            release();
        }
    });

    await Promise.allSettled(tasks);

    if (errors.length > 0 && !signal.aborted) {
        const failedUrls = errors.map((e) => e.url).join(', ');
        throw new Error(`${errors.length} file(s) failed to download: ${failedUrls}`);
    }

    return results;
}
