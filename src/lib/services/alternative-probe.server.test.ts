import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ModrinthClient } from '$lib/api/client';
import type { ModrinthGameVersion, ModrinthVersion } from '$lib/api/types';
import type { ResolvedProject } from './types';
import {
    buildProbeMatrix,
    buildVersionHistogram,
    isRecentVersion,
    getHistogramProbeVersions,
    probeAlternatives,
    type VersionHistogram
} from './alternative-probe.server';

// =============================================================================
// Test Helpers
// =============================================================================

function makeGameVersions(
    versions: string[],
    overrides?: Partial<Record<string, Partial<ModrinthGameVersion>>>
): ModrinthGameVersion[] {
    return versions.map((v) => ({
        version: v,
        version_type: 'release' as const,
        date: overrides?.[v]?.date ?? '2024-01-01T00:00:00Z',
        major: overrides?.[v]?.major ?? true,
        ...(overrides?.[v]?.version_type ? { version_type: overrides[v]!.version_type! } : {})
    }));
}

function makeResolvedProject(overrides: Partial<ResolvedProject> = {}): ResolvedProject {
    return {
        projectId: 'proj1',
        projectSlug: 'test-mod',
        projectTitle: 'Test Mod',
        projectDescription: 'A test mod',
        projectType: 'mod',
        versionId: 'v1',
        versionNumber: '1.0.0',
        versionType: 'release',
        fileName: 'test-1.0.0.jar',
        fileUrl: 'https://cdn.modrinth.com/test.jar',
        fileSize: 1024,
        fileHashes: { sha1: 'abc123', sha512: 'def456' },
        loaders: ['fabric'],
        dependencyCount: 0,
        side: 'both',
        folder: 'mods',
        clientSide: 'required',
        serverSide: 'required',
        usedFallbackLoader: false,
        ...overrides
    };
}

function makeHistogram(data: Record<string, Record<string, string[]>>): VersionHistogram {
    const counts = new Map<string, Map<string, Set<string>>>();
    let totalScanned = 0;
    const allProjects = new Set<string>();

    for (const [version, loaderData] of Object.entries(data)) {
        const loaderMap = new Map<string, Set<string>>();
        for (const [loader, projectIds] of Object.entries(loaderData)) {
            loaderMap.set(loader, new Set(projectIds));
            for (const id of projectIds) allProjects.add(id);
        }
        counts.set(version, loaderMap);
    }
    totalScanned = allProjects.size;

    return { counts, totalScanned };
}

// =============================================================================
// buildProbeMatrix
// =============================================================================

describe('buildProbeMatrix', () => {
    it('builds configs for fabric with adjacent versions', () => {
        const configs = buildProbeMatrix('1.21', 'fabric', ['1.20.6', '1.20.4']);
        expect(configs).toEqual([
            { version: '1.20.6', loader: 'fabric' },
            { version: '1.20.6', loader: 'quilt' },
            { version: '1.20.4', loader: 'fabric' },
            { version: '1.20.4', loader: 'quilt' },
            { version: '1.21', loader: 'quilt' }
        ]);
    });

    it('includes alternative loader for current version', () => {
        const configs = buildProbeMatrix('1.21', 'forge', ['1.20.6']);
        expect(configs).toContainEqual({ version: '1.21', loader: 'neoforge' });
    });

    it('handles loaders with no known alternatives', () => {
        const configs = buildProbeMatrix('1.21', 'liteloader', ['1.20.6']);
        expect(configs).toEqual([{ version: '1.20.6', loader: 'liteloader' }]);
    });

    it('returns empty for no adjacent versions and no alternative loader', () => {
        const configs = buildProbeMatrix('1.21', 'liteloader', []);
        expect(configs).toEqual([]);
    });

    it('excludes all configs in the exclusion array', () => {
        const configs = buildProbeMatrix(
            '1.21',
            'fabric',
            ['1.20.6', '1.20.4'],
            [
                { version: '1.20.6', loader: 'fabric' },
                { version: '1.20.4', loader: 'quilt' }
            ]
        );
        expect(configs).not.toContainEqual({ version: '1.20.6', loader: 'fabric' });
        expect(configs).not.toContainEqual({ version: '1.20.4', loader: 'quilt' });
        expect(configs).toContainEqual({ version: '1.20.6', loader: 'quilt' });
        expect(configs).toContainEqual({ version: '1.20.4', loader: 'fabric' });
    });

    it('quilt probes include fabric as alternative AND fabric fallback', () => {
        const configs = buildProbeMatrix('1.21', 'quilt', ['1.20.6']);
        expect(configs).toContainEqual({ version: '1.20.6', loader: 'fabric' });
        expect(configs).toContainEqual({ version: '1.21', loader: 'fabric' });
        expect(configs).toContainEqual({ version: '1.20.6', loader: 'quilt' });
    });

    it('fabric probes include quilt but NOT fabric fallback for quilt', () => {
        const configs = buildProbeMatrix('1.21', 'fabric', ['1.20.6']);
        expect(configs).toContainEqual({ version: '1.20.6', loader: 'quilt' });
        expect(configs.filter((c) => c.loader === 'fabric').length).toBe(1);
    });
});

