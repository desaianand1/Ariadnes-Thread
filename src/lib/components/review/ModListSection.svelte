<script lang="ts">
    import type { ResolvedProject, ResolutionWarning } from '$lib/services/types';
    import type { ProjectType } from '$lib/api/types';
    import type { SideClassification } from '$lib/services/types';
    import { countByProjectType } from '$lib/services/review-resolution';
    import * as Collapsible from '$lib/components/ui/collapsible';
    import * as ToggleGroup from '$lib/components/ui/toggle-group';
    import { Input } from '$lib/components/ui/input';
    import { Switch } from '$lib/components/ui/switch';
    import { Label } from '$lib/components/ui/label';
    import ModRow from './ModRow.svelte';
    import { cn } from '$lib/utils';
    import { slide } from 'svelte/transition';
    import { safeTransition } from '$lib/utils/motion';
    import { browser } from '$app/environment';
    import SearchIcon from '@lucide/svelte/icons/search';
    import PackageIcon from '@lucide/svelte/icons/package';
    import ImageIcon from '@lucide/svelte/icons/image';
    import SparklesIcon from '@lucide/svelte/icons/sparkles';
    import DatabaseIcon from '@lucide/svelte/icons/database';
    import MonitorIcon from '@lucide/svelte/icons/monitor';
    import ServerIcon from '@lucide/svelte/icons/server';
    import LayersIcon from '@lucide/svelte/icons/layers';
    import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
    import AlertTriangleIcon from '@lucide/svelte/icons/triangle-alert';

    interface Props {
        projects: ResolvedProject[];
        dependencies: ResolvedProject[];
        projectTitleMap: Record<string, string>;
        warningsByProject: Map<string, ResolutionWarning[]>;
        conflictProjectIds: Set<string>;
        loader: string;
        excludedIds: Set<string>;
        onExclude: (id: string) => void;
        collectionNames: Record<string, string>;
        showCollectionNames: boolean;
        onSelectProject: (project: ResolvedProject) => void;
    }

    let {
        projects,
        dependencies,
        projectTitleMap,
        warningsByProject,
        conflictProjectIds,
        loader,
        excludedIds,
        onExclude,
        collectionNames,
        showCollectionNames,
        onSelectProject
    }: Props = $props();

    let searchQuery = $state('');
    let typeFilter = $state<'all' | ProjectType>('all');
    let sideFilter = $state<'all' | SideClassification>('all');
    let showIssuesOnly = $state(false);
    let depsOpen = $state(true);

    $effect(() => {
        if (!browser) return;
        const mq = window.matchMedia('(max-width: 639px)');
        depsOpen = !mq.matches;
    });

    let inputValue = $state('');
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;

    function onInput(e: Event) {
        const target = e.target as HTMLInputElement;
        inputValue = target.value;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            searchQuery = inputValue;
        }, 200);
    }

    const TYPE_CONFIG: Record<string, { label: string; icon: typeof PackageIcon }> = {
        mod: { label: 'Mods', icon: PackageIcon },
        resourcepack: { label: 'Resource Packs', icon: ImageIcon },
        shader: { label: 'Shaders', icon: SparklesIcon },
        datapack: { label: 'Data Packs', icon: DatabaseIcon }
    };

    let typeCounts = $derived(countByProjectType(projects));
    let availableTypes = $derived(
        Object.entries(typeCounts)
            .filter(([_, count]) => count > 0)
            .map(([type]) => type as ProjectType)
    );

    function matchesFilters(project: ResolvedProject): boolean {
        if (searchQuery && !project.projectTitle.toLowerCase().includes(searchQuery.toLowerCase()))
            return false;
        if (typeFilter !== 'all' && project.projectType !== typeFilter) return false;
        if (sideFilter !== 'all' && project.side !== sideFilter) return false;
        if (showIssuesOnly) {
            const hasIssue =
                warningsByProject.has(project.projectId) ||
                conflictProjectIds.has(project.projectId);
            if (!hasIssue) return false;
        }
        return true;
    }

    let filteredProjects = $derived(projects.filter(matchesFilters));
    let filteredDeps = $derived(dependencies.filter(matchesFilters));
</script>

