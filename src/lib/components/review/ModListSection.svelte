<script lang="ts">
    import type { ResolvedProject, ResolutionWarning, CollectionGroup } from '$lib/services/types';
    import type { ProjectType } from '$lib/api/types';
    import type { SideClassification } from '$lib/services/types';
    import type { ViewMode } from '$lib/services/review-resolution';
    import {
        countByProjectType,
        matchesModFilters,
        type ModFilterCriteria
    } from '$lib/services/review-resolution';
    import * as Collapsible from '$lib/components/ui/collapsible';
    import * as Select from '$lib/components/ui/select';
    import * as ToggleGroup from '$lib/components/ui/toggle-group';
    import { Input } from '$lib/components/ui/input';
    import { Switch } from '$lib/components/ui/switch';
    import { Label } from '$lib/components/ui/label';
    import ModRow from './ModRow.svelte';
    import ModAvatar from './ModAvatar.svelte';
    import { cn } from '$lib/utils';
    import { browser } from '$app/environment';
    import { fade } from 'svelte/transition';
    import { safeTransition } from '$lib/utils/motion';
    import { SIDE_LABELS, SIDE_ICONS } from '$lib/utils/colors';
    import SearchIcon from '@lucide/svelte/icons/search';
    import PackageIcon from '@lucide/svelte/icons/package';
    import ImageIcon from '@lucide/svelte/icons/image';
    import SparklesIcon from '@lucide/svelte/icons/sparkles';
    import DatabaseIcon from '@lucide/svelte/icons/database';
    import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
    import SearchXIcon from '@lucide/svelte/icons/search-x';
    import AlertTriangleIcon from '@lucide/svelte/icons/triangle-alert';
    import ListIcon from '@lucide/svelte/icons/list';
    import LayoutListIcon from '@lucide/svelte/icons/layout-list';
    import * as Empty from '$lib/components/ui/empty';
    import { SvelteMap } from 'svelte/reactivity';

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
        collections?: CollectionGroup[];
        viewMode?: ViewMode;
        onViewModeChange?: (mode: ViewMode) => void;
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
        onSelectProject,
        collections = [],
        viewMode = 'detailed',
        onViewModeChange
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

    let filterCriteria = $derived<ModFilterCriteria>({
        searchQuery,
        typeFilter,
        sideFilter,
        issuesOnly: showIssuesOnly,
        warningsByProject,
        conflictProjectIds
    });

    function matchesFilters(project: ResolvedProject): boolean {
        return matchesModFilters(project, filterCriteria);
    }

    let filteredProjects = $derived(projects.filter(matchesFilters));
    let filteredDeps = $derived(dependencies.filter(matchesFilters));

    let typeFilterLabel = $derived(
        typeFilter === 'all'
            ? `All Mods (${projects.length})`
            : `${TYPE_CONFIG[typeFilter]?.label ?? typeFilter} (${typeCounts[typeFilter] ?? 0})`
    );

    // Group projects by collection when multiple collections exist
    let showCollectionGroups = $derived(collections.length > 1);
    let collectionProjectMap = $derived.by(() => {
        if (!showCollectionGroups) return null;
        const map = new SvelteMap<
            string,
            { group: CollectionGroup; projects: ResolvedProject[] }
        >();
        for (const group of collections) {
            const groupProjectIds = new Set(group.resolved.map((p) => p.projectId));
            const groupProjects = projects.filter((p) => groupProjectIds.has(p.projectId));
            if (groupProjects.length > 0) {
                map.set(group.id, { group, projects: groupProjects });
            }
        }
        return map;
    });

    let isFiltering = $derived(
        searchQuery !== '' || typeFilter !== 'all' || sideFilter !== 'all' || showIssuesOnly
    );

    let collectionFilteredCounts = $derived.by(() => {
        if (!showCollectionGroups || !collectionProjectMap) return new SvelteMap<string, number>();
        const counts = new SvelteMap<string, number>();
        for (const [id, entry] of collectionProjectMap) {
            counts.set(id, entry.projects.filter(matchesFilters).length);
        }
        return counts;
    });

    function handleViewModeToggle(value: string | undefined) {
        if (value === 'simple' || value === 'detailed') {
            onViewModeChange?.(value);
        }
    }
</script>