// =============================================================================
// buildVersionHistogram
// =============================================================================

describe('buildVersionHistogram', () => {
    let client: ModrinthClient;

    beforeEach(() => {
        client = new ModrinthClient();
    });

    it('identifies the version with the most unresolved mod support', async () => {
        vi.spyOn(client, 'requestVersion').mockImplementation(async (endpoint: string) => {
            const projectId = endpoint.split('/')[1];
            // 4 of 5 mods support 1.20.1, 2 support 1.21
            const versionMap: Record<string, ModrinthVersion[]> = {
                p1: [
                    {
                        game_versions: ['1.20.1'],
                        loaders: ['fabric']
                    } as unknown as ModrinthVersion,
                    { game_versions: ['1.21'], loaders: ['fabric'] } as unknown as ModrinthVersion
                ],
                p2: [
                    { game_versions: ['1.20.1'], loaders: ['fabric'] } as unknown as ModrinthVersion
                ],
                p3: [
                    {
                        game_versions: ['1.20.1'],
                        loaders: ['fabric']
                    } as unknown as ModrinthVersion,
                    { game_versions: ['1.21'], loaders: ['fabric'] } as unknown as ModrinthVersion
                ],
                p4: [
                    { game_versions: ['1.20.1'], loaders: ['fabric'] } as unknown as ModrinthVersion
                ],
                p5: [
                    { game_versions: ['1.19.2'], loaders: ['fabric'] } as unknown as ModrinthVersion
                ]
            };
            return versionMap[projectId] ?? [];
        });

        const releaseSet = new Set(['1.20.1', '1.21', '1.19.2']);
        const histogram = await buildVersionHistogram(
            client,
            ['p1', 'p2', 'p3', 'p4', 'p5'],
            'fabric',
            releaseSet
        );

        const fabric1201 = histogram.counts.get('1.20.1')?.get('fabric');
        const fabric121 = histogram.counts.get('1.21')?.get('fabric');

        expect(fabric1201?.size).toBe(4);
        expect(fabric121?.size).toBe(2);
    });

    it('handles mods with no versions for the loader', async () => {
        vi.spyOn(client, 'requestVersion').mockResolvedValue([]);

        const histogram = await buildVersionHistogram(
            client,
            ['p1'],
            'fabric',
            new Set(['1.20.1'])
        );

        expect(histogram.totalScanned).toBe(1);
        expect(histogram.counts.size).toBe(0);
    });

    it('aggregates game_versions from multi-version responses', async () => {
        vi.spyOn(client, 'requestVersion').mockResolvedValue([
            {
                game_versions: ['1.20.1', '1.20', '1.19.4'],
                loaders: ['fabric']
            } as unknown as ModrinthVersion
        ]);

        const releaseSet = new Set(['1.20.1', '1.20', '1.19.4']);
        const histogram = await buildVersionHistogram(client, ['p1'], 'fabric', releaseSet);

        expect(histogram.counts.get('1.20.1')?.get('fabric')?.has('p1')).toBe(true);
        expect(histogram.counts.get('1.20')?.get('fabric')?.has('p1')).toBe(true);
        expect(histogram.counts.get('1.19.4')?.get('fabric')?.has('p1')).toBe(true);
    });

    it('falls back gracefully on API failure', async () => {
        let callCount = 0;
        vi.spyOn(client, 'requestVersion').mockImplementation(async () => {
            callCount++;
            if (callCount <= 1) {
                return [
                    {
                        game_versions: ['1.20.1'],
                        loaders: ['fabric']
                    } as unknown as ModrinthVersion
                ];
            }
            throw new Error('Network error');
        });

        const histogram = await buildVersionHistogram(
            client,
            ['p1', 'p2', 'p3'],
            'fabric',
            new Set(['1.20.1'])
        );

        // Only p1 succeeded
        expect(histogram.totalScanned).toBe(1);
        expect(histogram.totalScanned).toBeLessThan(3);
    });

    it('scans loader-agnostic projects separately without loader filter', async () => {
        const callArgs: Array<{ projectId: string; hasLoaderFilter: boolean }> = [];
        vi.spyOn(client, 'requestVersion').mockImplementation(
            async (endpoint: string, _version, opts) => {
                const projectId = endpoint.split('/')[1];
                const queryParams = (opts as { queryParams?: Record<string, string> })?.queryParams;
                callArgs.push({
                    projectId,
                    hasLoaderFilter: !!queryParams?.loaders
                });
                return [
                    { game_versions: ['1.20.1'], loaders: ['fabric'] } as unknown as ModrinthVersion
                ];
            }
        );

        const projectTypes = new Map([
            ['p1', 'mod'],
            ['p2', 'mod'],
            ['p3', 'datapack']
        ]);

        const histogram = await buildVersionHistogram(
            client,
            ['p1', 'p2', 'p3'],
            'fabric',
            new Set(['1.20.1']),
            undefined,
            projectTypes
        );

        // All 3 projects scanned (agnostic ones without loader filter)
        expect(histogram.totalScanned).toBe(3);
        // p1, p2 have loader filter; p3 does not
        expect(callArgs.find((c) => c.projectId === 'p1')?.hasLoaderFilter).toBe(true);
        expect(callArgs.find((c) => c.projectId === 'p3')?.hasLoaderFilter).toBe(false);
    });

    it('filters snapshot versions from histogram counts', async () => {
        vi.spyOn(client, 'requestVersion').mockResolvedValue([
            {
                game_versions: ['24w14a', '1.20.1'],
                loaders: ['fabric']
            } as unknown as ModrinthVersion
        ]);

        // Only 1.20.1 is in release set, 24w14a is not
        const releaseSet = new Set(['1.20.1']);
        const histogram = await buildVersionHistogram(client, ['p1'], 'fabric', releaseSet);

        expect(histogram.counts.has('24w14a')).toBe(false);
        expect(histogram.counts.get('1.20.1')?.get('fabric')?.has('p1')).toBe(true);
    });

    it('counts each project at most once per version in histogram', async () => {
        vi.spyOn(client, 'requestVersion').mockResolvedValue([
            { game_versions: ['1.20.1'], loaders: ['fabric'] } as unknown as ModrinthVersion,
            { game_versions: ['1.20.1'], loaders: ['fabric'] } as unknown as ModrinthVersion,
            { game_versions: ['1.20.1'], loaders: ['fabric'] } as unknown as ModrinthVersion
        ]);

        const histogram = await buildVersionHistogram(
            client,
            ['p1'],
            'fabric',
            new Set(['1.20.1'])
        );

        expect(histogram.counts.get('1.20.1')?.get('fabric')?.size).toBe(1);
    });

    it('loader-aware histogram distinguishes fabric vs quilt support', async () => {
        vi.spyOn(client, 'requestVersion').mockResolvedValue([
            {
                game_versions: ['1.20.1'],
                loaders: ['fabric']
            } as unknown as ModrinthVersion
        ]);

        const histogram = await buildVersionHistogram(
            client,
            ['p1'],
            'fabric',
            new Set(['1.20.1'])
        );

        expect(histogram.counts.get('1.20.1')?.get('fabric')?.has('p1')).toBe(true);
        // quilt not present since the version file only lists fabric
        expect(histogram.counts.get('1.20.1')?.get('quilt')?.has('p1') ?? false).toBe(false);
    });
});

