import { describe, it, expect } from 'vitest';
import { buildLoaderList, buildUnresolvedReason } from './loader-utils';
import type { ResolutionOptions } from './types';

function makeOptions(overrides: Partial<ResolutionOptions> = {}): ResolutionOptions {
    return {
        gameVersion: '1.20.1',
        loader: 'fabric',
        includeDependencies: true,
        includeOptionalDeps: true,
        enableCrossLoaderFallback: false,
        allowAlphaBeta: false,
        excludedProjectIds: new Set(),
        ...overrides
    };
}

describe('buildLoaderList', () => {
    it('includes fallback for quilt when enabled', () => {
        expect(buildLoaderList('quilt', true)).toEqual(['quilt', 'fabric']);
    });

    it('excludes fallback for quilt when disabled', () => {
        expect(buildLoaderList('quilt', false)).toEqual(['quilt']);
    });

    it('returns only primary for fabric (no fallback defined)', () => {
        expect(buildLoaderList('fabric', true)).toEqual(['fabric']);
    });

    it('includes forge fallback for neoforge by default', () => {
        expect(buildLoaderList('neoforge')).toEqual(['neoforge', 'forge']);
    });

    it('returns only primary for unknown loader', () => {
        expect(buildLoaderList('paper', true)).toEqual(['paper']);
    });
});

describe('buildUnresolvedReason', () => {
    it('omits loader for plugin projects (version-only message)', () => {
        const result = buildUnresolvedReason('plugin', makeOptions());
        expect(result).toBe('No compatible version for 1.20.1');
        expect(result).not.toContain('fabric');
    });

    it('includes loader for mod projects', () => {
        const result = buildUnresolvedReason('mod', makeOptions());
        expect(result).toBe('No compatible version for fabric on 1.20.1');
    });

    it('omits loader for resourcepack projects (version-only message)', () => {
        const result = buildUnresolvedReason('resourcepack', makeOptions());
        expect(result).toBe('No compatible version for 1.20.1');
    });

    it('omits loader for shader projects', () => {
        const result = buildUnresolvedReason('shader', makeOptions());
        expect(result).toBe('No compatible version for 1.20.1');
    });

    it('omits loader for datapack projects', () => {
        const result = buildUnresolvedReason('datapack', makeOptions());
        expect(result).toBe('No compatible version for 1.20.1');
    });

    it('uses the correct game version from options', () => {
        const result = buildUnresolvedReason('mod', makeOptions({ gameVersion: '1.21' }));
        expect(result).toBe('No compatible version for fabric on 1.21');
    });

    it('uses the correct loader from options', () => {
        const result = buildUnresolvedReason('mod', makeOptions({ loader: 'forge' }));
        expect(result).toBe('No compatible version for forge on 1.20.1');
    });
});
