<script lang="ts">
    import type { PageData } from './$types';
    import type { ResolvedProject } from '$lib/services/types';
    import MetaTags from '$lib/components/MetaTags.svelte';
    import SummaryBar from '$lib/components/review/SummaryBar.svelte';
    import FilterBar from '$lib/components/review/FilterBar.svelte';
    import CollectionSection from '$lib/components/review/CollectionSection.svelte';
    import DependenciesSection from '$lib/components/review/DependenciesSection.svelte';
    import ConflictPanel from '$lib/components/review/ConflictPanel.svelte';
    import DownloadProgress from '$lib/components/review/DownloadProgress.svelte';
    import { Button } from '$lib/components/ui/button';
    import * as Empty from '$lib/components/ui/empty';
    import { getLoaderDisplayName } from '$lib/utils/format';
    import { buildReviewUrl } from '$lib/utils/url-state';
    import {
        getDownloadState,
        initDownload,
        startDownload,
        cancelDownload,
        resetDownload
    } from '$lib/state/download.svelte';
    import { fade } from 'svelte/transition';
    import { replaceState } from '$app/navigation';
    import { page } from '$app/stores';
    import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
    import PackageXIcon from '@lucide/svelte/icons/package-x';
    import SearchXIcon from '@lucide/svelte/icons/search-x';
    import { SvelteSet } from 'svelte/reactivity';
    import { resolve } from '$app/paths';

    let { data }: { data: PageData } = $props();

    let searchQuery = $state('');
    let sideFilter = $state<'all' | 'client' | 'server' | 'both'>('all');
    let statusFilter = $state<'all' | 'compatible' | 'warnings' | 'conflicts'>('all');
    let viewMode = $state<'detailed' | 'compact'>('detailed');
    let excludedIds = $state(new Set<string>(data.context.excludedProjectIds ?? []));

    // Download state
    let dlState = $derived(getDownloadState());
    let isDownloading = $derived(dlState.phase !== 'idle');
    let downloadProgress = $derived(
        dlState.overallTotalBytes > 0
            ? Math.round((dlState.overallBytesDownloaded / dlState.overallTotalBytes) * 100)
            : 0
    );

    let warningsByProject = $derived(
        data.warnings.reduce((map, w) => {
            const existing = map.get(w.projectId);
            if (existing) {
                existing.push(w);
            } else {
                map.set(w.projectId, [w]);
            }
            return map;
        }, new Map<string, typeof data.warnings>())
    );

    let conflictProjectIds = $derived(
        new Set(data.conflicts.flatMap((c) => [c.projectId, c.conflictsWith]))
    );

    function matchesFilters(project: ResolvedProject): boolean {
        if (excludedIds.has(project.projectId)) {
            return false;
        }

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            if (!project.projectTitle.toLowerCase().includes(query)) {
                return false;
            }
        }

        if (sideFilter !== 'all' && project.side !== sideFilter) {
            return false;
        }

        if (statusFilter !== 'all') {
            const hasWarning = warningsByProject.has(project.projectId);
            const hasConflict = conflictProjectIds.has(project.projectId);

            switch (statusFilter) {
                case 'compatible':
                    if (hasWarning || hasConflict) return false;
                    break;
                case 'warnings':
                    if (!hasWarning) return false;
                    break;
                case 'conflicts':
                    if (!hasConflict) return false;
                    break;
            }
        }

        return true;
    }

    function toggleExclude(projectId: string) {
        const next = new SvelteSet(excludedIds);
        if (next.has(projectId)) {
            next.delete(projectId);
        } else {
            next.add(projectId);
        }
        excludedIds = next;
        syncUrlExclusions();
    }

    function onExclude(projectId: string) {
        const next = new SvelteSet(excludedIds);
        next.add(projectId);
        excludedIds = next;
        syncUrlExclusions();
    }

    function onRestore(projectId: string) {
        const next = new SvelteSet(excludedIds);
        next.delete(projectId);
        excludedIds = next;
        syncUrlExclusions();
    }

    function syncUrlExclusions() {
        const currentUrl = new URL($page.url);
        const newUrl = buildReviewUrl(currentUrl, { x: excludedIds });
        replaceState(resolve(newUrl), {});
    }

    let filteredCollections = $derived(
        data.collections
            .map((group) => ({
                ...group,
                resolved: group.resolved.filter(matchesFilters)
            }))
            .filter((group) => group.resolved.length > 0)
    );

    let filteredDependencies = $derived(data.dependencies.filter(matchesFilters));

    let allVisibleProjects = $derived([
        ...filteredCollections.flatMap((g) => g.resolved),
        ...filteredDependencies
    ]);

    let collectionNames = $derived(data.collections.map((g) => g.name).join(', '));
    let totalModCount = $derived(
        data.collections.reduce((sum, g) => sum + g.resolved.length, 0) + data.dependencies.length
    );

    let pageTitle = $derived(
        `Review: ${collectionNames} — ${totalModCount} mods for MC ${data.context.gameVersion} ${getLoaderDisplayName(data.context.loader)}`
    );

    /** Recomputed stats reflecting exclusions */
    let effectiveStats = $derived.by(() => {
        return {
            ...data.stats,
            resolvedCount: allVisibleProjects.length,
            totalDownloadSize: allVisibleProjects.reduce((sum, r) => sum + r.fileSize, 0)
        };
    });

    let hasClientMods = $derived(
        allVisibleProjects.some((p) => p.side === 'client' || p.side === 'both')
    );
    let hasServerMods = $derived(
        allVisibleProjects.some((p) => p.side === 'server' || p.side === 'both')
    );

    let hasNoResolvedMods = $derived(totalModCount === 0);
    let isFilterEmpty = $derived(
        !hasNoResolvedMods && filteredCollections.length === 0 && filteredDependencies.length === 0
    );

    let hasExclusions = $derived(excludedIds.size > 0);

    // Download handlers
    function handleStartDownload(side: 'client' | 'server') {
        initDownload(allVisibleProjects, side);
        startDownload();
    }

    function handleCancelDownload() {
        cancelDownload();
    }

    function handleSaveZip() {
        if (!dlState.zipBlob) return;
        const sideLabel = dlState.targetSide ?? 'mods';
        const filename = `${collectionNames.replace(/[^a-zA-Z0-9 ]/g, '')}-${sideLabel}-${data.context.gameVersion}-${data.context.loader}.zip`;
        const url = URL.createObjectURL(dlState.zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    function handleBackToReview() {
        resetDownload();
    }

    // Prevent accidental navigation during download
    $effect(() => {
        if (isDownloading) {
            const handler = (e: BeforeUnloadEvent) => {
                e.preventDefault();
            };
            window.addEventListener('beforeunload', handler);
            return () => window.removeEventListener('beforeunload', handler);
        }
    });
</script>

<MetaTags
    title={pageTitle}
    description="Review and download {totalModCount} mods from {collectionNames} for Minecraft {data
        .context.gameVersion} on {data.context.loader}"
    path="/review"
/>

<div class="min-h-screen">
    <SummaryBar
        stats={effectiveStats}
        context={data.context}
        bind:viewMode
        downloadPhase={dlState.phase}
        {downloadProgress}
        downloadSpeed={dlState.speedBytesPerSec}
        downloadEta={dlState.eta}
        onStartDownload={handleStartDownload}
        onCancelDownload={handleCancelDownload}
        {hasClientMods}
        {hasServerMods}
    />

    {#if isDownloading}
        <!-- Download progress view replaces the review content -->
        <div class="mx-auto max-w-7xl space-y-4 px-4 py-4">
            <DownloadProgress
                state={dlState}
                onCancel={handleCancelDownload}
                onSave={handleSaveZip}
                onBackToReview={handleBackToReview}
            />
        </div>
    {:else}
        <!-- Normal review view -->
        <FilterBar bind:searchQuery bind:sideFilter bind:statusFilter />

        <div class="mx-auto max-w-7xl space-y-4 px-4 py-4">
            <!-- Back link -->
            <Button variant="ghost" size="sm" href="/">
                <ArrowLeftIcon class="mr-1.5 size-3.5" />
                Back to form
            </Button>

            <!-- Conflict panel -->
            {#if data.conflicts.length > 0}
                <ConflictPanel
                    conflicts={data.conflicts}
                    projectTitleMap={data.projectTitleMap}
                    {excludedIds}
                    {onExclude}
                    {onRestore}
                />
            {/if}

            <!-- Exclusion summary -->
            {#if hasExclusions}
                <div
                    class="flex items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground"
                >
                    <span>{excludedIds.size} mod{excludedIds.size !== 1 ? 's' : ''} excluded</span>
                    <Button
                        variant="ghost"
                        size="sm"
                        class="h-6 text-xs"
                        onclick={() => {
                            excludedIds = new Set();
                            syncUrlExclusions();
                        }}
                    >
                        Restore all
                    </Button>
                </div>
            {/if}

            <!-- Collection sections -->
            {#each filteredCollections as group (group.id)}
                <CollectionSection
                    {group}
                    {warningsByProject}
                    {conflictProjectIds}
                    loader={data.context.loader}
                    {viewMode}
                    onExclude={toggleExclude}
                    {excludedIds}
                />
            {/each}

            <!-- Dependencies section -->
            {#if filteredDependencies.length > 0}
                <DependenciesSection
                    dependencies={filteredDependencies}
                    projectTitleMap={data.projectTitleMap}
                    {warningsByProject}
                    {conflictProjectIds}
                    loader={data.context.loader}
                    {viewMode}
                    onExclude={toggleExclude}
                    {excludedIds}
                />
            {/if}

            <!-- No mods resolved at all -->
            {#if hasNoResolvedMods}
                <div transition:fade={{ duration: 150 }}>
                    <Empty.Root>
                        <Empty.Header>
                            <Empty.Media>
                                <PackageXIcon class="size-12 text-muted-foreground" />
                            </Empty.Media>
                            <Empty.Title>No compatible mods found</Empty.Title>
                            <Empty.Description>
                                None of the mods in these collections have versions compatible with
                                Minecraft {data.context.gameVersion} on {getLoaderDisplayName(
                                    data.context.loader
                                )}.
                            </Empty.Description>
                        </Empty.Header>
                        <Empty.Content>
                            <Button variant="outline" href="/">
                                <ArrowLeftIcon class="mr-1.5 size-3.5" />
                                Try different settings
                            </Button>
                        </Empty.Content>
                    </Empty.Root>
                </div>
            {/if}

            <!-- Filter empty state -->
            {#if isFilterEmpty}
                <div transition:fade={{ duration: 150 }}>
                    <Empty.Root>
                        <Empty.Header>
                            <Empty.Media>
                                <SearchXIcon class="size-12 text-muted-foreground" />
                            </Empty.Media>
                            <Empty.Title>No mods match your filters</Empty.Title>
                        </Empty.Header>
                        <Empty.Content>
                            <Button
                                variant="outline"
                                onclick={() => {
                                    searchQuery = '';
                                    sideFilter = 'all';
                                    statusFilter = 'all';
                                }}
                            >
                                Clear filters
                            </Button>
                        </Empty.Content>
                    </Empty.Root>
                </div>
            {/if}
        </div>
    {/if}
</div>
