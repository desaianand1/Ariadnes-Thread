import { describe, it, expect } from 'vitest';
import { buildReviewUrl, buildAdvisorSwitchUrl } from './url-state';

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

    it('URL-encodes IDs with special characters', () => {
        const result = buildReviewUrl(url('/review?c=abc'), {
            x: new Set(['id with spaces', 'id&special=chars'])
        });
        const parsed = new URL(result, 'http://localhost');
        const xValue = parsed.searchParams.get('x')!;
        expect(xValue).toContain('id with spaces');
        expect(xValue).toContain('id&special=chars');
    });

    it('removes x param entirely when set is empty', () => {
        const result = buildReviewUrl(url('/review?c=abc&x=old1,old2'), {
            x: new Set()
        });
        const parsed = new URL(result, 'http://localhost');
        expect(parsed.searchParams.has('x')).toBe(false);
    });

    it('sets from_v and from_l params', () => {
        const result = buildReviewUrl(url('/review?c=abc&v=1.21&l=fabric'), {
            from_v: '1.20.6',
            from_l: 'quilt'
        });
        const parsed = new URL(result, 'http://localhost');
        expect(parsed.searchParams.get('from_v')).toBe('1.20.6');
        expect(parsed.searchParams.get('from_l')).toBe('quilt');
    });
});

describe('buildAdvisorSwitchUrl', () => {
    function url(path: string): URL {
        return new URL(path, 'http://localhost');
    }

    it('sets new version and loader params', () => {
        const result = buildAdvisorSwitchUrl(
            url('/review?c=abc&v=1.21&l=fabric'),
            '1.20.6',
            'quilt',
            '1.21',
            'fabric'
        );
        const parsed = new URL(result, 'http://localhost');

        expect(parsed.searchParams.get('v')).toBe('1.20.6');
        expect(parsed.searchParams.get('l')).toBe('quilt');
    });

    it('clears exclusion param x', () => {
        const result = buildAdvisorSwitchUrl(
            url('/review?c=abc&v=1.21&l=fabric&x=id1,id2'),
            '1.20.6',
            'quilt',
            '1.21',
            'fabric'
        );
        const parsed = new URL(result, 'http://localhost');

        expect(parsed.searchParams.has('x')).toBe(false);
    });

    it('sets from_v and from_l to current version/loader for oscillation prevention', () => {
        const result = buildAdvisorSwitchUrl(
            url('/review?c=abc&v=1.21&l=fabric'),
            '1.20.6',
            'quilt',
            '1.21',
            'fabric'
        );
        const parsed = new URL(result, 'http://localhost');

        expect(parsed.searchParams.get('from_v')).toBe('1.21');
        expect(parsed.searchParams.get('from_l')).toBe('fabric');
    });

    it('accumulates switch history chain', () => {
        const result = buildAdvisorSwitchUrl(
            url('/review?c=abc&v=1.20.6&l=quilt&from_v=1.21&from_l=fabric'),
            '1.20.1',
            'fabric',
            '1.20.6',
            'quilt'
        );
        const parsed = new URL(result, 'http://localhost');

        expect(parsed.searchParams.get('from_v')).toBe('1.20.6,1.21');
        expect(parsed.searchParams.get('from_l')).toBe('quilt,fabric');
    });

    it('truncates chain at MAX_ADVISOR_HISTORY_LENGTH', () => {
        // Pre-fill with 5 entries (the max)
        const existingChainV = '1.20.4,1.20.3,1.20.2,1.20.1,1.20';
        const existingChainL = 'fabric,fabric,fabric,fabric,fabric';
        const result = buildAdvisorSwitchUrl(
            url(
                `/review?c=abc&v=1.20.6&l=fabric&from_v=${existingChainV}&from_l=${existingChainL}`
            ),
            '1.21',
            'fabric',
            '1.20.6',
            'fabric'
        );
        const parsed = new URL(result, 'http://localhost');

        const fromVersions = parsed.searchParams.get('from_v')!.split(',');
        expect(fromVersions.length).toBe(5);
        // Newest entry should be first, oldest dropped
        expect(fromVersions[0]).toBe('1.20.6');
        expect(fromVersions).not.toContain('1.20');
    });

    it('handles first switch with no existing chain', () => {
        const result = buildAdvisorSwitchUrl(
            url('/review?c=abc&v=1.21&l=fabric'),
            '1.20.1',
            'fabric',
            '1.21',
            'fabric'
        );
        const parsed = new URL(result, 'http://localhost');

        expect(parsed.searchParams.get('from_v')).toBe('1.21');
        expect(parsed.searchParams.get('from_l')).toBe('fabric');
    });

    it('preserves all other params (collection IDs, download settings)', () => {
        const result = buildAdvisorSwitchUrl(
            url('/review?c=abc,def&v=1.21&l=fabric&opts=d,f&cd=4&rc=2'),
            '1.20.6',
            'quilt',
            '1.21',
            'fabric'
        );
        const parsed = new URL(result, 'http://localhost');

        expect(parsed.searchParams.get('c')).toBe('abc,def');
        expect(parsed.searchParams.get('opts')).toBe('d,f');
        expect(parsed.searchParams.get('cd')).toBe('4');
        expect(parsed.searchParams.get('rc')).toBe('2');
    });
});
