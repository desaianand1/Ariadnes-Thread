import { describe, it, expect } from 'vitest';
import { parseCollectionId, parseReviewOptions, type ReviewParams } from './collection';

describe('parseCollectionId', () => {
    it('extracts ID from a full https URL', () => {
        expect(parseCollectionId('https://modrinth.com/collection/Abc12345')).toBe('Abc12345');
    });

    it('extracts ID from a URL without protocol', () => {
        expect(parseCollectionId('modrinth.com/collection/Abc12345')).toBe('Abc12345');
    });

    it('extracts ID from a URL with www prefix', () => {
        expect(parseCollectionId('https://www.modrinth.com/collection/Abc12345')).toBe('Abc12345');
    });

    it('extracts ID from URL with trailing slash', () => {
        expect(parseCollectionId('https://modrinth.com/collection/Abc12345/')).toBe(null);
    });

    it('extracts ID from URL with query params', () => {
        expect(parseCollectionId('https://modrinth.com/collection/Abc12345?foo=bar')).toBe(
            'Abc12345'
        );
    });

    it('accepts a valid raw 8-character base62 ID', () => {
        expect(parseCollectionId('Abc12345')).toBe('Abc12345');
    });

    it('trims whitespace from input', () => {
        expect(parseCollectionId('  Abc12345  ')).toBe('Abc12345');
    });

    it('rejects IDs shorter than 8 characters', () => {
        expect(parseCollectionId('Abc123')).toBe(null);
    });

    it('rejects IDs longer than 8 characters', () => {
        expect(parseCollectionId('Abc1234567')).toBe(null);
    });

    it('rejects IDs with special characters', () => {
        expect(parseCollectionId('Abc-1234')).toBe(null);
    });

    it('returns null for empty string', () => {
        expect(parseCollectionId('')).toBe(null);
    });

    it('returns null for whitespace-only input', () => {
        expect(parseCollectionId('   ')).toBe(null);
    });

    it('returns null for a non-modrinth URL', () => {
        expect(parseCollectionId('https://example.com/collection/Abc12345')).toBe(null);
    });

    it('returns null for a modrinth URL with wrong path', () => {
        expect(parseCollectionId('https://modrinth.com/mod/Abc12345')).toBe(null);
    });
});

describe('parseReviewOptions', () => {
    function makeParams(overrides: Partial<ReviewParams> = {}): ReviewParams {
        return {
            c: 'col1,col2',
            v: '1.20.1',
            l: 'fabric',
            opts: '',
            x: '',
            add: '',
            ...overrides
        };
    }

    it('parses collection IDs from comma-separated string', () => {
        const result = parseReviewOptions(makeParams({ c: 'aaa,bbb,ccc' }));
        expect(result.collectionIds).toEqual(['aaa', 'bbb', 'ccc']);
    });

    it('parses game version and loader', () => {
        const result = parseReviewOptions(makeParams());
        expect(result.gameVersion).toBe('1.20.1');
        expect(result.loader).toBe('fabric');
    });

    it('defaults all flags to false when opts is empty', () => {
        const result = parseReviewOptions(makeParams({ opts: '' }));
        expect(result.includeDependencies).toBe(false);
        expect(result.includeOptionalDeps).toBe(false);
        expect(result.enableCrossLoaderFallback).toBe(false);
        expect(result.allowAlphaBeta).toBe(false);
    });

    it('sets flags correctly when all are present', () => {
        const result = parseReviewOptions(makeParams({ opts: 'dofa' }));
        expect(result.includeDependencies).toBe(true);
        expect(result.includeOptionalDeps).toBe(true);
        expect(result.enableCrossLoaderFallback).toBe(true);
        expect(result.allowAlphaBeta).toBe(true);
    });

    it('handles individual flags independently', () => {
        const result = parseReviewOptions(makeParams({ opts: 'f' }));
        expect(result.includeDependencies).toBe(false);
        expect(result.enableCrossLoaderFallback).toBe(true);
    });

    it('parses excluded project IDs', () => {
        const result = parseReviewOptions(makeParams({ x: 'proj1,proj2' }));
        expect(result.excludedProjectIds).toEqual(new Set(['proj1', 'proj2']));
    });

    it('parses added project IDs', () => {
        const result = parseReviewOptions(makeParams({ add: 'extra1,extra2' }));
        expect(result.addedProjectIds).toEqual(['extra1', 'extra2']);
    });

    it('handles empty excluded/added strings', () => {
        const result = parseReviewOptions(makeParams());
        expect(result.excludedProjectIds.size).toBe(0);
        expect(result.addedProjectIds).toEqual([]);
    });

    it('filters empty segments from comma-separated values', () => {
        const result = parseReviewOptions(makeParams({ c: ',col1,,col2,' }));
        expect(result.collectionIds).toEqual(['col1', 'col2']);
    });
});
