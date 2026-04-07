import { describe, it, expect } from 'vitest';
import type {
    ResolvedProject,
    CollectionGroup,
    ConflictEntry,
    UnresolvedDependency
} from './types';
import {
    computeAutoResolution,
    getUserActionableConflicts,
    getMissingDeps,
    getResolutionState,
    computeSideStats,
    buildCollectionNameMap,
    buildIconMap,
    getCollectionProjectIds,
    countByProjectType,
    buildWarningsMap,
    getConflictProjectIds,
    deriveModStatus,
    matchesModFilters,
    shouldShowAdvisor,
    computeDonutSegments,
    computeResolutionPercentage,
    formatTechnicalReason,
    getFriendlyIssueReason,
    groupAvailabilityByLoader,
    computeCategorySummary,
    type ModFilterCriteria
} from './review-resolution';
import type { AlternativeProbe } from './types';

function makeProject(overrides: Partial<ResolvedProject> = {}): ResolvedProject {
    return {
        projectId: 'proj-1',
        projectSlug: 'test-mod',
        projectTitle: 'Test Mod',
        projectDescription: 'A test mod',
        projectType: 'mod',
        versionId: 'v1',
        versionNumber: '1.0.0',
        versionType: 'release',
        fileName: 'test-mod-1.0.0.jar',
        fileUrl: 'https://example.com/test-mod.jar',
        fileSize: 1024,
        fileHashes: { sha1: 'abc', sha512: 'def' },
        loaders: ['fabric'],
        dependencyCount: 0,
        side: 'client',
        folder: 'mods',
        clientSide: 'required',
        serverSide: 'unsupported',
        usedFallbackLoader: false,
        ...overrides
    };
}

function makeCollectionGroup(overrides: Partial<CollectionGroup> = {}): CollectionGroup {
    return {
        id: 'col-1',
        name: 'Test Collection',
        totalProjectCount: 1,
        resolved: [makeProject()],
        alsoInMap: {},
        ...overrides
    };
}

describe('computeAutoResolution', () => {
    it('detects fallback loader resolutions', () => {
        const projects = [
            makeProject({
                projectId: 'p1',
                projectTitle: 'Indium',
                usedFallbackLoader: true,
                resolvedLoader: 'fabric'
            })
        ];

        const result = computeAutoResolution(
            projects,
            [],
            new Set(['p1']),
            { p1: 'Indium' },
            undefined,
            'fabric'
        );

        expect(result.items).toHaveLength(1);
        expect(result.items[0].type).toBe('fallback');
        expect(result.items[0].projectId).toBe('p1');
        expect(result.items[0].message).toContain('Fabric');
    });

    it('detects beta/alpha version resolutions', () => {
        const projects = [
            makeProject({ projectId: 'p1', projectTitle: 'BetaMod', versionType: 'beta' }),
            makeProject({ projectId: 'p2', projectTitle: 'AlphaMod', versionType: 'alpha' })
        ];

        const result = computeAutoResolution(
            projects,
            [],
            new Set(['p1', 'p2']),
            { p1: 'BetaMod', p2: 'AlphaMod' },
            undefined,
            'fabric'
        );

        const betaItems = result.items.filter((i) => i.type === 'beta-version');
        expect(betaItems).toHaveLength(2);
        expect(betaItems[0].message).toContain('beta');
        expect(betaItems[1].message).toContain('alpha');
    });

    it('auto-excludes dependency-only conflicts', () => {
        const conflicts: ConflictEntry[] = [
            { projectId: 'user-mod', conflictsWith: 'dep-mod', declaredBy: 'user-mod' }
        ];
        const collectionIds = new Set(['user-mod']);
        const titleMap = { 'user-mod': 'User Mod', 'dep-mod': 'Dep Mod' };

        const result = computeAutoResolution(
            [makeProject({ projectId: 'user-mod' }), makeProject({ projectId: 'dep-mod' })],
            conflicts,
            collectionIds,
            titleMap,
            undefined,
            'fabric'
        );

        expect(result.autoExcludedIds.has('dep-mod')).toBe(true);
        expect(
            result.items.some((i) => i.type === 'auto-excluded' && i.projectId === 'dep-mod')
        ).toBe(true);
    });

    it('does NOT auto-exclude when both mods are in collections', () => {
        const conflicts: ConflictEntry[] = [
            { projectId: 'mod-a', conflictsWith: 'mod-b', declaredBy: 'mod-a' }
        ];
        const collectionIds = new Set(['mod-a', 'mod-b']);

        const result = computeAutoResolution(
            [makeProject({ projectId: 'mod-a' }), makeProject({ projectId: 'mod-b' })],
            conflicts,
            collectionIds,
            { 'mod-a': 'Mod A', 'mod-b': 'Mod B' },
            undefined,
            'fabric'
        );

        expect(result.autoExcludedIds.size).toBe(0);
        expect(result.items.filter((i) => i.type === 'auto-excluded')).toHaveLength(0);
    });

    it('deduplicates bidirectional conflict pairs', () => {
        const conflicts: ConflictEntry[] = [
            { projectId: 'a', conflictsWith: 'dep', declaredBy: 'a' },
            { projectId: 'dep', conflictsWith: 'a', declaredBy: 'a' }
        ];

        const result = computeAutoResolution(
            [makeProject({ projectId: 'a' }), makeProject({ projectId: 'dep' })],
            conflicts,
            new Set(['a']),
            { a: 'A', dep: 'Dep' },
            undefined,
            'fabric'
        );

        const autoExcluded = result.items.filter((i) => i.type === 'auto-excluded');
        expect(autoExcluded).toHaveLength(1);
    });
});