// =============================================================================
// isRecentVersion
// =============================================================================

describe('isRecentVersion', () => {
    it('returns true for version released within cutoff period', () => {
        const sixMonthsAgo = new Date(Date.now() - 180 * 86_400_000).toISOString();
        const allVersions = makeGameVersions(['1.21'], { '1.21': { date: sixMonthsAgo } });
        expect(isRecentVersion('1.21', allVersions, 730)).toBe(true);
    });

    it('returns false for version released beyond cutoff period', () => {
        const threeYearsAgo = new Date(Date.now() - 1100 * 86_400_000).toISOString();
        const allVersions = makeGameVersions(['1.16.5'], { '1.16.5': { date: threeYearsAgo } });
        expect(isRecentVersion('1.16.5', allVersions, 730)).toBe(false);
    });

    it('returns false when version is not found in the list', () => {
        const allVersions = makeGameVersions(['1.21']);
        expect(isRecentVersion('1.19.4', allVersions)).toBe(false);
    });
});

// =============================================================================
// getHistogramProbeVersions
// =============================================================================

describe('getHistogramProbeVersions', () => {
    const allVersions = makeGameVersions([
        '1.21.4',
        '1.21.1',
        '1.21',
        '1.20.6',
        '1.20.4',
        '1.20.1',
        '1.20',
        '1.19.2',
        '1.18.2',
        '1.16.5'
    ]);

    it('selects versions with the highest mod support', () => {
        const histogram = makeHistogram({
            '1.20.1': { fabric: ['p1', 'p2', 'p3', 'p4', 'p5'] },
            '1.21.1': { fabric: ['p1', 'p2', 'p3'] },
            '1.21': { fabric: ['p1', 'p2'] },
            '1.21.4': { fabric: ['p1'] }
        });

        const result = getHistogramProbeVersions(
            '1.21.4',
            allVersions,
            histogram,
            true,
            new Set(),
            'fabric',
            3
        );

        expect(result[0]).toBe('1.20.1');
        expect(result[1]).toBe('1.21.1');
        expect(result[2]).toBe('1.21');
    });

    it('excludes previously visited versions', () => {
        const histogram = makeHistogram({
            '1.20.1': { fabric: ['p1', 'p2', 'p3'] },
            '1.21.1': { fabric: ['p1', 'p2'] }
        });

        const result = getHistogramProbeVersions(
            '1.21.4',
            allVersions,
            histogram,
            true,
            new Set(['1.20.1']),
            'fabric'
        );

        expect(result).not.toContain('1.20.1');
    });

    it('only looks backward when current version is old', () => {
        // 1.16.5 is the current version (old). 1.18.2 is newer and should be excluded.
        const histogram = makeHistogram({
            '1.18.2': { fabric: ['p1', 'p2', 'p3'] }
        });

        const result = getHistogramProbeVersions(
            '1.16.5',
            allVersions,
            histogram,
            false, // not recent
            new Set(),
            'fabric'
        );

        expect(result).not.toContain('1.18.2');
    });

    it('looks both directions when current version is recent', () => {
        const histogram = makeHistogram({
            '1.21.4': { fabric: ['p1', 'p2', 'p3'] }
        });

        const result = getHistogramProbeVersions(
            '1.21',
            allVersions,
            histogram,
            true, // recent
            new Set(),
            'fabric'
        );

        expect(result).toContain('1.21.4');
    });

    it('breaks ties using curated popular versions', () => {
        // Spread > 1 to avoid flat histogram fallback
        const histogram = makeHistogram({
            '1.20.1': { fabric: ['p1', 'p2', 'p3', 'p4', 'p5'] },
            '1.20.4': { fabric: ['p1', 'p2', 'p3', 'p4', 'p5'] },
            '1.19.2': { fabric: ['p1', 'p2'] }
        });

        const result = getHistogramProbeVersions(
            '1.21',
            allVersions,
            histogram,
            true,
            new Set(),
            'fabric'
        );

        // 1.20.1 and 1.20.4 tie at count 5 — 1.20.1 is curated so it should come first
        const idx1201 = result.indexOf('1.20.1');
        const idx1204 = result.indexOf('1.20.4');
        expect(idx1201).toBeLessThan(idx1204);
    });

    it('falls back to curated versions when histogram is flat', () => {
        // All counts = 2 (above HISTOGRAM_MIN_COVERAGE), spread = 0 → flat histogram
        const histogram = makeHistogram({
            '1.20.1': { fabric: ['p1', 'p2'] },
            '1.20.4': { fabric: ['p1', 'p2'] },
            '1.20.6': { fabric: ['p1', 'p2'] },
            '1.21': { fabric: ['p1', 'p2'] },
            '1.21.1': { fabric: ['p1', 'p2'] }
        });

        const result = getHistogramProbeVersions(
            '1.21.4',
            allVersions,
            histogram,
            true,
            new Set(),
            'fabric'
        );

        // Flat histogram (all same count, spread 0) → should return curated versions
        // Curated versions in the list: 1.21.1, 1.20.1
        expect(result).toContain('1.21.1');
        expect(result).toContain('1.20.1');
    });
});