<div class="space-y-4">
    <!-- Row 1: Search -->
    <div class="relative">
        <SearchIcon
            class="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
            type="text"
            placeholder="Filter mods by name..."
            class="pl-9"
            bind:value={searchQuery}
        />
        {#if filteredProjects.length !== projects.length}
            <span class="absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted-foreground">
                {filteredProjects.length} of {projects.length}
            </span>
        {/if}
    </div>

    <!-- Row 2: Type select + Side toggles + Issues switch + View toggle -->
    <div class="flex flex-wrap items-center gap-3">
        {#if availableTypes.length > 1}
            <Select.Root type="single" bind:value={typeFilter}>
                <Select.Trigger class="h-8 w-auto min-w-40 text-xs font-semibold">
                    {#if typeFilter !== 'all' && TYPE_CONFIG[typeFilter]}
                        {@const Icon = TYPE_CONFIG[typeFilter].icon}
                        <Icon class="mr-1 size-3" />
                    {/if}
                    {typeFilterLabel}
                </Select.Trigger>
                <Select.Content>
                    <Select.Item value="all">All ({projects.length})</Select.Item>
                    {#each availableTypes as type (type)}
                        {@const config = TYPE_CONFIG[type]}
                        {#if config}
                            {@const Icon = config.icon}
                            <Select.Item value={type}>
                                <Icon class="mr-1.5 size-3.5" />
                                {config.label} ({typeCounts[type]})
                            </Select.Item>
                        {/if}
                    {/each}
                </Select.Content>
            </Select.Root>
        {/if}

        <!-- Side filter -->
        <ToggleGroup.Root type="single" bind:value={sideFilter} variant="outline" size="default">
            <ToggleGroup.Item value="all" class="min-w-25 flex-none px-3 whitespace-nowrap"
                >All</ToggleGroup.Item
            >
            <ToggleGroup.Item value="client" class="min-w-25 flex-none px-3 whitespace-nowrap">
                <SIDE_ICONS.client class="size-3 sm:mr-1" />
                <span class="hidden sm:inline">{SIDE_LABELS['client']}</span>
            </ToggleGroup.Item>
            <ToggleGroup.Item value="server" class="min-w-25 flex-none px-3 whitespace-nowrap">
                <SIDE_ICONS.server class="size-3 sm:mr-1" />
                <span class="hidden sm:inline">{SIDE_LABELS['server']}</span>
            </ToggleGroup.Item>
            <ToggleGroup.Item value="both" class="min-w-25 flex-none px-3 whitespace-nowrap">
                <SIDE_ICONS.both class="size-3 sm:mr-1" />
                <span class="hidden sm:inline">{SIDE_LABELS['both']}</span>
            </ToggleGroup.Item>
        </ToggleGroup.Root>

        <!-- Issues toggle -->
        <div class="flex items-center gap-2">
            <Switch id="issues-toggle" bind:checked={showIssuesOnly} />
            <Label for="issues-toggle" class="flex items-center gap-1 text-sm">
                <AlertTriangleIcon class="size-3.5 text-yellow-500" />
                <span class="hidden sm:inline">Issues</span>
            </Label>
        </div>

        <!-- View mode toggle -->
        {#if onViewModeChange}
            <div class="ml-auto">
                <ToggleGroup.Root
                    type="single"
                    value={viewMode}
                    onValueChange={handleViewModeToggle}
                    variant="outline"
                    size="sm"
                >
                    <ToggleGroup.Item value="simple" class="px-2" aria-label="Simple view">
                        <ListIcon class="size-3.5" />
                    </ToggleGroup.Item>
                    <ToggleGroup.Item value="detailed" class="px-2" aria-label="Detailed view">
                        <LayoutListIcon class="size-3.5" />
                    </ToggleGroup.Item>
                </ToggleGroup.Root>
            </div>
        {/if}
    </div>

    <!-- Project list -->
    {#key viewMode}
        <div
            in:fade={safeTransition({ duration: 150, delay: 50 })}
            out:fade={safeTransition({ duration: 100 })}
        >
            {#if showCollectionGroups && collectionProjectMap}
                <!-- Grouped by collection -->
                {#each collections as group (group.id)}
                    {@const entry = collectionProjectMap.get(group.id)}
                    {#if entry && entry.projects.length > 0}
                        {@const filteredCount =
                            collectionFilteredCounts.get(group.id) ?? entry.projects.length}
                        <!-- Collection header -->
                        <div class="my-6 flex flex-col border-b pt-3 pb-2">
                            <div class="flex items-center gap-2">
                                <ModAvatar
                                    iconUrl={group.iconUrl}
                                    title={group.name}
                                    size="sm"
                                    rounding="rounded-md"
                                />
                                <span class="text-sm font-semibold">{group.name}</span>
                                <span class="text-xs text-muted-foreground">
                                    {#if isFiltering}
                                        {filteredCount} of {entry.projects.length} mods
                                    {:else}
                                        {entry.projects.length} mods
                                    {/if}
                                </span>
                            </div>
                            {#if isFiltering && filteredCount === 0}
                                <p class="mt-1 ml-8 text-xs text-muted-foreground/60">
                                    No mods match current filters
                                </p>
                            {/if}
                        </div>
                        <div class="space-y-1">
                            {#each entry.projects as project (project.projectId)}
                                <div class:hidden={!matchesFilters(project)}>
                                    <ModRow
                                        {project}
                                        {viewMode}
                                        warnings={warningsByProject.get(project.projectId) ?? []}
                                        isConflict={conflictProjectIds.has(project.projectId)}
                                        {loader}
                                        isExcluded={excludedIds.has(project.projectId)}
                                        {onExclude}
                                        onSelect={onSelectProject}
                                    />
                                </div>
                            {/each}
                        </div>
                    {/if}
                {/each}
            {:else}
                <!-- Flat list -->
                <div class="space-y-1">
                    {#each projects as project (project.projectId)}
                        <div class:hidden={!matchesFilters(project)}>
                            <ModRow
                                {project}
                                {viewMode}
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
            {/if}
        </div>
    {/key}

    {#if filteredProjects.length === 0 && (searchQuery || typeFilter !== 'all' || sideFilter !== 'all' || showIssuesOnly)}
        <Empty.Root class="text-muted-foreground">
            <Empty.Header>
                <Empty.Media variant="icon">
                    <SearchXIcon class="text-muted-foreground" />
                </Empty.Media>
                <Empty.Title>No Matches Found</Empty.Title>
                <Empty.Description>No mods or projects match your filters.</Empty.Description>
            </Empty.Header>
        </Empty.Root>
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
                        Dependencies ({filteredDeps.length})
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
                        {#each dependencies as dep (dep.projectId)}
                            <div class:hidden={!matchesFilters(dep)}>
                                <ModRow
                                    project={dep}
                                    {viewMode}
                                    warnings={warningsByProject.get(dep.projectId) ?? []}
                                    isConflict={conflictProjectIds.has(dep.projectId)}
                                    {loader}
                                    collectionName={dep.dependencyOf
                                        ? (projectTitleMap[dep.dependencyOf] ?? dep.dependencyOf)
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