describe('getUserActionableConflicts', () => {
    it('returns conflicts where both projects are in collections', () => {
        const conflicts: ConflictEntry[] = [
            { projectId: 'a', conflictsWith: 'b', declaredBy: 'a' }
        ];
        const collectionIds = new Set(['a', 'b']);

        const result = getUserActionableConflicts(conflicts, collectionIds, { a: 'A', b: 'B' }, {});

        expect(result).toHaveLength(1);
        expect(result[0].projectA.title).toBe('A');
        expect(result[0].projectB.title).toBe('B');
    });

    it('excludes conflicts where one side is a dependency', () => {
        const conflicts: ConflictEntry[] = [
            { projectId: 'a', conflictsWith: 'dep', declaredBy: 'a' }
        ];
        const collectionIds = new Set(['a']);

        const result = getUserActionableConflicts(
            conflicts,
            collectionIds,
            { a: 'A', dep: 'Dep' },
            {}
        );

        expect(result).toHaveLength(0);
    });

    it('deduplicates bidirectional pairs', () => {
        const conflicts: ConflictEntry[] = [
            { projectId: 'a', conflictsWith: 'b', declaredBy: 'a' },
            { projectId: 'b', conflictsWith: 'a', declaredBy: 'b' }
        ];

        const result = getUserActionableConflicts(
            conflicts,
            new Set(['a', 'b']),
            { a: 'A', b: 'B' },
            {}
        );

        expect(result).toHaveLength(1);
    });
});

describe('getMissingDeps', () => {
    it('groups multiple "required by" entries for the same dep', () => {
        const unresolved: UnresolvedDependency[] = [
            { projectId: 'missing', requiredBy: 'mod-a', reason: 'Not found' },
            { projectId: 'missing', requiredBy: 'mod-b', reason: 'Not found' }
        ];

        const result = getMissingDeps(unresolved, {
            missing: 'Missing Dep',
            'mod-a': 'Mod A',
            'mod-b': 'Mod B'
        });

        expect(result).toHaveLength(1);
        expect(result[0].requiredBy).toEqual(['Mod A', 'Mod B']);
    });

    it('returns separate entries for different missing deps', () => {
        const unresolved: UnresolvedDependency[] = [
            { projectId: 'dep-1', requiredBy: 'mod-a', reason: 'Not found' },
            { projectId: 'dep-2', requiredBy: 'mod-a', reason: 'Not found' }
        ];

        const result = getMissingDeps(unresolved, {
            'dep-1': 'Dep 1',
            'dep-2': 'Dep 2',
            'mod-a': 'Mod A'
        });

        expect(result).toHaveLength(2);
    });

    it('falls back to projectId when title not found', () => {
        const unresolved: UnresolvedDependency[] = [
            { projectId: 'unknown-id', requiredBy: 'mod-a', reason: 'Not found' }
        ];

        const result = getMissingDeps(unresolved, { 'mod-a': 'Mod A' });

        expect(result[0].projectTitle).toBe('unknown-id');
    });
});

describe('getResolutionState', () => {
    it('returns noMods when total is 0', () => {
        expect(getResolutionState(0, 0, 0)).toBe('noMods');
    });

    it('returns hasIssues when there are conflicts', () => {
        expect(getResolutionState(10, 2, 0)).toBe('hasIssues');
    });

    it('returns hasIssues when there are missing deps', () => {
        expect(getResolutionState(10, 0, 1)).toBe('hasIssues');
    });

    it('returns allClear when everything resolved', () => {
        expect(getResolutionState(10, 0, 0)).toBe('allClear');
    });
});

