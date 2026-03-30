<script lang="ts">
    import type { ResolvedProject, ResolutionWarning } from '$lib/services/types';
    import * as Collapsible from '$lib/components/ui/collapsible';
    import ModCard from './ModCard.svelte';
    import CompactRow from './CompactRow.svelte';
    import { cn } from '$lib/utils';
    import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
    import PackageIcon from '@lucide/svelte/icons/package';

    interface Props {
        dependencies: ResolvedProject[];
        projectTitleMap: Record<string, string>;
        warningsByProject: Map<string, ResolutionWarning[]>;
        conflictProjectIds: Set<string>;
        loader: string;
        viewMode?: 'detailed' | 'compact';
        onExclude?: (id: string) => void;
        excludedIds?: Set<string>;
    }

    let {
        dependencies,
        projectTitleMap,
        warningsByProject,
        conflictProjectIds,
        loader,
        viewMode = 'detailed',
        onExclude,
        excludedIds = new Set()
    }: Props = $props();

    let open = $state(true);

    const SIDE_ORDER = ['client', 'server', 'both'] as const;
    const SIDE_LABELS: Record<string, string> = {
        client: 'Client',
        server: 'Server',
        both: 'Both'
    };

    let annotatedDeps = $derived(
        dependencies.map((dep) => ({
            ...dep,
            dependencyOf: dep.dependencyOf
                ? (projectTitleMap[dep.dependencyOf] ?? dep.dependencyOf)
                : undefined
        }))
    );

    let sideGroups = $derived(
        SIDE_ORDER.map((side) => ({
            side,
            label: SIDE_LABELS[side],
            projects: annotatedDeps.filter((p) => p.side === side)
        })).filter((g) => g.projects.length > 0)
    );
</script>

<Collapsible.Root bind:open>
    <div class="rounded-lg border border-dashed">
        <!-- Header -->
        <Collapsible.Trigger
            class="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
        >
            <PackageIcon class="size-5 text-muted-foreground" />

            <div class="flex-1">
                <span class="font-semibold">Auto-resolved Dependencies</span>
                <span class="ml-2 text-sm text-muted-foreground">
                    ({dependencies.length})
                </span>
            </div>

            <ChevronDownIcon
                class={cn(
                    'size-4 text-muted-foreground transition-transform duration-200',
                    open ? 'rotate-180' : ''
                )}
            />
        </Collapsible.Trigger>

        <!-- Content -->
        <Collapsible.Content>
            <div class="space-y-4 px-4 pb-4">
                {#each sideGroups as { side, label, projects } (side)}
                    <div>
                        <h4 class="mb-2 text-sm font-medium text-muted-foreground">
                            {label} ({projects.length})
                        </h4>
                        {#if viewMode === 'compact'}
                            <div class="space-y-1">
                                {#each projects as project (project.projectId)}
                                    <CompactRow
                                        {project}
                                        warnings={warningsByProject.get(project.projectId) ?? []}
                                        isConflict={conflictProjectIds.has(project.projectId)}
                                        {loader}
                                        {onExclude}
                                        isExcluded={excludedIds.has(project.projectId)}
                                    />
                                {/each}
                            </div>
                        {:else}
                            <div class="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                                {#each projects as project, i (project.projectId)}
                                    <ModCard
                                        {project}
                                        warnings={warningsByProject.get(project.projectId) ?? []}
                                        isConflict={conflictProjectIds.has(project.projectId)}
                                        {loader}
                                        index={i}
                                        {onExclude}
                                        isExcluded={excludedIds.has(project.projectId)}
                                    />
                                {/each}
                            </div>
                        {/if}
                    </div>
                {/each}
            </div>
        </Collapsible.Content>
    </div>
</Collapsible.Root>
