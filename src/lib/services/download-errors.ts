/**
 * Download error classification and user-friendly message mapping.
 * Converts raw technical errors from the download engine into messages
 * safe to display in the UI.
 */

import { DOWNLOAD_MESSAGES } from '$lib/config/constants';

/**
 * Returns true for errors caused by intentional user cancellation
 * (AbortController.abort) so callers can silently discard them.
 */
export function isAbortError(error: unknown): boolean {
    if (error instanceof DOMException && error.name === 'AbortError') return true;
    return false;
}

/**
 * Map a raw download-pipeline error to a user-friendly message.
 * Patterns match the exact strings thrown by download.ts and fetchWithProgress.
 */
export function getDownloadErrorMessage(error: unknown): string {
    if (isAbortError(error)) return DOWNLOAD_MESSAGES.UNKNOWN;

    const message = error instanceof Error ? error.message : String(error);

    if (/hash mismatch/i.test(message)) return DOWNLOAD_MESSAGES.HASH_MISMATCH;
    if (/HTTP\s+403/i.test(message)) return DOWNLOAD_MESSAGES.HTTP_FORBIDDEN;
    if (/HTTP\s+404/i.test(message)) return DOWNLOAD_MESSAGES.HTTP_NOT_FOUND;
    if (/HTTP\s+5\d{2}/i.test(message)) return DOWNLOAD_MESSAGES.HTTP_SERVER_ERROR;
    if (/HTTP\s+\d{3}/i.test(message)) return DOWNLOAD_MESSAGES.HTTP_GENERIC;
    if (/file\(s\) failed to download/i.test(message)) return DOWNLOAD_MESSAGES.FILES_FAILED;

    if (error instanceof DOMException && error.name === 'TimeoutError')
        return DOWNLOAD_MESSAGES.TIMEOUT;
    if (/timeout|timed.out/i.test(message)) return DOWNLOAD_MESSAGES.TIMEOUT;

    if (/network/i.test(message) || /failed to fetch/i.test(message))
        return DOWNLOAD_MESSAGES.NETWORK_ERROR;

    return DOWNLOAD_MESSAGES.UNKNOWN;
}

/**
 * Map a per-file error string (already stringified in onFileError callbacks)
 * to a user-friendly tooltip message.
 */
export function getFileErrorMessage(errorMessage: string): string {
    if (/hash mismatch/i.test(errorMessage)) return DOWNLOAD_MESSAGES.HASH_MISMATCH;
    if (/HTTP\s+403/i.test(errorMessage)) return DOWNLOAD_MESSAGES.HTTP_FORBIDDEN;
    if (/HTTP\s+404/i.test(errorMessage)) return DOWNLOAD_MESSAGES.HTTP_NOT_FOUND;
    if (/HTTP\s+5\d{2}/i.test(errorMessage)) return DOWNLOAD_MESSAGES.HTTP_SERVER_ERROR;
    if (/HTTP\s+\d{3}/i.test(errorMessage)) return DOWNLOAD_MESSAGES.HTTP_GENERIC;
    if (/timeout|timed.out/i.test(errorMessage)) return DOWNLOAD_MESSAGES.TIMEOUT;
    if (/network/i.test(errorMessage) || /failed to fetch/i.test(errorMessage))
        return DOWNLOAD_MESSAGES.NETWORK_ERROR;
    return DOWNLOAD_MESSAGES.SINGLE_FILE_FAILED;
}
