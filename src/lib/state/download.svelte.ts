/**
 * Download lifecycle state management using Svelte 5 runes.
 * Orchestrates file downloading, hash verification, and ZIP generation.
 *
 * Maintains a module-level download cache so cross-side downloads
 * (client → server) can skip already-fetched files.
 */

import {
    MAX_CONCURRENT_DOWNLOADS,
    MIN_CONCURRENT_DOWNLOADS,
    MAX_CONCURRENT_DOWNLOADS_LIMIT,
    MAX_RETRIES,
    MIN_RETRY_COUNT,
    MAX_RETRY_COUNT_LIMIT,
    RETRY_DELAY_MS,
    INLINE_DOWNLOAD_FILE_THRESHOLD,
    DOWNLOAD_MESSAGES
} from '$lib/config/constants';
import { downloadFiles, type DownloadCallbacks } from '$lib/services/download';
import {
    isAbortError,
    getDownloadErrorMessage,
    getFileErrorMessage
} from '$lib/services/download-errors';
import { buildSideZips, type ZipFileInfo } from '$lib/services/zip';
import type { ResolvedProject, SideClassification } from '$lib/services/types';
import { SvelteMap, SvelteSet } from 'svelte/reactivity';

// =============================================================================
// Types
// =============================================================================

export type DownloadSide = Exclude<SideClassification, 'both'>;
export type FileStatus = 'queued' | 'downloading' | 'verifying' | 'complete' | 'error';
export type DownloadPhase = 'idle' | 'downloading' | 'verifying' | 'zipping' | 'complete' | 'error';

export interface FileProgress {
    projectId: string;
    projectTitle: string;
    fileName: string;
    fileUrl: string;
    fileSize: number;
    sha1: string;
    sha512?: string;
    folder: string;
    side: SideClassification;
    iconUrl?: string;
    status: FileStatus;
    bytesDownloaded: number;
    error?: string;
}

export interface DownloadState {
    phase: DownloadPhase;
    targetSide: DownloadSide | null;
    files: FileProgress[];
    overallBytesDownloaded: number;
    overallTotalBytes: number;
    startedAt: number | null;
    speedBytesPerSec: number;
    eta: number;
    clientZipBlob: Blob | null;
    clientZipSize: number;
    serverZipBlob: Blob | null;
    serverZipSize: number;
    /** Tracks which sides the user explicitly completed downloads for */
    completedSides: SvelteSet<DownloadSide>;
    isMiniProgress: boolean;
    errorMessage: string | null;
    abortController: AbortController | null;
    concurrentDownloads?: number;
    retryCount?: number;
    sessionKey: string | null;
}

// =============================================================================
// State
// =============================================================================

const INITIAL_STATE: DownloadState = {
    phase: 'idle',
    targetSide: null,
    files: [],
    overallBytesDownloaded: 0,
    overallTotalBytes: 0,
    startedAt: null,
    speedBytesPerSec: 0,
    eta: 0,
    clientZipBlob: null,
    clientZipSize: 0,
    serverZipBlob: null,
    serverZipSize: 0,
    completedSides: new SvelteSet(),
    isMiniProgress: false,
    errorMessage: null,
    abortController: null,
    sessionKey: null
};

const state = $state<DownloadState>({ ...INITIAL_STATE });

// Module-level cache: fileUrl → downloaded bytes, persists across initDownload calls
const downloadCache = new SvelteMap<string, Uint8Array>();

// All file infos seen so far (for building ZIPs across both sides)
let allFileInfos: ZipFileInfo[] = [];

// Rolling window for speed calculation
let speedSamples: Array<{ time: number; bytes: number }> = [];
const SPEED_WINDOW_MS = 3000;

