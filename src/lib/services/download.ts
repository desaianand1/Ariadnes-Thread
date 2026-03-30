/**
 * Concurrent file download engine.
 * Fetches files from Modrinth CDN with configurable parallelism,
 * streaming progress, exponential retry, and abort support.
 */

import { MAX_CONCURRENT_DOWNLOADS, MAX_RETRIES, RETRY_DELAY_MS } from '$lib/config/constants';
import { verifySha1 } from './integrity';

export interface DownloadFile {
    fileUrl: string;
    fileSize: number;
    sha1: string;
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
    signal: AbortSignal;
}

async function fetchWithProgress(
    url: string,
    expectedSize: number,
    signal: AbortSignal,
    onProgress: (bytesDownloaded: number) => void
): Promise<Uint8Array> {
    const response = await fetch(url, { signal });

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

    const totalSize = Number(response.headers.get('Content-Length')) || expectedSize;
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
    const result = new Uint8Array(totalSize > 0 ? bytesReceived : bytesReceived);
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
    callbacks: DownloadCallbacks
): Promise<{ url: string; data: Uint8Array }> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        if (signal.aborted) {
            throw new DOMException('Download cancelled', 'AbortError');
        }

        try {
            callbacks.onFileStart(file.fileUrl);

            const data = await fetchWithProgress(file.fileUrl, file.fileSize, signal, (bytes) =>
                callbacks.onFileProgress(file.fileUrl, bytes)
            );

            const valid = await verifySha1(data, file.sha1);
            if (!valid) {
                throw new Error('SHA-1 hash mismatch — file may be corrupted');
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
                await new Promise((resolve) => setTimeout(resolve, delay));
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
                callbacks
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
