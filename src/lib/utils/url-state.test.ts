import { describe, it, expect } from 'vitest';
import { buildReviewUrl } from './url-state';

describe('buildReviewUrl', () => {
    function url(path: string): URL {
        return new URL(path, 'http://localhost');
    }

    it('adds x param when exclusions are provided', () => {
        const result = buildReviewUrl(url('/review?c=abc&v=1.20.1&l=fabric'), {
            x: new Set(['id1', 'id2'])
        });
        const parsed = new URL(result, 'http://localhost');
        const xValue = parsed.searchParams.get('x')!;
        expect(xValue.split(',')).toEqual(expect.arrayContaining(['id1', 'id2']));
    });

    it('removes x param when exclusions set is empty', () => {
        const result = buildReviewUrl(url('/review?c=abc&x=old'), {
            x: new Set()
        });
        expect(result).not.toContain('x=');
    });

    it('preserves other params when updating x', () => {
        const result = buildReviewUrl(url('/review?c=abc&v=1.20.1&l=fabric'), {
            x: new Set(['id1'])
        });
        const parsed = new URL(result, 'http://localhost');
        expect(parsed.searchParams.get('c')).toBe('abc');
        expect(parsed.searchParams.get('v')).toBe('1.20.1');
        expect(parsed.searchParams.get('l')).toBe('fabric');
        expect(parsed.searchParams.get('x')).toBe('id1');
    });

    it('returns clean path when no params remain', () => {
        const result = buildReviewUrl(url('/review?x=old'), { x: new Set() });
        expect(result).toBe('/review');
    });

    it('does not touch x when updates.x is undefined', () => {
        const result = buildReviewUrl(url('/review?x=existing&c=abc'), {});
        expect(result).toContain('x=existing');
    });
});