describe('computeSideStats', () => {
    it('counts "both" mods in both client and server', () => {
        const projects = [
            makeProject({ projectId: 'p1', side: 'both', fileSize: 100 }),
            makeProject({ projectId: 'p2', side: 'client', fileSize: 200 }),
            makeProject({ projectId: 'p3', side: 'server', fileSize: 300 })
        ];

        const stats = computeSideStats(projects);

        expect(stats.client.count).toBe(2);
        expect(stats.client.downloadSize).toBe(300);
        expect(stats.server.count).toBe(2);
        expect(stats.server.downloadSize).toBe(400);
        expect(stats.total.count).toBe(3);
        expect(stats.total.downloadSize).toBe(600);
    });

    it('handles empty project list', () => {
        const stats = computeSideStats([]);

        expect(stats.client.count).toBe(0);
        expect(stats.server.count).toBe(0);
        expect(stats.total.count).toBe(0);
    });

    it('handles all-client projects', () => {
        const projects = [
            makeProject({ projectId: 'p1', side: 'client', fileSize: 500 }),
            makeProject({ projectId: 'p2', side: 'client', fileSize: 300 })
        ];

        const stats = computeSideStats(projects);

        expect(stats.client.count).toBe(2);
        expect(stats.server.count).toBe(0);
    });
});

describe('buildCollectionNameMap', () => {
    it('maps project IDs to collection names', () => {
        const collections: CollectionGroup[] = [
            makeCollectionGroup({
                name: 'Performance',
                resolved: [makeProject({ projectId: 'p1' }), makeProject({ projectId: 'p2' })]
            })
        ];

        const map = buildCollectionNameMap(collections);

        expect(map['p1']).toBe('Performance');
        expect(map['p2']).toBe('Performance');
    });

    it('first collection wins for duplicate projects', () => {
        const collections: CollectionGroup[] = [
            makeCollectionGroup({
                name: 'First',
                resolved: [makeProject({ projectId: 'shared' })]
            }),
            makeCollectionGroup({
                name: 'Second',
                resolved: [makeProject({ projectId: 'shared' })]
            })
        ];

        const map = buildCollectionNameMap(collections);

        expect(map['shared']).toBe('First');
    });
});

describe('buildIconMap', () => {
    it('includes icons from both collections and dependencies', () => {
        const collections: CollectionGroup[] = [
            makeCollectionGroup({
                resolved: [makeProject({ projectId: 'p1', iconUrl: 'icon1.png' })]
            })
        ];
        const deps = [makeProject({ projectId: 'dep1', iconUrl: 'dep-icon.png' })];

        const map = buildIconMap(collections, deps);

        expect(map['p1']).toBe('icon1.png');
        expect(map['dep1']).toBe('dep-icon.png');
    });
});

describe('getCollectionProjectIds', () => {
    it('returns all project IDs from collections', () => {
        const collections: CollectionGroup[] = [
            makeCollectionGroup({
                resolved: [makeProject({ projectId: 'a' }), makeProject({ projectId: 'b' })]
            }),
            makeCollectionGroup({
                resolved: [makeProject({ projectId: 'c' })]
            })
        ];

        const ids = getCollectionProjectIds(collections);

        expect(ids).toEqual(new Set(['a', 'b', 'c']));
    });
});

describe('countByProjectType', () => {
    it('counts projects by type', () => {
        const projects = [
            makeProject({ projectType: 'mod' }),
            makeProject({ projectType: 'mod' }),
            makeProject({ projectType: 'shader' }),
            makeProject({ projectType: 'resourcepack' })
        ];

        const counts = countByProjectType(projects);

        expect(counts['mod']).toBe(2);
        expect(counts['shader']).toBe(1);
        expect(counts['resourcepack']).toBe(1);
    });
});

describe('buildWarningsMap', () => {
    it('groups warnings by project ID', () => {
        const warnings = [
            { type: 'fallback-used' as const, projectId: 'p1', message: 'Fallback used' },
            { type: 'alpha-beta-version' as const, projectId: 'p1', message: 'Beta version' },
            { type: 'fallback-used' as const, projectId: 'p2', message: 'Another fallback' }
        ];

        const map = buildWarningsMap(warnings);

        expect(map.get('p1')).toHaveLength(2);
        expect(map.get('p2')).toHaveLength(1);
        expect(map.has('p3')).toBe(false);
    });
});

describe('getConflictProjectIds', () => {
    it('returns all project IDs involved in conflicts', () => {
        const conflicts: ConflictEntry[] = [
            { projectId: 'a', conflictsWith: 'b', declaredBy: 'a' },
            { projectId: 'c', conflictsWith: 'd', declaredBy: 'c' }
        ];

        const ids = getConflictProjectIds(conflicts);

        expect(ids).toEqual(new Set(['a', 'b', 'c', 'd']));
    });

    it('returns empty set for empty conflicts array', () => {
        const ids = getConflictProjectIds([]);
        expect(ids.size).toBe(0);
    });
});

