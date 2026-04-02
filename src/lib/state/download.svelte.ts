/**
 * Download lifecycle state management using Svelte 5 runes.
 * Orchestrates file downloading, hash verification, and ZIP generation.
 */

import {
    MAX_CONCURRENT_DOWNLOADS,
    MIN_CONCURRENT_DOWNLOADS,
    MAX_CONCURRENT_DOWNLOADS_LIMIT,
    MAX_RETRIES,
    MIN_RETRY_COUNT,
    MAX_RETRY_COUNT_LIMIT,
    RETRY_DELAY_MS
} from '$lib/config/constants';
import { downloadFiles, type DownloadCallbacks } from '$lib/services/download';
import { buildSideZips, type ZipFileInfo } from '$lib/services/zip';
import type { ResolvedProject, SideClassification } from '$lib/services/types';
import { SvelteMap, SvelteSet } from 'svelte/reactivity';

// =============================================================================
// Types
// =============================================================================

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
    targetSide: 'client' | 'server' | null;
    files: FileProgress[];
    overallBytesDownloaded: number;
    overallTotalBytes: number;
    startedAt: number | null;
    speedBytesPerSec: number;
    eta: number;
    zipBlob: Blob | null;
    zipSize: number;
    errorMessage: string | null;
    abortController: AbortController | null;
    concurrentDownloads?: number;
    retryCount?: number;
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
    zipBlob: null,
    zipSize: 0,
    errorMessage: null,
    abortController: null
};

const state = $state<DownloadState>({ ...INITIAL_STATE });

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

/**
 * Filter projects by the target side and populate file progress entries.
 */
export function initDownload(
    projects: ResolvedProject[],
    side: 'client' | 'server',
    settings?: { concurrentDownloads?: number; retryCount?: number }
): void {
    const filtered = projects.filter((p) => p.side === side || p.side === 'both');

    // Deduplicate by fileUrl
    const seen = new SvelteSet<string>();
    const deduped = filtered.filter((p) => {
        if (seen.has(p.fileUrl)) return false;
        seen.add(p.fileUrl);
        return true;
    });

    state.phase = 'idle';
    state.targetSide = side;
    state.files = deduped.map((p) => ({
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
    state.overallTotalBytes = deduped.reduce((sum, p) => sum + p.fileSize, 0);
    state.startedAt = null;
    state.speedBytesPerSec = 0;
    state.eta = 0;
    state.zipBlob = null;
    state.zipSize = 0;
    state.errorMessage = null;
    state.concurrentDownloads = settings?.concurrentDownloads;
    state.retryCount = settings?.retryCount;
    state.abortController = new AbortController();
    speedSamples = [];
}

/**
 * Run the full download → verify → zip pipeline.
 */
export async function startDownload(): Promise<void> {
    if (state.files.length === 0 || !state.abortController) return;

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
        onFileComplete(fileUrl: string, _data: Uint8Array) {
            const file = filesByUrl.get(fileUrl);
            if (file) file.status = 'complete';
        },
        onFileError(fileUrl: string, error: Error) {
            const file = filesByUrl.get(fileUrl);
            if (file) {
                file.status = 'error';
                file.error = error.message;
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

        const data = await downloadFiles(
            downloadInput,
            {
                concurrency,
                maxRetries,
                retryDelayMs: RETRY_DELAY_MS,
                signal: state.abortController.signal
            },
            callbacks
        );

        if (state.abortController.signal.aborted) return;

        state.phase = 'verifying';
        await new Promise((resolve) => setTimeout(resolve, 0));

        // Build ZIP
        state.phase = 'zipping';

        const zipFileInfos: ZipFileInfo[] = state.files.map((f) => ({
            fileName: f.fileName,
            fileUrl: f.fileUrl,
            folder: f.folder,
            side: f.side
        }));

        const zips = buildSideZips(zipFileInfos, data);
        const targetZip = state.targetSide === 'client' ? zips.client : zips.server;

        state.zipBlob = targetZip;
        state.zipSize = targetZip?.size ?? 0;
        state.phase = 'complete';
    } catch (error) {
        if (state.abortController?.signal.aborted) return;
        state.phase = 'error';
        state.errorMessage = error instanceof Error ? error.message : String(error);
    }
}

export function cancelDownload(): void {
    state.abortController?.abort();
    resetDownload();
}

export function resetDownload(): void {
    Object.assign(state, { ...INITIAL_STATE, abortController: null });
    speedSamples = [];
}

export { state as downloadState };
