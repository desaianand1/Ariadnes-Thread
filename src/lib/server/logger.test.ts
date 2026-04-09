import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Must mock before importing logger — getMinLevel reads this at call time
beforeEach(() => {
    (globalThis as Record<string, unknown>).__LOG_LEVEL = 'info';
});

afterEach(() => {
    delete (globalThis as Record<string, unknown>).__LOG_LEVEL;
    vi.restoreAllMocks();
});

describe('logger', () => {
    it('emits structured JSON to console.log for info level', async () => {
        const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
        const { logger } = await import('./logger');

        logger.info('test_event', { foo: 'bar' });

        expect(spy).toHaveBeenCalledOnce();
        const parsed = JSON.parse(spy.mock.calls[0][0] as string);
        expect(parsed).toMatchObject({
            level: 'info',
            event: 'test_event',
            foo: 'bar'
        });
        expect(parsed.ts).toBeTypeOf('number');
    });

    it('routes warn to console.warn', async () => {
        const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { logger } = await import('./logger');

        logger.warn('slow_request', { durationMs: 3000 });

        expect(spy).toHaveBeenCalledOnce();
        const parsed = JSON.parse(spy.mock.calls[0][0] as string);
        expect(parsed.level).toBe('warn');
        expect(parsed.event).toBe('slow_request');
    });

    it('routes error to console.error', async () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const { logger } = await import('./logger');

        logger.error('crash', { stack: 'trace' });

        expect(spy).toHaveBeenCalledOnce();
        const parsed = JSON.parse(spy.mock.calls[0][0] as string);
        expect(parsed.level).toBe('error');
    });

    it('strips undefined fields from output', async () => {
        const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
        const { logger } = await import('./logger');

        logger.info('clean', { present: 1, absent: undefined });

        const parsed = JSON.parse(spy.mock.calls[0][0] as string);
        expect(parsed.present).toBe(1);
        expect('absent' in parsed).toBe(false);
    });

    it('works with no fields argument', async () => {
        const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
        const { logger } = await import('./logger');

        logger.info('bare_event');

        const parsed = JSON.parse(spy.mock.calls[0][0] as string);
        expect(parsed.event).toBe('bare_event');
        expect(parsed.level).toBe('info');
    });
});

describe('child logger', () => {
    it('merges parent fields into every log', async () => {
        const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
        const { logger } = await import('./logger');

        const child = logger.child({ loadId: 'abc-123' });
        child.info('phase_start', { phase: 'prefetch' });

        const parsed = JSON.parse(spy.mock.calls[0][0] as string);
        expect(parsed).toMatchObject({
            loadId: 'abc-123',
            phase: 'prefetch',
            event: 'phase_start'
        });
    });

    it('child fields override parent fields', async () => {
        const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { logger } = await import('./logger');

        const child = logger.child({ scope: 'parent' });
        child.warn('override_test', { scope: 'child' });

        const parsed = JSON.parse(spy.mock.calls[0][0] as string);
        expect(parsed.scope).toBe('child');
    });

    it('does not mutate parent logger', async () => {
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        const { logger } = await import('./logger');

        logger.child({ extra: true });
        logger.info('parent_log');

        const parsed = JSON.parse(logSpy.mock.calls[0][0] as string);
        expect('extra' in parsed).toBe(false);
    });
});

describe('level gating', () => {
    it('suppresses info when LOG_LEVEL is warn', async () => {
        (globalThis as Record<string, unknown>).__LOG_LEVEL = 'warn';
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { logger } = await import('./logger');

        logger.info('should_be_suppressed');
        logger.warn('should_emit');

        expect(logSpy).not.toHaveBeenCalled();
        expect(warnSpy).toHaveBeenCalledOnce();
    });

    it('always emits error regardless of LOG_LEVEL', async () => {
        (globalThis as Record<string, unknown>).__LOG_LEVEL = 'error';
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const { logger } = await import('./logger');

        logger.info('nope');
        logger.warn('nope');
        logger.error('yes');

        expect(logSpy).not.toHaveBeenCalled();
        expect(warnSpy).not.toHaveBeenCalled();
        expect(errorSpy).toHaveBeenCalledOnce();
    });
});

describe('serializeError', () => {
    it('extracts message and name from plain Error', async () => {
        const { serializeError } = await import('./logger');
        const result = serializeError(new Error('boom'));
        expect(result).toEqual({ error: 'boom', errorName: 'Error' });
    });

    it('extracts status from ModrinthAPIError', async () => {
        const { ModrinthAPIError } = await import('$lib/api/error');
        const { serializeError } = await import('./logger');

        const err = new ModrinthAPIError('not found', 404, '/project/abc');
        const result = serializeError(err);
        expect(result).toEqual({ error: 'not found', errorName: 'ModrinthAPIError', status: 404 });
    });

    it('handles non-Error values', async () => {
        const { serializeError } = await import('./logger');
        expect(serializeError('string error')).toEqual({ error: 'string error' });
        expect(serializeError(42)).toEqual({ error: '42' });
        expect(serializeError(null)).toEqual({ error: 'null' });
    });
});