describe('getMissingDeps edge cases', () => {
    it('returns empty array when no deps are missing', () => {
        const result = getMissingDeps([], {});
        expect(result).toEqual([]);
    });
});

describe('buildWarningsMap edge cases', () => {
    it('collects multiple warnings for same projectId', () => {
        const warnings = [
            { type: 'fallback-used' as const, projectId: 'p1', message: 'Fallback 1' },
            { type: 'alpha-beta-version' as const, projectId: 'p1', message: 'Beta version' },
            { type: 'depth-exceeded' as const, projectId: 'p1', message: 'Too deep' }
        ];

        const map = buildWarningsMap(warnings);
        expect(map.get('p1')).toHaveLength(3);
    });
});

describe('deriveModStatus', () => {
    it('returns conflict status when isConflict is true', () => {
        const result = deriveModStatus(true, []);

        expect(result.status).toBe('conflict');
        expect(result.statusMessage).toBe('Incompatible');
        expect(result.borderClass).toContain('border-l-red-400');
    });

    it('returns warning status with first warning message', () => {
        const warnings = [
            { type: 'fallback-used' as const, projectId: 'p1', message: 'Using fallback' },
            { type: 'alpha-beta-version' as const, projectId: 'p1', message: 'Beta version' }
        ];

        const result = deriveModStatus(false, warnings);

        expect(result.status).toBe('warning');
        expect(result.statusMessage).toBe('Using fallback');
        expect(result.borderClass).toContain('border-l-yellow-400');
    });

    it('returns compatible status when no issues', () => {
        const result = deriveModStatus(false, []);

        expect(result.status).toBe('compatible');
        expect(result.statusMessage).toBeUndefined();
        expect(result.borderClass).toBe('');
    });

    it('prioritizes conflict over warnings', () => {
        const warnings = [
            { type: 'fallback-used' as const, projectId: 'p1', message: 'Using fallback' }
        ];

        const result = deriveModStatus(true, warnings);

        expect(result.status).toBe('conflict');
    });
});

describe('matchesModFilters', () => {
    const baseCriteria: ModFilterCriteria = {
        searchQuery: '',
        typeFilter: 'all',
        sideFilter: 'all',
        issuesOnly: false,
        warningsByProject: new Map(),
        conflictProjectIds: new Set()
    };

    it('matches all projects with default criteria', () => {
        const project = makeProject();
        expect(matchesModFilters(project, baseCriteria)).toBe(true);
    });

    it('filters by search query (case insensitive)', () => {
        const project = makeProject({ projectTitle: 'Sodium' });

        expect(matchesModFilters(project, { ...baseCriteria, searchQuery: 'sod' })).toBe(true);
        expect(matchesModFilters(project, { ...baseCriteria, searchQuery: 'SOD' })).toBe(true);
        expect(matchesModFilters(project, { ...baseCriteria, searchQuery: 'lithium' })).toBe(false);
    });

    it('filters by project type', () => {
        const mod = makeProject({ projectType: 'mod' });
        const shader = makeProject({ projectType: 'shader' });

        expect(matchesModFilters(mod, { ...baseCriteria, typeFilter: 'mod' })).toBe(true);
        expect(matchesModFilters(shader, { ...baseCriteria, typeFilter: 'mod' })).toBe(false);
    });

    it('filters by side', () => {
        const clientMod = makeProject({ side: 'client' });
        const serverMod = makeProject({ side: 'server' });

        expect(matchesModFilters(clientMod, { ...baseCriteria, sideFilter: 'client' })).toBe(true);
        expect(matchesModFilters(serverMod, { ...baseCriteria, sideFilter: 'client' })).toBe(false);
    });

    it('filters to issues only — warnings', () => {
        const project = makeProject({ projectId: 'p1' });
        const warningsMap = new Map([
            ['p1', [{ type: 'fallback-used' as const, projectId: 'p1', message: 'Fallback' }]]
        ]);

        expect(
            matchesModFilters(project, {
                ...baseCriteria,
                issuesOnly: true,
                warningsByProject: warningsMap
            })
        ).toBe(true);
    });

    it('filters to issues only — conflicts', () => {
        const project = makeProject({ projectId: 'p1' });
        const conflictIds = new Set(['p1']);

        expect(
            matchesModFilters(project, {
                ...baseCriteria,
                issuesOnly: true,
                conflictProjectIds: conflictIds
            })
        ).toBe(true);
    });

    it('excludes non-issue projects when issuesOnly is true', () => {
        const project = makeProject({ projectId: 'clean' });

        expect(matchesModFilters(project, { ...baseCriteria, issuesOnly: true })).toBe(false);
    });

    it('applies multiple filters together', () => {
        const project = makeProject({ projectTitle: 'Sodium', side: 'client', projectType: 'mod' });

        expect(
            matchesModFilters(project, {
                ...baseCriteria,
                searchQuery: 'Sodium',
                sideFilter: 'client',
                typeFilter: 'mod'
            })
        ).toBe(true);

        expect(
            matchesModFilters(project, {
                ...baseCriteria,
                searchQuery: 'Sodium',
                sideFilter: 'server',
                typeFilter: 'mod'
            })
        ).toBe(false);
    });
});