function updateSpeed() {
    const now = Date.now();
    speedSamples.push({ time: now, bytes: state.overallBytesDownloaded });
    speedSamples = speedSamples.filter((s) => now - s.time <= SPEED_WINDOW_MS);

    if (speedSamples.length < 2) {
        state.speedBytesPerSec = 0;
        state.eta = Infinity;
        return;
    }

    const oldest = speedSamples[0];
    const elapsed = (now - oldest.time) / 1000;
    const bytesInWindow = state.overallBytesDownloaded - oldest.bytes;
    state.speedBytesPerSec = elapsed > 0 ? bytesInWindow / elapsed : 0;

    const remaining = state.overallTotalBytes - state.overallBytesDownloaded;
    state.eta = state.speedBytesPerSec > 0 ? remaining / state.speedBytesPerSec : Infinity;
}

// =============================================================================
// Exported Functions
// =============================================================================

export function getDownloadState(): DownloadState {
    return state;
}

/** Total bytes held in the download cache */
export function getCacheSize(): number {
    let total = 0;
    for (const data of downloadCache.values()) {
        total += data.byteLength;
    }
    return total;
}

/**
 * Filter projects by the target side and populate file progress entries.
 * Files already in downloadCache are excluded from the download queue.
 */
/**
 * Returns true when download state belongs to a different review session
 * (different collections, version, or loader) and should be discarded.
 */
export function isStaleSession(currentKey: string): boolean {
    return state.phase !== 'idle' && state.sessionKey !== null && state.sessionKey !== currentKey;
}

export function initDownload(
    projects: ResolvedProject[],
    side: DownloadSide,
    settings?: { concurrentDownloads?: number; retryCount?: number; sessionKey?: string }
): void {
    const filtered = projects.filter((p) => p.side === side || p.side === 'both');

    // Deduplicate by fileUrl
    const seen = new SvelteSet<string>();
    const deduped = filtered.filter((p) => {
        if (seen.has(p.fileUrl)) return false;
        seen.add(p.fileUrl);
        return true;
    });

    // Accumulate file infos for cross-side ZIP building
    for (const p of deduped) {
        if (!allFileInfos.some((f) => f.fileUrl === p.fileUrl)) {
            allFileInfos.push({
                fileName: p.fileName,
                fileUrl: p.fileUrl,
                folder: p.folder,
                side: p.side
            });
        }
    }

    // Filter out files already in cache
    const toDownload = deduped.filter((p) => !downloadCache.has(p.fileUrl));

    state.phase = 'idle';
    state.targetSide = side;
    state.files = toDownload.map((p) => ({
        projectId: p.projectId,
        projectTitle: p.projectTitle,
        fileName: p.fileName,
        fileUrl: p.fileUrl,
        fileSize: p.fileSize,
        sha1: p.fileHashes.sha1,
        sha512: p.fileHashes.sha512,
        folder: p.folder,
        side: p.side,
        iconUrl: p.iconUrl,
        status: 'queued' as FileStatus,
        bytesDownloaded: 0
    }));
    state.overallBytesDownloaded = 0;
    state.overallTotalBytes = toDownload.reduce((sum, p) => sum + p.fileSize, 0);
    state.startedAt = null;
    state.speedBytesPerSec = 0;
    state.eta = 0;
    state.isMiniProgress = toDownload.length <= INLINE_DOWNLOAD_FILE_THRESHOLD;
    state.errorMessage = null;
    state.concurrentDownloads = settings?.concurrentDownloads;
    state.retryCount = settings?.retryCount;
    state.sessionKey = settings?.sessionKey ?? null;
    state.abortController = new AbortController();
    speedSamples = [];
}

/**
 * Run the full download → verify → zip pipeline.
 * If all files are cached, skips directly to zipping.
 */
