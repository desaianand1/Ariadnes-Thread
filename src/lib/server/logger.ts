/**
 * Structured JSON logger for Cloudflare Workers.
 * All output goes through console.* → Cloudflare Observability.
 */

import { ModrinthAPIError } from '$lib/api/error';

export type LogLevel = 'info' | 'warn' | 'error';
export type LogFields = Record<string, unknown>;

const LEVEL_PRIORITY: Record<LogLevel, number> = { info: 0, warn: 1, error: 2 };

interface LoggerInstance {
    info(event: string, fields?: LogFields): void;
    warn(event: string, fields?: LogFields): void;
    error(event: string, fields?: LogFields): void;
    child(fields: LogFields): LoggerInstance;
}

function getMinLevel(): LogLevel {
    try {
        const level = (globalThis as Record<string, unknown>).__LOG_LEVEL as string | undefined;
        if (level === 'info' || level === 'warn' || level === 'error') return level;
    } catch {
        // env not available yet — default
    }
    return 'warn';
}

function shouldEmit(level: LogLevel): boolean {
    if (level === 'error') return true;
    return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[getMinLevel()];
}

function emit(level: LogLevel, event: string, boundFields: LogFields, fields?: LogFields): void {
    if (!shouldEmit(level)) return;

    const entry: LogFields = {
        level,
        event,
        ts: Date.now(),
        ...boundFields,
        ...fields
    };

    // Strip undefined values to keep output compact
    for (const key of Object.keys(entry)) {
        if (entry[key] === undefined) delete entry[key];
    }

    const line = JSON.stringify(entry);
    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.log(line);
}

function createLogger(boundFields: LogFields = {}): LoggerInstance {
    return {
        info: (event, fields) => emit('info', event, boundFields, fields),
        warn: (event, fields) => emit('warn', event, boundFields, fields),
        error: (event, fields) => emit('error', event, boundFields, fields),
        child: (fields) => createLogger({ ...boundFields, ...fields })
    };
}

/**
 * Extracts structured fields from Error/ModrinthAPIError instances.
 */
export function serializeError(e: unknown): LogFields {
    if (e instanceof ModrinthAPIError) {
        return { error: e.message, errorName: e.name, status: e.status };
    }
    if (e instanceof Error) {
        return { error: e.message, errorName: e.name };
    }
    return { error: String(e) };
}

export const logger = createLogger();
export type { LoggerInstance as Logger };
