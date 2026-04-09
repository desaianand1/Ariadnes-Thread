import { describe, it, expect } from 'vitest';
import {
    toSerializableOptions,
    fromSerializableOptions,
    deserializeProjectTypes
} from './resolution-cache.types';
import type { ResolutionOptions } from './types';

describe('toSerializableOptions / fromSerializableOptions', () => {
    it('round-trips options with populated excludedProjectIds', () => {
        const original: ResolutionOptions = {
            gameVersion: '1.20.1',
            loader: 'fabric',
            includeDependencies: true,
            includeOptionalDeps: false,
            enableCrossLoaderFallback: true,
            allowAlphaBeta: false,
            excludedProjectIds: new Set(['proj1', 'proj2', 'proj3'])
        };

        const serialized = toSerializableOptions(original);
        const restored = fromSerializableOptions(serialized);

        expect(restored.gameVersion).toBe(original.gameVersion);
        expect(restored.loader).toBe(original.loader);
        expect(restored.includeDependencies).toBe(original.includeDependencies);
        expect(restored.includeOptionalDeps).toBe(original.includeOptionalDeps);
        expect(restored.enableCrossLoaderFallback).toBe(original.enableCrossLoaderFallback);
        expect(restored.allowAlphaBeta).toBe(original.allowAlphaBeta);
        expect(restored.excludedProjectIds).toEqual(original.excludedProjectIds);
        expect(restored.excludedProjectIds).toBeInstanceOf(Set);
    });

    it('round-trips options with empty excludedProjectIds', () => {
        const original: ResolutionOptions = {
            gameVersion: '1.21',
            loader: 'forge',
            includeDependencies: false,
            includeOptionalDeps: true,
            enableCrossLoaderFallback: false,
            allowAlphaBeta: true,
            excludedProjectIds: new Set()
        };

        const serialized = toSerializableOptions(original);
        const restored = fromSerializableOptions(serialized);

        expect(restored.excludedProjectIds).toEqual(new Set());
        expect(restored.excludedProjectIds).toBeInstanceOf(Set);
        expect(serialized.excludedProjectIds).toEqual([]);
    });

    it('serializes excludedProjectIds as a plain array', () => {
        const options: ResolutionOptions = {
            gameVersion: '1.20.1',
            loader: 'fabric',
            includeDependencies: true,
            includeOptionalDeps: false,
            enableCrossLoaderFallback: false,
            allowAlphaBeta: false,
            excludedProjectIds: new Set(['a', 'b'])
        };

        const serialized = toSerializableOptions(options);

        expect(Array.isArray(serialized.excludedProjectIds)).toBe(true);
        expect(serialized.excludedProjectIds.sort()).toEqual(['a', 'b']);
    });
});

describe('deserializeProjectTypes', () => {
    it('returns undefined for undefined input', () => {
        expect(deserializeProjectTypes(undefined)).toBeUndefined();
    });

    it('converts a populated record to a Map', () => {
        const record = { proj1: 'mod', proj2: 'resourcepack', proj3: 'shader' };

        const result = deserializeProjectTypes(record);

        expect(result).toBeInstanceOf(Map);
        expect(result!.size).toBe(3);
        expect(result!.get('proj1')).toBe('mod');
        expect(result!.get('proj2')).toBe('resourcepack');
        expect(result!.get('proj3')).toBe('shader');
    });

    it('converts an empty record to an empty Map', () => {
        const result = deserializeProjectTypes({});

        expect(result).toBeInstanceOf(Map);
        expect(result!.size).toBe(0);
    });
});