<div class="space-y-4">
    <!-- Filter bar -->
    <div class="flex flex-wrap items-center gap-3">
        <!-- Search -->
        <div class="relative min-w-[200px] flex-1">
            <SearchIcon
                class="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
                type="text"
                placeholder="Filter mods by name..."
                class="pl-9"
                value={inputValue}
                oninput={onInput}
            />
        </div>

        <!-- Type filter chips -->
        {#if availableTypes.length > 1}
            <div class="scrollbar-thin overflow-x-auto">
                <ToggleGroup.Root
                    type="single"
                    bind:value={typeFilter}
                    variant="outline"
                    size="sm"
                    class="flex-nowrap"
                >
                    <ToggleGroup.Item value="all" class="shrink-0">
                        All ({projects.length})
                    </ToggleGroup.Item>
                    {#each availableTypes as type (type)}
                        {@const config = TYPE_CONFIG[type]}
                        {#if config}
                            {@const Icon = config.icon}
                            <ToggleGroup.Item value={type} class="shrink-0">
                                <Icon class="mr-1 size-3" />
                                {config.label} ({typeCounts[type]})
                            </ToggleGroup.Item>
                        {/if}
                    {/each}
                </ToggleGroup.Root>
            </div>
        {/if}

        <!-- Side filter -->
        <div class="scrollbar-thin overflow-x-auto">
            <ToggleGroup.Root
                type="single"
                bind:value={sideFilter}
                variant="outline"
                size="sm"
                class="flex-nowrap"
            >
                <ToggleGroup.Item value="all" class="shrink-0">All</ToggleGroup.Item>
                <ToggleGroup.Item value="client" class="shrink-0">
                    <MonitorIcon class="mr-1 size-3" />
                    Client
                </ToggleGroup.Item>
                <ToggleGroup.Item value="server" class="shrink-0">
                    <ServerIcon class="mr-1 size-3" />
                    Server
                </ToggleGroup.Item>
                <ToggleGroup.Item value="both" class="shrink-0">
                    <LayersIcon class="mr-1 size-3" />
                    Both
                </ToggleGroup.Item>
            </ToggleGroup.Root>
        </div>

        <!-- Issues toggle -->
        <div class="flex items-center gap-2">
            <Switch id="issues-toggle" bind:checked={showIssuesOnly} />
            <Label for="issues-toggle" class="flex items-center gap-1 text-sm">
                <AlertTriangleIcon class="size-3.5 text-yellow-500" />
                Show Issues
            </Label>
        </div>
    </div>

    <!-- Project list -->
    {#if filteredProjects.length > 0}
        <div class="space-y-1">
            {#each filteredProjects as project (project.projectId)}
                <div transition:slide={safeTransition({ duration: 150 })}>
                    <ModRow
                        {project}
                        warnings={warningsByProject.get(project.projectId) ?? []}
                        isConflict={conflictProjectIds.has(project.projectId)}
                        {loader}
                        collectionName={showCollectionNames
                            ? collectionNames[project.projectId]
                            : undefined}
                        isExcluded={excludedIds.has(project.projectId)}
                        {onExclude}
                        onSelect={onSelectProject}
                    />
                </div>
            {/each}
        </div>
    {:else if searchQuery || typeFilter !== 'all' || sideFilter !== 'all' || showIssuesOnly}
        <p class="py-8 text-center text-sm text-muted-foreground">No mods match your filters.</p>
    {/if}

    <!-- Dependencies section -->
    {#if filteredDeps.length > 0}
        <Collapsible.Root bind:open={depsOpen}>
            <div class="rounded-lg border border-dashed">
                <Collapsible.Trigger
                    class="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
                >
                    <PackageIcon class="size-4 text-muted-foreground" />
                    <span class="flex-1 text-sm font-medium">
                        Auto-resolved Dependencies ({filteredDeps.length})
                    </span>
                    <ChevronDownIcon
                        class={cn(
                            'size-4 text-muted-foreground transition-transform duration-200',
                            depsOpen && 'rotate-180'
                        )}
                    />
                </Collapsible.Trigger>
                <Collapsible.Content>
                    <div class="space-y-1 px-4 pb-3">
                        {#each filteredDeps as dep (dep.projectId)}
                            <div transition:slide={safeTransition({ duration: 150 })}>
                                <ModRow
                                    project={dep}
                                    warnings={warningsByProject.get(dep.projectId) ?? []}
                                    isConflict={conflictProjectIds.has(dep.projectId)}
                                    {loader}
                                    collectionName={dep.dependencyOf
                                        ? `required by: ${projectTitleMap[dep.dependencyOf] ?? dep.dependencyOf}`
                                        : undefined}
                                    isExcluded={excludedIds.has(dep.projectId)}
                                    {onExclude}
                                    onSelect={onSelectProject}
                                />
                            </div>
                        {/each}
                    </div>
                </Collapsible.Content>
            </div>
        </Collapsible.Root>
    {/if}
</div>