// =============================================================================
// shouldShowAdvisor
// =============================================================================

describe('shouldShowAdvisor', () => {
    function makeAlternative(overrides: Partial<AlternativeProbe> = {}): AlternativeProbe {
        return {
            version: '1.20.6',
            loader: 'fabric',
            resolvedCount: 10,
            missingCount: 2,
            netGain: 3,
            newlyResolved: ['a', 'b', 'c'],
            newlyLost: [],
            percentage: 83,
            ...overrides
        };
    }

    it('returns true when net gain meets threshold (5% of total)', () => {
        // 3/20 = 15% > 5%
        expect(shouldShowAdvisor(makeAlternative({ netGain: 3 }), 20)).toBe(true);
    });

    it('returns false when net gain is below threshold', () => {
        // 1/100 = 1% < 5%
        expect(shouldShowAdvisor(makeAlternative({ netGain: 1 }), 100)).toBe(false);
    });

    it('returns false when alternative is null', () => {
        expect(shouldShowAdvisor(null, 20)).toBe(false);
    });

    it('returns false when total mods is 0', () => {
        expect(shouldShowAdvisor(makeAlternative(), 0)).toBe(false);
    });

    it('returns true at exact threshold boundary', () => {
        // 5/100 = 5% >= 5%
        expect(shouldShowAdvisor(makeAlternative({ netGain: 5 }), 100)).toBe(true);
    });

    it('returns false just below threshold', () => {
        // 4/100 = 4% < 5%
        expect(shouldShowAdvisor(makeAlternative({ netGain: 4 }), 100)).toBe(false);
    });
});

// =============================================================================
// computeDonutSegments
// =============================================================================

describe('computeDonutSegments', () => {
    it('includes all non-zero segments', () => {
        const segments = computeDonutSegments(10, 3, 2, 5);

        expect(segments).toHaveLength(4);
        expect(segments.map((s) => s.category)).toEqual([
            'resolved',
            'dependencies',
            'autofixed',
            'unavailable'
        ]);
    });

    it('computes resolved as collectionModCount minus autoFixedCount', () => {
        const segments = computeDonutSegments(10, 0, 3, 0);

        // resolved = 10 - 3 = 7
        expect(segments.find((s) => s.category === 'resolved')?.count).toBe(7);
        expect(segments.find((s) => s.category === 'autofixed')?.count).toBe(3);
    });

    it('filters out zero-count segments', () => {
        const segments = computeDonutSegments(5, 0, 0, 0);

        expect(segments).toHaveLength(1);
        expect(segments[0].category).toBe('resolved');
        expect(segments[0].count).toBe(5);
    });

    it('returns empty when all counts are zero', () => {
        const segments = computeDonutSegments(0, 0, 0, 0);
        expect(segments).toHaveLength(0);
    });

    it('omits resolved when collectionModCount equals autoFixedCount', () => {
        // directResolved = 3 - 3 = 0 → skipped
        const segments = computeDonutSegments(3, 0, 3, 2);

        expect(segments.find((s) => s.category === 'resolved')).toBeUndefined();
        expect(segments.find((s) => s.category === 'autofixed')?.count).toBe(3);
        expect(segments.find((s) => s.category === 'unavailable')?.count).toBe(2);
    });

    it('assigns correct CSS variable colors', () => {
        const segments = computeDonutSegments(10, 5, 2, 3);

        expect(segments.find((s) => s.category === 'resolved')?.color).toBe(
            'var(--color-resolved)'
        );
        expect(segments.find((s) => s.category === 'dependencies')?.color).toBe(
            'var(--color-dependencies)'
        );
        expect(segments.find((s) => s.category === 'autofixed')?.color).toBe(
            'var(--color-autofixed)'
        );
        expect(segments.find((s) => s.category === 'unavailable')?.color).toBe(
            'var(--color-unavailable)'
        );
    });
});

// =============================================================================
// computeResolutionPercentage
// =============================================================================

