import { describe, it, expect } from 'vitest';
import { DOWNLOAD_MESSAGES } from '$lib/config/constants';
import { isAbortError, getDownloadErrorMessage, getFileErrorMessage } from './download-errors';

describe('isAbortError', () => {
    it('returns true for DOMException with AbortError name', () => {
        const error = new DOMException('The operation was aborted', 'AbortError');

        expect(isAbortError(error)).toBe(true);
    });

    it('returns false for DOMException with different name', () => {
        const error = new DOMException('Timeout', 'TimeoutError');

        expect(isAbortError(error)).toBe(false);
    });

    it('returns false for generic Error', () => {
        const error = new Error('something broke');

        expect(isAbortError(error)).toBe(false);
    });

    it('returns false for non-error values', () => {
        expect(isAbortError(null)).toBe(false);
        expect(isAbortError('AbortError')).toBe(false);
        expect(isAbortError(undefined)).toBe(false);
    });
});

describe('getDownloadErrorMessage', () => {
    it('maps hash mismatch errors', () => {
        const error = new Error('SHA-1 hash mismatch — file may be corrupted');

        const result = getDownloadErrorMessage(error);

        expect(result).toBe(DOWNLOAD_MESSAGES.HASH_MISMATCH);
    });

    it('maps SHA-512 hash mismatch errors', () => {
        const error = new Error('SHA-512 hash mismatch — file may be corrupted');

        const result = getDownloadErrorMessage(error);

        expect(result).toBe(DOWNLOAD_MESSAGES.HASH_MISMATCH);
    });

    it('maps HTTP 403 errors', () => {
        const error = new Error('HTTP 403: Forbidden');

        const result = getDownloadErrorMessage(error);

        expect(result).toBe(DOWNLOAD_MESSAGES.HTTP_FORBIDDEN);
    });

    it('maps HTTP 404 errors', () => {
        const error = new Error('HTTP 404: Not Found');

        const result = getDownloadErrorMessage(error);

        expect(result).toBe(DOWNLOAD_MESSAGES.HTTP_NOT_FOUND);
    });

    it('maps HTTP 500 errors', () => {
        const error = new Error('HTTP 500: Internal Server Error');

        const result = getDownloadErrorMessage(error);

        expect(result).toBe(DOWNLOAD_MESSAGES.HTTP_SERVER_ERROR);
    });

    it('maps HTTP 502 errors', () => {
        const error = new Error('HTTP 502: Bad Gateway');

        const result = getDownloadErrorMessage(error);

        expect(result).toBe(DOWNLOAD_MESSAGES.HTTP_SERVER_ERROR);
    });

    it('maps HTTP 429 as generic HTTP error', () => {
        const error = new Error('HTTP 429: Too Many Requests');

        const result = getDownloadErrorMessage(error);

        expect(result).toBe(DOWNLOAD_MESSAGES.HTTP_GENERIC);
    });

    it('maps batch failure errors', () => {
        const error = new Error(
            '3 file(s) failed to download: https://cdn.modrinth.com/a, https://cdn.modrinth.com/b'
        );

        const result = getDownloadErrorMessage(error);

        expect(result).toBe(DOWNLOAD_MESSAGES.FILES_FAILED);
    });

    it('maps DOMException TimeoutError', () => {
        const error = new DOMException('Signal timed out', 'TimeoutError');

        const result = getDownloadErrorMessage(error);

        expect(result).toBe(DOWNLOAD_MESSAGES.TIMEOUT);
    });

    it('maps timeout string errors', () => {
        const error = new Error('Request timeout after 60000ms');

        const result = getDownloadErrorMessage(error);

        expect(result).toBe(DOWNLOAD_MESSAGES.TIMEOUT);
    });

    it('maps network errors', () => {
        const error = new Error('Network error');

        const result = getDownloadErrorMessage(error);

        expect(result).toBe(DOWNLOAD_MESSAGES.NETWORK_ERROR);
    });

    it('maps "Failed to fetch" errors', () => {
        const error = new TypeError('Failed to fetch');

        const result = getDownloadErrorMessage(error);

        expect(result).toBe(DOWNLOAD_MESSAGES.NETWORK_ERROR);
    });

    it('returns UNKNOWN for unrecognized errors', () => {
        const error = new Error('something completely unexpected');

        const result = getDownloadErrorMessage(error);

        expect(result).toBe(DOWNLOAD_MESSAGES.UNKNOWN);
    });

    it('returns UNKNOWN for non-Error values', () => {
        const result = getDownloadErrorMessage('raw string error');

        expect(result).toBe(DOWNLOAD_MESSAGES.UNKNOWN);
    });

    it('never exposes raw CDN URLs to users', () => {
        const error = new Error(
            '2 file(s) failed to download: https://cdn.modrinth.com/data/abc/file.jar'
        );

        const result = getDownloadErrorMessage(error);

        expect(result).not.toContain('cdn.modrinth.com');
        expect(result).not.toContain('https://');
    });

    it('never exposes raw HTTP status lines to users', () => {
        const error = new Error('HTTP 503: Service Unavailable');

        const result = getDownloadErrorMessage(error);

        expect(result).not.toContain('503');
        expect(result).not.toContain('Service Unavailable');
    });
});

describe('getFileErrorMessage', () => {
    it('maps hash mismatch errors', () => {
        const result = getFileErrorMessage('SHA-1 hash mismatch — file may be corrupted');

        expect(result).toBe(DOWNLOAD_MESSAGES.HASH_MISMATCH);
    });

    it('maps HTTP 403 errors', () => {
        const result = getFileErrorMessage('HTTP 403: Forbidden');

        expect(result).toBe(DOWNLOAD_MESSAGES.HTTP_FORBIDDEN);
    });

    it('maps HTTP 404 errors', () => {
        const result = getFileErrorMessage('HTTP 404: Not Found');

        expect(result).toBe(DOWNLOAD_MESSAGES.HTTP_NOT_FOUND);
    });

    it('maps HTTP 5xx errors', () => {
        const result = getFileErrorMessage('HTTP 500: Internal Server Error');

        expect(result).toBe(DOWNLOAD_MESSAGES.HTTP_SERVER_ERROR);
    });

    it('maps timeout errors', () => {
        const result = getFileErrorMessage('The operation timed out');

        expect(result).toBe(DOWNLOAD_MESSAGES.TIMEOUT);
    });

    it('maps network errors', () => {
        const result = getFileErrorMessage('Failed to fetch');

        expect(result).toBe(DOWNLOAD_MESSAGES.NETWORK_ERROR);
    });

    it('defaults to SINGLE_FILE_FAILED for unrecognized errors', () => {
        const result = getFileErrorMessage('some unknown issue');

        expect(result).toBe(DOWNLOAD_MESSAGES.SINGLE_FILE_FAILED);
    });
});