// =============================================================================
// probeAlternatives
// =============================================================================

describe('probeAlternatives', () => {
    let client: ModrinthClient;

    beforeEach(() => {
        client = new ModrinthClient();
    });

    it('returns empty when no unresolved projects exist', async () => {
        const resolved = [makeResolvedProject()];
        const allVersions = makeGameVersions(['1.21', '1.20.6']);

        const result = await probeAlternatives(client, resolved, [], '1.21', 'fabric', allVersions);

        expect(result.alternatives).toEqual([]);
        expect(result.modAvailability).toEqual({});
    });

    it('recommends the version with the highest actual mod overlap', async () => {
        const resolved = [
            makeResolvedProject({ projectId: 'p1', fileHashes: { sha1: 'h1', sha512: 's1' } }),
            makeResolvedProject({ projectId: 'p2', fileHashes: { sha1: 'h2', sha512: 's2' } })
        ];
        const unresolved = ['p3', 'p4', 'p5'];
        const allVersions = makeGameVersions(['1.21', '1.20.6', '1.20.1']);

        vi.spyOn(client, 'requestVersion').mockImplementation(
            async (endpoint: string, _version, options) => {
                // Histogram scan: return version lists for unresolved mods
                if (endpoint.startsWith('project/') && !options?.queryParams?.game_versions) {
                    const projectId = endpoint.split('/')[1];
                    const versionMap: Record<string, ModrinthVersion[]> = {
                        p3: [
                            {
                                game_versions: ['1.20.1', '1.20.6'],
                                loaders: ['fabric']
                            } as unknown as ModrinthVersion
                        ],
                        p4: [
                            {
                                game_versions: ['1.20.1'],
                                loaders: ['fabric']
                            } as unknown as ModrinthVersion
                        ],
                        p5: [
                            {
                                game_versions: ['1.20.1'],
                                loaders: ['fabric']
                            } as unknown as ModrinthVersion
                        ]
                    };
                    return versionMap[projectId] ?? [];
                }
                // Loss check: all resolved stay available
                if (endpoint === 'version_files/update') {
                    return { h1: {} as ModrinthVersion, h2: {} as ModrinthVersion };
                }
                return {};
            }
        );

        const result = await probeAlternatives(
            client,
            resolved,
            unresolved,
            '1.21',
            'fabric',
            allVersions
        );

        expect(result.alternatives.length).toBeGreaterThan(0);
        // 1.20.1 has 3 gains, 1.20.6 has 1 gain → 1.20.1 should be first
        expect(result.alternatives[0].version).toBe('1.20.1');
        expect(result.alternatives[0].netGain).toBe(3);
    });

    it('skips versions below HISTOGRAM_MIN_COVERAGE threshold', async () => {
        const resolved = [
            makeResolvedProject({ projectId: 'p1', fileHashes: { sha1: 'h1', sha512: 's1' } })
        ];
        const unresolved = ['p2', 'p3', 'p4'];
        const allVersions = makeGameVersions(['1.21', '1.20.6', '1.20.1', '1.19.2']);

        const lossCheckVersions: string[] = [];

        vi.spyOn(client, 'requestVersion').mockImplementation(
            async (endpoint: string, _version, options) => {
                if (endpoint.startsWith('project/') && !options?.queryParams?.game_versions) {
                    // p2 and p3 support 1.20.1, only p2 supports 1.19.2 (count=1 < min coverage=2)
                    const projectId = endpoint.split('/')[1];
                    const versionMap: Record<string, ModrinthVersion[]> = {
                        p2: [
                            {
                                game_versions: ['1.20.1', '1.19.2'],
                                loaders: ['fabric']
                            } as unknown as ModrinthVersion
                        ],
                        p3: [
                            {
                                game_versions: ['1.20.1'],
                                loaders: ['fabric']
                            } as unknown as ModrinthVersion
                        ],
                        p4: [
                            {
                                game_versions: ['1.20.6'],
                                loaders: ['fabric']
                            } as unknown as ModrinthVersion
                        ]
                    };
                    return versionMap[projectId] ?? [];
                }
                if (endpoint === 'version_files/update') {
                    const body = options?.body as Record<string, unknown>;
                    const gameVersions = body?.game_versions as string[];
                    if (gameVersions) lossCheckVersions.push(gameVersions[0]);
                    return { h1: {} as ModrinthVersion };
                }
                return {};
            }
        );

        await probeAlternatives(client, resolved, unresolved, '1.21', 'fabric', allVersions);

        // 1.19.2 has count 1 (below HISTOGRAM_MIN_COVERAGE=2) — should not get a loss check
        expect(lossCheckVersions).not.toContain('1.19.2');
    });

    it('accumulates modAvailability from histogram scan', async () => {
        const resolved = [
            makeResolvedProject({ projectId: 'p1', fileHashes: { sha1: 'h1', sha512: 's1' } })
        ];
        const unresolved = ['p2'];
        const allVersions = makeGameVersions(['1.21', '1.20.6', '1.20.1']);

        vi.spyOn(client, 'requestVersion').mockImplementation(async (endpoint: string) => {
            if (endpoint.startsWith('project/p2/version')) {
                return [
                    {
                        game_versions: ['1.20.1', '1.20.6'],
                        loaders: ['fabric']
                    } as unknown as ModrinthVersion
                ];
            }
            if (endpoint === 'version_files/update') {
                return { h1: {} as ModrinthVersion };
            }
            return [];
        });

        const result = await probeAlternatives(
            client,
            resolved,
            unresolved,
            '1.21',
            'fabric',
            allVersions
        );

        expect(result.modAvailability['p2']).toBeDefined();
        expect(result.modAvailability['p2'].availableOn.length).toBeGreaterThan(0);
        // Same loader + different version = near miss
        expect(result.modAvailability['p2'].isNearMiss).toBe(true);
    });

    it('prevents oscillation across a 3-step switch chain', async () => {
        const resolved = [
            makeResolvedProject({ projectId: 'p1', fileHashes: { sha1: 'h1', sha512: 's1' } })
        ];
        const unresolved = ['p2'];
        const allVersions = makeGameVersions(['1.21', '1.20.6', '1.20.1', '1.19.2']);

        const probedVersions: string[] = [];

        vi.spyOn(client, 'requestVersion').mockImplementation(
            async (endpoint: string, _version, options) => {
                if (endpoint.startsWith('project/') && !options?.queryParams?.game_versions) {
                    return [
                        {
                            game_versions: ['1.21', '1.20.6', '1.20.1', '1.19.2'],
                            loaders: ['fabric']
                        } as unknown as ModrinthVersion
                    ];
                }
                if (endpoint === 'version_files/update') {
                    const body = options?.body as Record<string, unknown>;
                    const gameVersions = body?.game_versions as string[];
                    if (gameVersions?.[0]) probedVersions.push(gameVersions[0]);
                    return { h1: {} as ModrinthVersion };
                }
                return {};
            }
        );

        await probeAlternatives(client, resolved, unresolved, '1.20.1', 'fabric', allVersions, [
            { version: '1.21', loader: 'fabric' },
            { version: '1.20.6', loader: 'fabric' }
        ]);

        // Excluded versions should not be probed with fabric
        const matrix = buildProbeMatrix(
            '1.20.1',
            'fabric',
            ['1.21', '1.20.6', '1.19.2'],
            [
                { version: '1.21', loader: 'fabric' },
                { version: '1.20.6', loader: 'fabric' }
            ]
        );
        expect(matrix).not.toContainEqual({ version: '1.21', loader: 'fabric' });
        expect(matrix).not.toContainEqual({ version: '1.20.6', loader: 'fabric' });
    });

    it('excludes alternatives with net gain <= 0', async () => {
        const resolved = [
            makeResolvedProject({ projectId: 'p1', fileHashes: { sha1: 'h1', sha512: 's1' } })
        ];
        const unresolved = ['p2'];
        const allVersions = makeGameVersions(['1.21', '1.20.6']);

        vi.spyOn(client, 'requestVersion').mockImplementation(async (endpoint: string) => {
            if (endpoint.startsWith('project/')) {
                return [
                    {
                        game_versions: ['1.20.6'],
                        loaders: ['fabric']
                    } as unknown as ModrinthVersion
                ];
            }
            if (endpoint === 'version_files/update') {
                // h1 is MISSING — resolved mod lost in alternative
                return {};
            }
            return {};
        });

        const result = await probeAlternatives(
            client,
            resolved,
            unresolved,
            '1.21',
            'fabric',
            allVersions
        );

        // Net gain = 1 gain - 1 loss = 0, should be excluded
        expect(result.alternatives.every((a) => a.netGain > 0)).toBe(true);
    });

    it('degrades gracefully when all probes fail', async () => {
        const resolved = [makeResolvedProject()];
        const unresolved = ['p2'];
        const allVersions = makeGameVersions(['1.21', '1.20.6']);

        vi.spyOn(client, 'requestVersion').mockRejectedValue(new Error('API error'));

        const result = await probeAlternatives(
            client,
            resolved,
            unresolved,
            '1.21',
            'fabric',
            allVersions
        );

        expect(result.alternatives).toEqual([]);
    });

    it('excludes alternatives with negative net gain (more losses than gains)', async () => {
        const resolved = [
            makeResolvedProject({ projectId: 'p1', fileHashes: { sha1: 'h1', sha512: 's1' } }),
            makeResolvedProject({ projectId: 'p2', fileHashes: { sha1: 'h2', sha512: 's2' } }),
            makeResolvedProject({ projectId: 'p3', fileHashes: { sha1: 'h3', sha512: 's3' } })
        ];
        const unresolved = ['p4', 'p5'];
        const allVersions = makeGameVersions(['1.21', '1.20.6']);

        vi.spyOn(client, 'requestVersion').mockImplementation(async (endpoint: string) => {
            if (endpoint.startsWith('project/')) {
                return [
                    {
                        game_versions: ['1.20.6'],
                        loaders: ['fabric']
                    } as unknown as ModrinthVersion
                ];
            }
            if (endpoint === 'version_files/update') {
                // All 3 resolved mods are LOST
                return {};
            }
            return {};
        });

        const result = await probeAlternatives(
            client,
            resolved,
            unresolved,
            '1.21',
            'fabric',
            allVersions
        );

        // net = 2 - 3 = -1, should be excluded
        expect(result.alternatives).toEqual([]);
    });

    it('prunes configs that cannot beat the best-known result', async () => {
        const resolved = [
            makeResolvedProject({ projectId: 'p1', fileHashes: { sha1: 'h1', sha512: 's1' } })
        ];
        // 5 unresolved mods
        const unresolved = ['p2', 'p3', 'p4', 'p5', 'p6'];
        const allVersions = makeGameVersions(['1.21', '1.20.6', '1.20.1', '1.19.2']);

        const lossCheckVersions: string[] = [];

        vi.spyOn(client, 'requestVersion').mockImplementation(
            async (endpoint: string, _version, options) => {
                if (endpoint.startsWith('project/') && !options?.queryParams?.game_versions) {
                    const projectId = endpoint.split('/')[1];
                    // 1.20.1 has all 5 unresolved, 1.20.6 only has 2, 1.19.2 has 1
                    const map: Record<string, ModrinthVersion[]> = {
                        p2: [
                            {
                                game_versions: ['1.20.1', '1.20.6'],
                                loaders: ['fabric']
                            } as unknown as ModrinthVersion
                        ],
                        p3: [
                            {
                                game_versions: ['1.20.1', '1.20.6'],
                                loaders: ['fabric']
                            } as unknown as ModrinthVersion
                        ],
                        p4: [
                            {
                                game_versions: ['1.20.1'],
                                loaders: ['fabric']
                            } as unknown as ModrinthVersion
                        ],
                        p5: [
                            {
                                game_versions: ['1.20.1'],
                                loaders: ['fabric']
                            } as unknown as ModrinthVersion
                        ],
                        p6: [
                            {
                                game_versions: ['1.20.1', '1.19.2'],
                                loaders: ['fabric']
                            } as unknown as ModrinthVersion
                        ]
                    };
                    return map[projectId] ?? [];
                }
                if (endpoint === 'version_files/update') {
                    const body = options?.body as Record<string, unknown>;
                    const gameVersions = body?.game_versions as string[];
                    if (gameVersions?.[0]) lossCheckVersions.push(gameVersions[0]);
                    return { h1: {} as ModrinthVersion };
                }
                return {};
            }
        );

        await probeAlternatives(client, resolved, unresolved, '1.21', 'fabric', allVersions);

        // 1.20.1 probed first (5 gains), bestNetGain = 5
        // 1.20.6 has theoreticalMax = 2 < bestNetGain = 5 → should be pruned
        // 1.19.2 has count 1 < HISTOGRAM_MIN_COVERAGE → also skipped
        expect(lossCheckVersions).toContain('1.20.1');
        expect(lossCheckVersions).not.toContain('1.20.6');
    });

    it('probes candidates with histogram count equal to bestNetGain', async () => {
        const resolved = [
            makeResolvedProject({ projectId: 'p1', fileHashes: { sha1: 'h1', sha512: 's1' } }),
            makeResolvedProject({
                projectId: 'p1b',
                fileHashes: { sha1: 'h1b', sha512: 's1b' }
            })
        ];
        // 4 unresolved so no single version covers all (prevents early exit)
        const unresolved = ['p2', 'p3', 'p4', 'p5'];
        // Use curated versions to avoid flat-histogram fallback filtering
        const allVersions = makeGameVersions(['1.21.1', '1.20.1', '1.19.2']);

        const lossCheckVersions: string[] = [];

        vi.spyOn(client, 'requestVersion').mockImplementation(
            async (endpoint: string, _version, options) => {
                if (endpoint.startsWith('project/') && !options?.queryParams?.game_versions) {
                    const projectId = endpoint.split('/')[1];
                    // 1.20.1: supports p2, p3 (count=2)
                    // 1.19.2: supports p4, p5 (count=2)
                    // Spread = 0 but both are curated → flat fallback picks both
                    const map: Record<string, ModrinthVersion[]> = {
                        p2: [
                            {
                                game_versions: ['1.20.1'],
                                loaders: ['fabric']
                            } as unknown as ModrinthVersion
                        ],
                        p3: [
                            {
                                game_versions: ['1.20.1'],
                                loaders: ['fabric']
                            } as unknown as ModrinthVersion
                        ],
                        p4: [
                            {
                                game_versions: ['1.19.2'],
                                loaders: ['fabric']
                            } as unknown as ModrinthVersion
                        ],
                        p5: [
                            {
                                game_versions: ['1.19.2'],
                                loaders: ['fabric']
                            } as unknown as ModrinthVersion
                        ]
                    };
                    return map[projectId] ?? [];
                }
                if (endpoint === 'version_files/update') {
                    const body = options?.body as Record<string, unknown>;
                    const gameVersions = body?.game_versions as string[];
                    if (gameVersions?.[0]) lossCheckVersions.push(gameVersions[0]);
                    // Both resolved mods available in all configs → no losses, netGain = 2
                    return {
                        h1: {} as ModrinthVersion,
                        h1b: {} as ModrinthVersion
                    };
                }
                return {};
            }
        );

        await probeAlternatives(client, resolved, unresolved, '1.21.1', 'fabric', allVersions);

        // Both versions have histCount=2, after first probe bestNetGain=2
        // With strict < pruning, histCount(2) is NOT < bestNetGain(2) → second still probed
        const fabricProbes = lossCheckVersions.filter((v) => v === '1.20.1' || v === '1.19.2');
        expect(fabricProbes).toContain('1.20.1');
        expect(fabricProbes).toContain('1.19.2');
    });

    it('returns immediately when histogram peak covers all unresolved with zero losses', async () => {
        const resolved = [
            makeResolvedProject({ projectId: 'p1', fileHashes: { sha1: 'h1', sha512: 's1' } })
        ];
        const unresolved = ['p2', 'p3'];
        const allVersions = makeGameVersions(['1.21', '1.20.6', '1.20.1']);

        const lossCheckVersions: string[] = [];

        vi.spyOn(client, 'requestVersion').mockImplementation(
            async (endpoint: string, _version, options) => {
                if (endpoint.startsWith('project/') && !options?.queryParams?.game_versions) {
                    // Both unresolved support both 1.20.1 and 1.20.6
                    return [
                        {
                            game_versions: ['1.20.1', '1.20.6'],
                            loaders: ['fabric']
                        } as unknown as ModrinthVersion
                    ];
                }
                if (endpoint === 'version_files/update') {
                    const body = options?.body as Record<string, unknown>;
                    const gameVersions = body?.game_versions as string[];
                    if (gameVersions?.[0]) lossCheckVersions.push(gameVersions[0]);
                    return { h1: {} as ModrinthVersion }; // No losses
                }
                return {};
            }
        );

        const result = await probeAlternatives(
            client,
            resolved,
            unresolved,
            '1.21',
            'fabric',
            allVersions
        );

        // Both 1.20.1 and 1.20.6 cover all unresolved (count 2 = length 2)
        // After the first successful probe with 0 losses, should stop
        expect(lossCheckVersions.length).toBe(1);
        expect(result.alternatives.length).toBeGreaterThan(0);
        expect(result.alternatives[0].netGain).toBe(2);
    });
});