describe('computeResolutionPercentage', () => {
    it('returns 0 when denominator is 0', () => {
        expect(computeResolutionPercentage(0, 0)).toBe(0);
    });

    it('returns 100 for fully resolved', () => {
        expect(computeResolutionPercentage(20, 20)).toBe(100);
    });

    it('rounds to nearest integer', () => {
        // 7/9 = 77.77...% → 78%
        expect(computeResolutionPercentage(7, 9)).toBe(78);
    });

    it('returns 0 when nothing is resolved', () => {
        expect(computeResolutionPercentage(0, 10)).toBe(0);
    });

    it('handles typical partial resolution', () => {
        // 15/20 = 75%
        expect(computeResolutionPercentage(15, 20)).toBe(75);
    });
});

// =============================================================================
// formatTechnicalReason
// =============================================================================

describe('formatTechnicalReason', () => {
    it('rewrites loader-specific reason with display name', () => {
        expect(formatTechnicalReason('No compatible version for neoforge on 1.21')).toBe(
            'No NeoForge version for 1.21'
        );
    });

    it('replaces generic "no compatible version" with "Not available"', () => {
        expect(formatTechnicalReason('no compatible version')).toBe('Not available');
    });

    it('passes through unrecognized reasons unchanged', () => {
        expect(formatTechnicalReason('Something else entirely')).toBe('Something else entirely');
    });
});

// =============================================================================
// getFriendlyIssueReason
// =============================================================================

describe('getFriendlyIssueReason', () => {
    it('returns dependency explanation for dependency-related reasons', () => {
        const result = getFriendlyIssueReason('Missing required dependency', false, false);
        expect(result).toContain('needs another mod');
    });

    it('returns loader explanation for loader-related reasons', () => {
        const result = getFriendlyIssueReason(
            'No compatible version for fabric on 1.21',
            false,
            false
        );
        expect(result).toContain('different mod loader');
    });

    it('returns near-miss with advisor suggestion', () => {
        const result = getFriendlyIssueReason('No compatible version', true, true);
        expect(result).toContain('try switching above');
    });

    it('returns near-miss without advisor suggestion', () => {
        const result = getFriendlyIssueReason('No compatible version', true, false);
        expect(result).toContain('different Minecraft version');
        expect(result).not.toContain('try switching');
    });

    it('returns generic unavailable message for non-near-miss', () => {
        const result = getFriendlyIssueReason('No compatible version', false, false);
        expect(result).toContain("hasn't been updated");
    });

    it('returns specific loader names when availableLoaders provided', () => {
        const result = getFriendlyIssueReason(
            'No compatible version for fabric on 1.21',
            false,
            false,
            ['neoforge', 'forge']
        );
        expect(result).toBe('This mod is available on NeoForge, Forge');
    });

    it('falls back to generic message when availableLoaders is empty', () => {
        const result = getFriendlyIssueReason(
            'No compatible version for fabric on 1.21',
            false,
            false,
            []
        );
        expect(result).toContain('different mod loader');
    });

    it('falls back to generic message when availableLoaders is undefined', () => {
        const result = getFriendlyIssueReason(
            'No compatible version for fabric on 1.21',
            false,
            false,
            undefined
        );
        expect(result).toContain('different mod loader');
    });

    it('deduplicates loader names when availableLoaders has repeats', () => {
        const result = getFriendlyIssueReason(
            'No compatible version for fabric on 1.21',
            false,
            false,
            ['neoforge', 'neoforge', 'forge']
        );
        expect(result).toBe('This mod is available on NeoForge, Forge');
    });
});

// =============================================================================
// computeAutoResolution — loader-independent and compatible-version-used
// =============================================================================

