import { describe, it, expect } from 'vitest';
import { chunkArray } from './array';

describe('chunkArray', () => {
    it('returns empty array for empty input', () => {
        expect(chunkArray([], 5)).toEqual([]);
    });

    it('returns a single chunk when array is smaller than chunk size', () => {
        expect(chunkArray([1, 2, 3], 10)).toEqual([[1, 2, 3]]);
    });

    it('splits evenly divisible arrays into equal chunks', () => {
        expect(chunkArray([1, 2, 3, 4, 5, 6], 3)).toEqual([
            [1, 2, 3],
            [4, 5, 6]
        ]);
    });

    it('puts remainder elements in the last chunk', () => {
        expect(chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    });

    it('creates one-element chunks when size is 1', () => {
        expect(chunkArray(['a', 'b', 'c'], 1)).toEqual([['a'], ['b'], ['c']]);
    });

    it('returns the entire array as a single chunk when size equals array length', () => {
        const arr = [1, 2, 3];
        expect(chunkArray(arr, 3)).toEqual([[1, 2, 3]]);
    });

    it('returns the entire array as a single chunk when size exceeds array length', () => {
        expect(chunkArray([1], 100)).toEqual([[1]]);
    });

    it('returns empty array when size is 0', () => {
        expect(chunkArray([1, 2, 3], 0)).toEqual([]);
    });

    it('returns empty array when size is negative', () => {
        expect(chunkArray([1, 2, 3], -1)).toEqual([]);
    });

    it('preserves element types with generics', () => {
        const objects = [{ id: 1 }, { id: 2 }, { id: 3 }];
        const chunks = chunkArray(objects, 2);
        expect(chunks).toEqual([[{ id: 1 }, { id: 2 }], [{ id: 3 }]]);
    });

    it('does not mutate the original array', () => {
        const original = [1, 2, 3, 4];
        const copy = [...original];
        chunkArray(original, 2);
        expect(original).toEqual(copy);
    });
});
