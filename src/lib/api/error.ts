/**
 * Custom error classes for Modrinth API interactions
 */

/**
 * Base error class for all Modrinth API errors
 */
export class ModrinthAPIError extends Error {
    constructor(
        message: string,
        public readonly status: number,
        public readonly endpoint: string,
        public readonly details?: unknown
    ) {
        super(message);
        this.name = 'ModrinthAPIError';
    }
}

/**
 * Client error (4xx status codes except 429)
 * Indicates issues with the request that the client should fix
 */
export class ClientError extends ModrinthAPIError {
    constructor(message: string, status: number, endpoint: string, details?: unknown) {
        super(message, status, endpoint, details);
        this.name = 'ClientError';
    }
}

/**
 * Server error (5xx status codes)
 * Indicates issues on the Modrinth server side
 */
export class ServerError extends ModrinthAPIError {
    constructor(message: string, status: number, endpoint: string, details?: unknown) {
        super(message, status, endpoint, details);
        this.name = 'ServerError';
    }
}

/**
 * Rate limit error (429 status code)
 * Indicates we've exceeded the API rate limit
 */
export class RateLimitError extends ModrinthAPIError {
    constructor(
        public readonly retryAfter: number | 'never',
        endpoint: string,
        details?: unknown
    ) {
        super('Rate limit exceeded', 429, endpoint, details);
        this.name = 'RateLimitError';
    }
}

/**
 * Collection not found error (404 for collections)
 */
export class CollectionNotFoundError extends ClientError {
    constructor(collectionId: string) {
        super(`Collection not found: ${collectionId}`, 404, 'collection');
        this.name = 'CollectionNotFoundError';
    }
}

/**
 * Project not found error (404 for projects)
 */
export class ProjectNotFoundError extends ClientError {
    constructor(projectId: string) {
        super(`Project not found: ${projectId}`, 404, 'project');
        this.name = 'ProjectNotFoundError';
    }
}

/**
 * Incompatible mod error
 * Thrown when a mod doesn't have a compatible version for the selected loader/version
 */
export class IncompatibleModError extends Error {
    constructor(
        public readonly modName: string,
        public readonly requestedVersion: string,
        public readonly requestedLoader: string,
        public readonly availableVersions: string[]
    ) {
        super(`${modName} not compatible with ${requestedLoader} ${requestedVersion}`);
        this.name = 'IncompatibleModError';
    }
}

/**
 * Network error for connectivity issues
 */
export class NetworkError extends Error {
    constructor(
        message: string,
        public readonly originalError?: unknown
    ) {
        super(message);
        this.name = 'NetworkError';
    }
}

/**
 * Type guard to check if an error is a ModrinthAPIError
 */
export function isModrinthAPIError(error: unknown): error is ModrinthAPIError {
    return error instanceof ModrinthAPIError;
}

/**
 * Type guard to check if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
    if (error instanceof RateLimitError) {
        return error.retryAfter !== 'never';
    }
    if (error instanceof ServerError) {
        return true;
    }
    if (error instanceof NetworkError) {
        return true;
    }
    return false;
}

/**
 * Get a user-friendly error message from an error
 */
export function getErrorMessage(error: unknown): string {
    if (error instanceof CollectionNotFoundError) {
        return 'The collection could not be found. Please check the URL or ID.';
    }
    if (error instanceof ProjectNotFoundError) {
        return 'The project could not be found.';
    }
    if (error instanceof RateLimitError) {
        if (error.retryAfter === 'never') {
            return 'Rate limit exceeded. Please try again later.';
        }
        return `Rate limit exceeded. Please wait ${error.retryAfter} seconds.`;
    }
    if (error instanceof ServerError) {
        return 'Modrinth is experiencing issues. Please try again later.';
    }
    if (error instanceof NetworkError) {
        return 'Network error. Please check your connection.';
    }
    if (error instanceof IncompatibleModError) {
        return error.message;
    }
    if (error instanceof Error) {
        console.error('Unexpected error:', error.message);
        return error.message;
    }
    return 'An unexpected error occurred.';
}