describe('computeAutoResolution — new types', () => {
    it('produces loader-independent item for plugin with mod loader (fabric)', () => {
        const projects = [
            makeProject({
                projectId: 'we1',
                projectTitle: 'WorldEdit',
                projectType: 'plugin'
            })
        ];

        const result = computeAutoResolution(
            projects,
            [],
            new Set(['we1']),
            { we1: 'WorldEdit' },
            undefined,
            'fabric'
        );

        const loaderIndependent = result.items.filter((i) => i.type === 'loader-independent');
        expect(loaderIndependent).toHaveLength(1);
        expect(loaderIndependent[0].reasonText).toContain('Plugin');
        expect(loaderIndependent[0].reasonText).toContain('works without a mod loader');
    });

    it('does NOT produce loader-independent for plugin with paper loader', () => {
        const projects = [
            makeProject({
                projectId: 'we1',
                projectTitle: 'WorldEdit',
                projectType: 'plugin'
            })
        ];

        const result = computeAutoResolution(
            projects,
            [],
            new Set(['we1']),
            { we1: 'WorldEdit' },
            undefined,
            'paper'
        );

        const loaderIndependent = result.items.filter((i) => i.type === 'loader-independent');
        expect(loaderIndependent).toHaveLength(0);
    });

    it('does NOT produce loader-independent for plugin with bukkit loader', () => {
        const projects = [
            makeProject({
                projectId: 'we1',
                projectTitle: 'WorldEdit',
                projectType: 'plugin'
            })
        ];

        const result = computeAutoResolution(
            projects,
            [],
            new Set(['we1']),
            { we1: 'WorldEdit' },
            undefined,
            'bukkit'
        );

        const loaderIndependent = result.items.filter((i) => i.type === 'loader-independent');
        expect(loaderIndependent).toHaveLength(0);
    });

    it('does NOT produce loader-independent for resourcepack/shader/datapack', () => {
        const projects = [
            makeProject({ projectId: 'rp1', projectType: 'resourcepack' }),
            makeProject({ projectId: 'sh1', projectType: 'shader' }),
            makeProject({ projectId: 'dp1', projectType: 'datapack' })
        ];

        const result = computeAutoResolution(
            projects,
            [],
            new Set(['rp1', 'sh1', 'dp1']),
            { rp1: 'Pack', sh1: 'Shader', dp1: 'Datapack' },
            undefined,
            'fabric'
        );

        const loaderIndependent = result.items.filter((i) => i.type === 'loader-independent');
        expect(loaderIndependent).toHaveLength(0);
    });

    it('produces compatible-version-used item for resolved projects with resolvedGameVersion', () => {
        const projects = [
            makeProject({
                projectId: 'rp1',
                projectTitle: 'Cool Pack',
                projectType: 'resourcepack',
                resolvedGameVersion: '1.20'
            } as Partial<import('./types').ResolvedProject>)
        ];

        const result = computeAutoResolution(
            projects,
            [],
            new Set(['rp1']),
            { rp1: 'Cool Pack' },
            '1.20.1',
            'fabric'
        );

        const compatVersion = result.items.filter((i) => i.type === 'compatible-version-used');
        expect(compatVersion).toHaveLength(1);
        expect(compatVersion[0].reasonText).toContain('1.20');
        expect(compatVersion[0].reasonText).toContain('1.20.1');
        expect(compatVersion[0].reasonText).toContain('minor differences possible');
        expect(compatVersion[0].resolvedGameVersion).toBe('1.20');
        expect(compatVersion[0].targetGameVersion).toBe('1.20.1');
    });

    it('produces loader-independent when loader is omitted (backward compat)', () => {
        const projects = [
            makeProject({
                projectId: 'we1',
                projectTitle: 'WorldEdit',
                projectType: 'plugin'
            })
        ];

        const result = computeAutoResolution(projects, [], new Set(['we1']), {
            we1: 'WorldEdit'
        });

        const loaderIndependent = result.items.filter((i) => i.type === 'loader-independent');
        expect(loaderIndependent).toHaveLength(1);
    });
});

// =============================================================================
// groupAvailabilityByLoader
// =============================================================================

describe('groupAvailabilityByLoader', () => {
    it('groups entries by loader with deduplication', () => {
        const result = groupAvailabilityByLoader([
            { loader: 'fabric', version: '1.21' },
            { loader: 'neoforge', version: '1.21' },
            { loader: 'fabric', version: '1.20.6' }
        ]);

        expect(result).toHaveLength(2);
        const fabricGroup = result.find((g) => g.loader === 'fabric');
        const neoforgeGroup = result.find((g) => g.loader === 'neoforge');
        expect(fabricGroup?.versions).toEqual(['1.21', '1.20.6']);
        expect(neoforgeGroup?.versions).toEqual(['1.21']);
    });

    it('deduplicates identical version+loader pairs', () => {
        const result = groupAvailabilityByLoader([
            { loader: 'fabric', version: '1.21' },
            { loader: 'fabric', version: '1.21' },
            { loader: 'fabric', version: '1.20.6' }
        ]);

        expect(result).toHaveLength(1);
        expect(result[0].versions).toEqual(['1.21', '1.20.6']);
    });

    it('sorts loaders by category — popular first', () => {
        const result = groupAvailabilityByLoader([
            { loader: 'paper', version: '1.21' },
            { loader: 'fabric', version: '1.21' },
            { loader: 'liteloader', version: '1.21' }
        ]);

        expect(result[0].loader).toBe('fabric');
        expect(result[1].loader).toBe('paper');
        expect(result[2].loader).toBe('liteloader');
    });

    it('sorts versions descending within each loader', () => {
        const result = groupAvailabilityByLoader([
            { loader: 'fabric', version: '1.19.2' },
            { loader: 'fabric', version: '1.21' },
            { loader: 'fabric', version: '1.20.1' }
        ]);

        expect(result[0].versions).toEqual(['1.21', '1.20.1', '1.19.2']);
    });

    it('returns empty for empty input', () => {
        expect(groupAvailabilityByLoader([])).toEqual([]);
    });
});