// =============================================================================
// buildVersionHistogram — loader-agnostic project handling
// =============================================================================

describe('buildVersionHistogram — loader-agnostic scanning', () => {
    let client: ModrinthClient;

    beforeEach(() => {
        client = new ModrinthClient();
    });

    it('scans loader-agnostic projects WITHOUT loader filter', async () => {
        const calls: Array<{ projectId: string; hasLoaderFilter: boolean }> = [];
        vi.spyOn(client, 'requestVersion').mockImplementation(
            async (endpoint: string, _version, opts) => {
                const projectId = endpoint.split('/')[1];
                const queryParams = (opts as { queryParams?: Record<string, string> })?.queryParams;
                calls.push({
                    projectId,
                    hasLoaderFilter: !!queryParams?.loaders
                });
                return [
                    { game_versions: ['1.20.1'], loaders: ['fabric'] } as unknown as ModrinthVersion
                ];
            }
        );

        const projectTypes = new Map([
            ['p1', 'mod'],
            ['p2', 'resourcepack'],
            ['p3', 'plugin']
        ]);

        await buildVersionHistogram(
            client,
            ['p1', 'p2', 'p3'],
            'fabric',
            new Set(['1.20.1']),
            undefined,
            projectTypes
        );

        // p1 (mod) should have loader filter
        const p1Call = calls.find((c) => c.projectId === 'p1');
        expect(p1Call?.hasLoaderFilter).toBe(true);

        // p2 (resourcepack) and p3 (plugin) should NOT have loader filter
        const p2Call = calls.find((c) => c.projectId === 'p2');
        expect(p2Call?.hasLoaderFilter).toBe(false);

        const p3Call = calls.find((c) => c.projectId === 'p3');
        expect(p3Call?.hasLoaderFilter).toBe(false);
    });

    it('scans all projects with loader filter when projectTypes not provided', async () => {
        const calls: Array<{ hasLoaderFilter: boolean }> = [];
        vi.spyOn(client, 'requestVersion').mockImplementation(async (_endpoint, _version, opts) => {
            const queryParams = (opts as { queryParams?: Record<string, string> })?.queryParams;
            calls.push({ hasLoaderFilter: !!queryParams?.loaders });
            return [];
        });

        await buildVersionHistogram(client, ['p1', 'p2'], 'fabric', new Set(['1.20.1']));

        // Without projectTypes, all projects are treated as loader-dependent
        expect(calls.every((c) => c.hasLoaderFilter)).toBe(true);
    });

    it('includes loader-agnostic project results in histogram counts', async () => {
        vi.spyOn(client, 'requestVersion').mockImplementation(async (endpoint: string) => {
            const projectId = endpoint.split('/')[1];
            if (projectId === 'p1') {
                return [
                    { game_versions: ['1.20.1'], loaders: ['fabric'] } as unknown as ModrinthVersion
                ];
            }
            // resourcepack has no loader tags but has version data
            return [
                { game_versions: ['1.20.1'], loaders: ['minecraft'] } as unknown as ModrinthVersion
            ];
        });

        const projectTypes = new Map([
            ['p1', 'mod'],
            ['p2', 'resourcepack']
        ]);

        const histogram = await buildVersionHistogram(
            client,
            ['p1', 'p2'],
            'fabric',
            new Set(['1.20.1']),
            undefined,
            projectTypes
        );

        expect(histogram.totalScanned).toBe(2);
        // Both projects should appear in the histogram
        const fabricCount = histogram.counts.get('1.20.1')?.get('fabric')?.size ?? 0;
        const minecraftCount = histogram.counts.get('1.20.1')?.get('minecraft')?.size ?? 0;
        expect(fabricCount + minecraftCount).toBe(2);
    });
});