export async function startDownload(): Promise<void> {
    if (!state.abortController) return;

    // Capture signal once so abort checks remain valid even after
    // cancelDownload() nulls state.abortController mid-pipeline.
    const signal = state.abortController.signal;

    const hasFilesToDownload = state.files.length > 0;

    if (hasFilesToDownload) {
        state.phase = 'downloading';
        state.startedAt = Date.now();

        const filesByUrl = new SvelteMap(state.files.map((f) => [f.fileUrl, f]));

        const callbacks: DownloadCallbacks = {
            onFileStart(fileUrl: string) {
                const file = filesByUrl.get(fileUrl);
                if (file) file.status = 'downloading';
            },
            onFileProgress(fileUrl: string, bytesDownloaded: number) {
                const file = filesByUrl.get(fileUrl);
                if (!file) return;
                const delta = bytesDownloaded - file.bytesDownloaded;
                file.bytesDownloaded = bytesDownloaded;
                state.overallBytesDownloaded += delta;
                updateSpeed();
            },
            onFileComplete(fileUrl: string, data: Uint8Array) {
                const file = filesByUrl.get(fileUrl);
                if (file) file.status = 'complete';
                downloadCache.set(fileUrl, data);
            },
            onFileError(fileUrl: string, error: Error) {
                const file = filesByUrl.get(fileUrl);
                if (file) {
                    file.status = 'error';
                    file.error = getFileErrorMessage(error.message);
                }
            }
        };

        const concurrency = Math.max(
            MIN_CONCURRENT_DOWNLOADS,
            Math.min(
                MAX_CONCURRENT_DOWNLOADS_LIMIT,
                state.concurrentDownloads ?? MAX_CONCURRENT_DOWNLOADS
            )
        );
        const maxRetries = Math.max(
            MIN_RETRY_COUNT,
            Math.min(MAX_RETRY_COUNT_LIMIT, state.retryCount ?? MAX_RETRIES)
        );

        try {
            const downloadInput = state.files.map((f) => ({
                fileUrl: f.fileUrl,
                fileSize: f.fileSize,
                sha1: f.sha1,
                sha512: f.sha512
            }));

            await downloadFiles(
                downloadInput,
                {
                    concurrency,
                    maxRetries,
                    retryDelayMs: RETRY_DELAY_MS,
                    signal
                },
                callbacks
            );

            if (signal.aborted) return;
        } catch (error) {
            if (signal.aborted || isAbortError(error)) return;
            state.phase = 'error';
            state.errorMessage = getDownloadErrorMessage(error);
            return;
        }
    }

    if (signal.aborted) return;

    // Verification phase
    state.phase = 'verifying';
    await new Promise((resolve) => setTimeout(resolve, 0));

    if (signal.aborted) return;

    // Build ZIPs using all accumulated file infos + full cache
    state.phase = 'zipping';

    try {
        const zips = buildSideZips(allFileInfos, downloadCache);

        if (zips.client) {
            state.clientZipBlob = zips.client;
            state.clientZipSize = zips.client.size;
        }
        if (zips.server) {
            state.serverZipBlob = zips.server;
            state.serverZipSize = zips.server.size;
        }

        if (state.targetSide) state.completedSides.add(state.targetSide);
        state.phase = 'complete';
    } catch (error) {
        if (signal.aborted || isAbortError(error)) return;
        state.phase = 'error';
        state.errorMessage = DOWNLOAD_MESSAGES.ZIP_FAILED;
    }
}

export function cancelDownload(): void {
    state.abortController?.abort();
    resetDownload();
}

/** Soft reset: clears UI state but preserves downloadCache, zip blobs, and completedSides */
export function resetDownload(): void {
    const preservedClient = state.clientZipBlob;
    const preservedClientSize = state.clientZipSize;
    const preservedServer = state.serverZipBlob;
    const preservedServerSize = state.serverZipSize;
    const preservedSides = state.completedSides;

    Object.assign(state, { ...INITIAL_STATE, abortController: null });

    state.clientZipBlob = preservedClient;
    state.clientZipSize = preservedClientSize;
    state.serverZipBlob = preservedServer;
    state.serverZipSize = preservedServerSize;
    state.completedSides = preservedSides;

    speedSamples = [];
}

/** Full reset: clears everything including cache (called on "Back to Review") */
export function resetDownloadFull(): void {
    Object.assign(state, { ...INITIAL_STATE, abortController: null });
    downloadCache.clear();
    allFileInfos = [];
    speedSamples = [];
}

export { state as downloadState };
