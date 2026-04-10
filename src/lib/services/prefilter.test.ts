import { describe, it, expect } from 'vitest';
import { preFilterIncompatibleProjects } from './prefilter';
import type { ModrinthProject } from '$lib/api/types';

function makeProject(overrides: Partial<ModrinthProject> = {}): ModrinthProject {
    return {
        id: 'proj1',
        slug: 'test-mod',
        project_type: 'mod',
        team: 'team1',
        title: 'Test Mod',
        description: 'A test mod',
        body: '',
        published: '2024-01-01',
        updated: '2024-01-01',
        status: 'approved',
        license: { id: 'MIT', name: 'MIT', url: null },
        client_side: 'required',
        server_side: 'unsupported',
        downloads: 0,
        followers: 0,
        categories: [],
        additional_categories: [],
        game_versions: ['1.21.1'],
        loaders: ['fabric'],
        versions: [],
        icon_url: null,
        issues_url: null,
        source_url: null,
        wiki_url: null,
        discord_url: null,
        donation_urls: [],
        gallery: [],
        color: null,
        thread_id: '',
        monetization_status: 'monetized',
        ...overrides
    } as ModrinthProject;
}

describe('preFilterIncompatibleProjects', () => {
    describe('mods (non-loader-agnostic)', () => {
        it('keeps a mod when game version and loader both match', () => {
            const project = makeProject({
                game_versions: ['1.21.1', '1.20.1'],
                loaders: ['fabric', 'forge']
            });

            const { candidates, pruned } = preFilterIncompatibleProjects(
                [project],
                '1.21.1',
                'fabric',
                false
            );

            expect(candidates).toHaveLength(1);
            expect(pruned).toHaveLength(0);
        });

        it('prunes a mod whose game_versions never includes the target', () => {
            const project = makeProject({
                id: 'old-mod',
                game_versions: ['1.20.1', '1.19.2'],
                loaders: ['fabric']
            });

            const { candidates, pruned } = preFilterIncompatibleProjects(
                [project],
                '1.21.1',
                'fabric',
                false
            );

            expect(candidates).toHaveLength(0);
            expect(pruned[0].projectId).toBe('old-mod');
            expect(pruned[0].reason).toContain('1.21.1');
        });

        it('prunes a mod with correct game version but wrong loader', () => {
            const project = makeProject({
                id: 'wrong-loader',
                game_versions: ['1.21.1'],
                loaders: ['forge']
            });

            const { candidates, pruned } = preFilterIncompatibleProjects(
                [project],
                '1.21.1',
                'fabric',
                false
            );

            expect(candidates).toHaveLength(0);
            expect(pruned[0].projectId).toBe('wrong-loader');
        });

        it('keeps a fabric-only mod when quilt is selected with cross-loader fallback', () => {
            const project = makeProject({
                game_versions: ['1.21.1'],
                loaders: ['fabric']
            });

            const { candidates, pruned } = preFilterIncompatibleProjects(
                [project],
                '1.21.1',
                'quilt',
                true
            );

            expect(candidates).toHaveLength(1);
            expect(pruned).toHaveLength(0);
        });

        it('prunes a fabric-only mod when quilt is selected without cross-loader fallback', () => {
            const project = makeProject({
                game_versions: ['1.21.1'],
                loaders: ['fabric']
            });

            const { candidates, pruned } = preFilterIncompatibleProjects(
                [project],
                '1.21.1',
                'quilt',
                false
            );

            expect(candidates).toHaveLength(0);
            expect(pruned).toHaveLength(1);
        });
    });

    describe('loader-agnostic projects (shaders, resourcepacks, datapacks, plugins)', () => {
        it('keeps a resourcepack listing only "1.21" when target is "1.21.1" (minor-family match)', () => {
            const project = makeProject({
                project_type: 'resourcepack',
                game_versions: ['1.21'],
                loaders: []
            });

            const { candidates, pruned } = preFilterIncompatibleProjects(
                [project],
                '1.21.1',
                'fabric',
                false
            );

            expect(candidates).toHaveLength(1);
            expect(pruned).toHaveLength(0);
        });

        it('prunes a shader with no versions in the target minor family', () => {
            const project = makeProject({
                id: 'old-shader',
                project_type: 'shader',
                game_versions: ['1.19.2', '1.20.1'],
                loaders: []
            });

            const { candidates, pruned } = preFilterIncompatibleProjects(
                [project],
                '1.21.1',
                'fabric',
                false
            );

            expect(candidates).toHaveLength(0);
            expect(pruned[0].projectId).toBe('old-shader');
            // Loader-agnostic reason should not mention the loader
            expect(pruned[0].reason).not.toContain('fabric');
        });

        it('ignores loader mismatch — a datapack listing "forge" is kept for a fabric user', () => {
            const project = makeProject({
                project_type: 'datapack',
                game_versions: ['1.21.1'],
                loaders: ['forge']
            });

            const { candidates } = preFilterIncompatibleProjects(
                [project],
                '1.21.1',
                'fabric',
                false
            );

            expect(candidates).toHaveLength(1);
        });

        it('treats plugin type as loader-agnostic with minor-family matching', () => {
            const project = makeProject({
                project_type: 'plugin',
                game_versions: ['1.21'],
                loaders: ['paper']
            });

            const { candidates } = preFilterIncompatibleProjects(
                [project],
                '1.21.4',
                'fabric',
                false
            );

            expect(candidates).toHaveLength(1);
        });

        it('prunes loader-agnostic project when target is a snapshot (no minor family)', () => {
            const project = makeProject({
                project_type: 'shader',
                game_versions: ['1.21.1'],
                loaders: []
            });

            const { candidates, pruned } = preFilterIncompatibleProjects(
                [project],
                '24w03a',
                'fabric',
                false
            );

            expect(candidates).toHaveLength(0);
            expect(pruned).toHaveLength(1);
        });
    });

    describe('mixed collection', () => {
        it('partitions a realistic collection into candidates and rejects', () => {
            const projects = [
                makeProject({ id: 'mod-ok', game_versions: ['1.21.1'], loaders: ['fabric'] }),
                makeProject({
                    id: 'mod-wrong-ver',
                    game_versions: ['1.20.1'],
                    loaders: ['fabric']
                }),
                makeProject({
                    id: 'mod-wrong-loader',
                    game_versions: ['1.21.1'],
                    loaders: ['forge']
                }),
                makeProject({
                    id: 'shader-ok',
                    project_type: 'shader',
                    game_versions: ['1.21'],
                    loaders: []
                }),
                makeProject({
                    id: 'shader-old',
                    project_type: 'shader',
                    game_versions: ['1.19.2'],
                    loaders: []
                })
            ];

            const { candidates, pruned } = preFilterIncompatibleProjects(
                projects,
                '1.21.1',
                'fabric',
                false
            );

            expect(candidates.map((p) => p.id)).toEqual(['mod-ok', 'shader-ok']);
            expect(pruned.map((p) => p.projectId)).toEqual([
                'mod-wrong-ver',
                'mod-wrong-loader',
                'shader-old'
            ]);
        });
    });
});