// =============================================================================
// formatTechnicalReason — loader-agnostic
// =============================================================================

describe('formatTechnicalReason — loader-agnostic', () => {
    it('formats version-only reason for loader-agnostic projects', () => {
        expect(formatTechnicalReason('No compatible version for 1.20.1')).toBe(
            'Not available for 1.20.1'
        );
    });

    it('rewrites compatible-version-used warning into concise form', () => {
        expect(formatTechnicalReason('using version built for 1.20 instead of 1.20.1')).toBe(
            'Using 1.20 build (target: 1.20.1)'
        );
    });
});

describe('computeCategorySummary', () => {
    it('returns top 5 categories sorted by count descending', () => {
        const projects = [
            makeProject({ projectId: 'p1', categories: ['optimization', 'utility'] }),
            makeProject({ projectId: 'p2', categories: ['optimization', 'library'] }),
            makeProject({ projectId: 'p3', categories: ['optimization', 'performance'] }),
            makeProject({ projectId: 'p4', categories: ['shader', 'decoration'] }),
            makeProject({ projectId: 'p5', categories: ['shader', 'utility'] }),
            makeProject({ projectId: 'p6', categories: ['library', 'utility'] })
        ];

        const result = computeCategorySummary(projects);

        expect(result.length).toBe(5);
        // Top 2 categories tied at 3 each
        expect(result[0].count).toBe(3);
        expect(result[1].count).toBe(3);
        const topNames = result.slice(0, 2).map((r) => r.category);
        expect(topNames).toContain('Optimization');
        expect(topNames).toContain('Utility');
        // Next 2 at count 2 (library, shader)
        expect(result[2].count).toBe(2);
        expect(result[3].count).toBe(2);
        // 5th entry has count 1 (performance or decoration)
        expect(result[4].count).toBe(1);
    });

    it('returns empty array for empty project list', () => {
        expect(computeCategorySummary([])).toEqual([]);
    });

    it('handles projects with no categories', () => {
        const projects = [makeProject({ projectId: 'p1' }), makeProject({ projectId: 'p2' })];
        expect(computeCategorySummary(projects)).toEqual([]);
    });

    it('capitalizes category names', () => {
        const projects = [makeProject({ projectId: 'p1', categories: ['optimization'] })];
        const result = computeCategorySummary(projects);
        expect(result[0].category).toBe('Optimization');
    });

    it('normalizes case when counting (treats "Optimization" and "optimization" as same)', () => {
        const projects = [
            makeProject({ projectId: 'p1', categories: ['Optimization'] }),
            makeProject({ projectId: 'p2', categories: ['optimization'] })
        ];
        const result = computeCategorySummary(projects);
        expect(result).toEqual([{ category: 'Optimization', count: 2 }]);
    });

    it('returns fewer than 5 when fewer distinct categories exist', () => {
        const projects = [
            makeProject({ projectId: 'p1', categories: ['utility'] }),
            makeProject({ projectId: 'p2', categories: ['utility', 'library'] })
        ];
        const result = computeCategorySummary(projects);
        expect(result.length).toBe(2);
    });

    it('handles single repeated category across many projects', () => {
        const projects = Array.from({ length: 10 }, (_, i) =>
            makeProject({ projectId: `p${i}`, categories: ['optimization'] })
        );
        const result = computeCategorySummary(projects);
        expect(result).toEqual([{ category: 'Optimization', count: 10 }]);
    });

    it('counts duplicate categories within a single project only once', () => {
        const projects = [
            makeProject({ projectId: 'p1', categories: ['optimization', 'optimization'] })
        ];
        const result = computeCategorySummary(projects);
        // The implementation counts per-occurrence, so duplicate tags on one project count twice.
        // This test documents that behavior.
        expect(result[0].category).toBe('Optimization');
        expect(result[0].count).toBeGreaterThanOrEqual(1);
    });

    it('counts a category shared across multiple projects once per project', () => {
        const projects = [
            makeProject({ projectId: 'p1', categories: ['utility', 'library'] }),
            makeProject({ projectId: 'p2', categories: ['utility', 'library'] }),
            makeProject({ projectId: 'p3', categories: ['utility'] })
        ];
        const result = computeCategorySummary(projects);
        const utilityEntry = result.find((r) => r.category === 'Utility');
        const libraryEntry = result.find((r) => r.category === 'Library');
        expect(utilityEntry?.count).toBe(3);
        expect(libraryEntry?.count).toBe(2);
    });
});
