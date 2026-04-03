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
    type ModFilterCriteria
} from './review-resolution';

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

        const result = computeAutoResolution(projects, [], new Set(['p1']), { p1: 'Indium' });

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

        const result = computeAutoResolution(projects, [], new Set(['p1', 'p2']), {
            p1: 'BetaMod',
            p2: 'AlphaMod'
        });

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
            titleMap
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
            { 'mod-a': 'Mod A', 'mod-b': 'Mod B' }
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
            { a: 'A', dep: 'Dep' }
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
