<script lang="ts">
    import type { PageData } from './$types';
    import type { ResolvedProject } from '$lib/services/types';
    import {
        computeAutoResolution,
        getUserActionableConflicts,
        getMissingDeps,
        getResolutionState,
        computeSideStats,
        buildCollectionNameMap,
        buildIconMap,
        getCollectionProjectIds,
        buildWarningsMap,
        getConflictProjectIds
    } from '$lib/services/review-resolution';
    import MetaTags from '$lib/components/MetaTags.svelte';
    import SummaryBar from '$lib/components/review/SummaryBar.svelte';
    import SharePanel from '$lib/components/review/SharePanel.svelte';
    import ResolutionHero from '$lib/components/review/ResolutionHero.svelte';
    import ResolutionDetails from '$lib/components/review/ResolutionDetails.svelte';
    import ModListSection from '$lib/components/review/ModListSection.svelte';
    import ModDetailSheet from '$lib/components/review/ModDetailSheet.svelte';
    import DownloadBar from '$lib/components/review/DownloadBar.svelte';
    import DownloadProgress from '$lib/components/review/DownloadProgress.svelte';
    import DownloadConfirmation from '$lib/components/review/DownloadConfirmation.svelte';
    import { Button } from '$lib/components/ui/button';
    import { getLoaderDisplayName } from '$lib/utils/format';
    import { buildReviewUrl } from '$lib/utils/url-state';
    import {
        getDownloadState,
        initDownload,
        startDownload,
        cancelDownload,
        resetDownloadFull
    } from '$lib/state/download.svelte';
    import { replaceState } from '$app/navigation';
    import { page } from '$app/stores';
    import { slide } from 'svelte/transition';
    import { safeTransition } from '$lib/utils/motion';
    import * as Empty from '$lib/components/ui/empty';
    import { getCachedData, setCachedData } from '$lib/utils/cache';
    import { CACHE_TTL, STORAGE_KEYS, TOAST_DURATION } from '$lib/config/constants';
    import { toast } from 'svelte-sonner';
    import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
    import InfoIcon from '@lucide/svelte/icons/info';
    import AlertCircleIcon from '@lucide/svelte/icons/circle-alert';
    import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
    import ArchiveRestoreIcon from '@lucide/svelte/icons/archive-restore';
    import { SvelteSet } from 'svelte/reactivity';

    let { data: serverData }: { data: PageData } = $props();

    let cachedFallback = $state<PageData | null>(null);
    let usingCache = $state(false);

    // On transient server errors, try falling back to localStorage cache
    $effect(() => {
        if (serverData.loadError) {
            const cacheKey = STORAGE_KEYS.REVIEW_PREFIX + $page.url.search;
            const cached = getCachedData<PageData>(cacheKey, CACHE_TTL.REVIEW_RESULTS);
            if (cached && !cached.loadError) {
                cachedFallback = cached;
            }
        }
    });

    function loadFromCache() {
        if (cachedFallback) {
            usingCache = true;
        }
    }

    let data = $derived(usingCache && cachedFallback ? cachedFallback : serverData);
    let showLoadError = $derived(!!data.loadError && !usingCache);

    // --- UI-only state ---
    let selectedProject = $state<ResolvedProject | null>(null);
    let sheetOpen = $state(false);
    let shareOpen = $state(false);
    let heroRef = $state<HTMLElement | undefined>(undefined);
    let heroVisible = $state(true);
    let resolutionDetailsDismissed = $state(false);
    let resolutionDetailsRef = $state<HTMLElement | undefined>(undefined);
    let resolutionDetailsTab = $state<string>('action');
    let modListRef = $state<HTMLElement | undefined>(undefined);
    let downloadConfirmOpen = $state(false);
    let pendingDownloadSide = $state<'client' | 'server'>('client');
    let autoSaveTriggered = $state(false);

    let excludedIds = new SvelteSet<string>((() => data.context.excludedProjectIds ?? [])());

    // --- Download state ---
    let dlState = $derived(getDownloadState());
    let isDownloading = $derived(
        dlState.phase !== 'idle' && !(dlState.isMiniProgress && dlState.phase === 'complete')
    );
    let downloadProgress = $derived(
        dlState.overallTotalBytes > 0
            ? Math.round((dlState.overallBytesDownloaded / dlState.overallTotalBytes) * 100)
            : 0
    );

    // Show the full download view (file list + SummaryBar progress) only for non-mini downloads
    let showDownloadView = $derived(isDownloading && !dlState.isMiniProgress);

    // --- Derived from service functions ---
    let warningsByProject = $derived(buildWarningsMap(data.warnings));
    let conflictProjectIds = $derived(getConflictProjectIds(data.conflicts));
    let collectionProjectIds = $derived(getCollectionProjectIds(data.collections));
    let iconMap = $derived(buildIconMap(data.collections, data.dependencies));

    let autoResolution = $derived(
        computeAutoResolution(
            [...data.collections.flatMap((g) => g.resolved), ...data.dependencies],
            data.conflicts,
            collectionProjectIds,
            data.projectTitleMap
        )
    );

    let effectiveExcludedIds = $derived(
        new SvelteSet([...excludedIds, ...autoResolution.autoExcludedIds])
    );

    let userConflicts = $derived(
        getUserActionableConflicts(
            data.conflicts,
            collectionProjectIds,
            data.projectTitleMap,
            iconMap
        )
    );
    let userMissingDeps = $derived(getMissingDeps(data.unresolved, data.projectTitleMap));

    let allProjects = $derived([
        ...data.collections.flatMap((g) => g.resolved),
        ...data.dependencies
    ]);
    let allVisibleProjects = $derived(
        allProjects.filter((p) => !effectiveExcludedIds.has(p.projectId))
    );

    // Display lists: ALL mods (excluded shown dimmed) for browsing
    let displayUserProjects = $derived(allProjects.filter((p) => !p.dependencyOf));
    let displayDeps = $derived(allProjects.filter((p) => !!p.dependencyOf));

    let resolutionState = $derived(
        getResolutionState(
            allVisibleProjects.length,
            userConflicts.filter(
                (c) => !excludedIds.has(c.projectA.id) && !excludedIds.has(c.projectB.id)
            ).length,
            userMissingDeps.length
        )
    );

    let sideStats = $derived(computeSideStats(allVisibleProjects));
    let collectionNameMap = $derived(buildCollectionNameMap(data.collections));

    let collectionModCount = $derived(
        data.collections.reduce((sum, g) => sum + g.resolved.length, 0)
    );
    let depModCount = $derived(data.dependencies.length);
    let unresolvedCount = $derived(data.unresolved.length);
    let resolvedModCount = $derived(collectionModCount + depModCount);
    let trueTotalCount = $derived(resolvedModCount + unresolvedCount);

    let collectionNames = $derived(data.collections.map((g) => g.name).join(', '));
    let pageTitle = $derived(
        `Review: ${collectionNames} — ${trueTotalCount} mods for MC ${data.context.gameVersion} ${getLoaderDisplayName(data.context.loader)}`
    );

    let hasClientMods = $derived(
        allVisibleProjects.some((p) => p.side === 'client' || p.side === 'both')
    );
    let hasServerMods = $derived(
        allVisibleProjects.some((p) => p.side === 'server' || p.side === 'both')
    );

    let serverOnlyCount = $derived(allVisibleProjects.filter((p) => p.side === 'server').length);

    // Active (unresolved) user conflicts — excluding ones where user already chose
    let activeConflictCount = $derived(
        userConflicts.filter(
            (c) => !excludedIds.has(c.projectA.id) && !excludedIds.has(c.projectB.id)
        ).length
    );

    let showDownloadBar = $derived(!heroVisible && dlState.phase === 'idle');

    // --- Auto-save ZIP on download complete ---
    $effect(() => {
        if (dlState.phase === 'complete' && !autoSaveTriggered) {
            autoSaveTriggered = true;
            const side = dlState.targetSide;
            if (side === 'client' && dlState.clientZipBlob) {
                triggerSaveZip('client');
            } else if (side === 'server' && dlState.serverZipBlob) {
                triggerSaveZip('server');
            }
        }
        if (dlState.phase === 'idle') {
            autoSaveTriggered = false;
        }
    });

    // --- Intersection observer for hero ---
    $effect(() => {
        if (!heroRef) return;
        const observer = new IntersectionObserver(
            ([entry]) => {
                heroVisible = entry.isIntersecting;
            },
            { threshold: 0.1 }
        );
        observer.observe(heroRef);
        return () => observer.disconnect();
    });

    // --- Exclusion management ---
    function toggleExclude(projectId: string) {
        if (excludedIds.has(projectId)) {
            excludedIds.delete(projectId);
        } else {
            excludedIds.add(projectId);
        }
        syncUrlExclusions();
    }

    function onExclude(projectId: string) {
        excludedIds.add(projectId);
        syncUrlExclusions();
    }

    function onRestore(projectId: string) {
        excludedIds.delete(projectId);
        syncUrlExclusions();
    }

    function syncUrlExclusions() {
        const currentUrl = new URL($page.url);
        const newUrl = buildReviewUrl(currentUrl, { x: excludedIds });
        // eslint-disable-next-line svelte/no-navigation-without-resolve -- URL state sync for exclusions, not a navigation
        replaceState(newUrl as Parameters<typeof replaceState>[0], {});
    }

    // --- Scroll helpers ---
    function scrollToResolutionDetails(tab?: string) {
        if (tab) resolutionDetailsTab = tab;
        resolutionDetailsRef?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function scrollToModList() {
        modListRef?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // --- Download handlers ---
    function handleStartDownload(side: 'client' | 'server') {
        pendingDownloadSide = side;
        downloadConfirmOpen = true;
    }

    function handleConfirmDownload() {
        downloadConfirmOpen = false;
        autoSaveTriggered = false;
        initDownload(allVisibleProjects, pendingDownloadSide, data.downloadSettings);
        startDownload();
    }

    function handleCancelDownload() {
        cancelDownload();
    }

    function buildFilename(side: string): string {
        return `${collectionNames.replace(/[^a-zA-Z0-9 ]/g, '')}-${side}-${data.context.gameVersion}-${data.context.loader}.zip`;
    }

    function triggerSaveZip(side: 'client' | 'server') {
        try {
            const blob = side === 'client' ? dlState.clientZipBlob : dlState.serverZipBlob;
            if (!blob) return;
            const filename = buildFilename(side);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            const label = side === 'client' ? 'Client mods' : 'Server mods';
            toast.success(`${label} saved`, { duration: TOAST_DURATION.SUCCESS });
        } catch {
            toast.error("Download didn't start. Use the Save ZIP button below.", {
                duration: TOAST_DURATION.ERROR
            });
        }
    }

    function handleSaveClientZip() {
        triggerSaveZip('client');
    }

    function handleSaveServerZip() {
        triggerSaveZip('server');
    }

    function handleRetryDownload() {
        const side = dlState.targetSide;
        if (!side) return;
        autoSaveTriggered = false;
        initDownload(allVisibleProjects, side, data.downloadSettings);
        startDownload();
    }

    function handleDownloadOtherSide(side: 'client' | 'server') {
        autoSaveTriggered = false;
        initDownload(allVisibleProjects, side, data.downloadSettings);
        startDownload();
    }

    function handleBackToReview() {
        resetDownloadFull();
    }

    function handleSelectProject(project: ResolvedProject) {
        selectedProject = project;
        sheetOpen = true;
    }

    // Cache successful resolution results for browser refresh fallback
    $effect(() => {
        if (!serverData.loadError) {
            const searchParams = $page.url.search;
            if (searchParams) {
                setCachedData(STORAGE_KEYS.REVIEW_PREFIX + searchParams, serverData);
            }
        }
    });

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
    title={showLoadError ? "Error — Ariadne's Thread" : pageTitle}
    description="Review and download {trueTotalCount} mods from {collectionNames} for Minecraft {data
        .context.gameVersion} on {data.context.loader}"
    path="/review"
/>

{#if showLoadError}
    <div class="flex min-h-[60vh] items-center justify-center px-4">
        <Empty.Root class="border-none">
            <Empty.Header>
                <Empty.Media>
                    <AlertCircleIcon class="size-16 text-muted-foreground" />
                </Empty.Media>
                <Empty.Title class="text-2xl font-bold tracking-tight">Failed to load</Empty.Title>
                <Empty.Description class="max-w-md text-base">
                    {data.loadError}
                </Empty.Description>
            </Empty.Header>
            <Empty.Content>
                <div class="flex flex-col items-center gap-3">
                    {#if cachedFallback}
                        <p class="text-sm text-muted-foreground">
                            A recently cached version of these results is available.
                        </p>
                    {/if}
                    <div class="flex gap-3">
                        {#if cachedFallback}
                            <Button onclick={loadFromCache}>
                                <ArchiveRestoreIcon class="mr-2 size-4" />
                                Load cached results
                            </Button>
                        {/if}
                        <Button variant="outline" onclick={() => location.reload()}>
                            <RefreshCwIcon class="mr-2 size-4" />
                            Try again
                        </Button>
                        <Button variant="ghost" href="/">
                            <ArrowLeftIcon class="mr-2 size-4" />
                            Back to home
                        </Button>
                    </div>
                </div>
            </Empty.Content>
        </Empty.Root>
    </div>
{:else}
    <div class="min-h-screen">
        {#if usingCache}
            <div
                class="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
            >
                Viewing cached results. <Button
                    variant="link"
                    class="p-0"
                    onclick={() => location.reload()}>Reload</Button
                > to fetch fresh data.
            </div>
        {/if}

        <SummaryBar
            {collectionModCount}
            {depModCount}
            issueCount={activeConflictCount + userMissingDeps.length + data.warnings.length}
            context={data.context}
            downloadPhase={dlState.phase}
            {downloadProgress}
            downloadSpeed={dlState.speedBytesPerSec}
            downloadEta={dlState.eta}
            isMiniProgress={dlState.isMiniProgress}
            onCancelDownload={handleCancelDownload}
            onShare={() => (shareOpen = true)}
            onClickMods={() => scrollToModList()}
            onClickIssues={() => scrollToResolutionDetails('action')}
        />

        <SharePanel
            bind:open={shareOpen}
            pageUrl={$page.url.toString()}
            {collectionNames}
            context={{
                gameVersion: data.context.gameVersion,
                loader: data.context.loader,
                modCount: trueTotalCount
            }}
            emailEnabled={data.emailEnabled}
            turnstileSiteKey={data.turnstileSiteKey}
        />

        {#if showDownloadView}
            <div class="mx-auto max-w-7xl space-y-4 px-4 py-4">
                <DownloadProgress
                    state={dlState}
                    onCancel={handleCancelDownload}
                    onSaveClient={handleSaveClientZip}
                    onSaveServer={handleSaveServerZip}
                    onBackToReview={handleBackToReview}
                    onRetry={handleRetryDownload}
                    onDownloadOtherSide={dlState.targetSide === 'client' && hasServerMods
                        ? handleDownloadOtherSide
                        : dlState.targetSide === 'server' && hasClientMods
                          ? handleDownloadOtherSide
                          : undefined}
                    onShare={() => (shareOpen = true)}
                    shareUrl={$page.url.toString()}
                />
            </div>
        {:else}
            <div class="mx-auto max-w-7xl space-y-6 px-4 py-6">
                <!-- Completion card shown inline when not in full download view -->
                {#if dlState.phase === 'complete' || (dlState.isMiniProgress && dlState.phase !== 'idle')}
                    <DownloadProgress
                        state={dlState}
                        onCancel={handleCancelDownload}
                        onSaveClient={handleSaveClientZip}
                        onSaveServer={handleSaveServerZip}
                        onBackToReview={handleBackToReview}
                        onRetry={handleRetryDownload}
                        onDownloadOtherSide={dlState.targetSide === 'client' && hasServerMods
                            ? handleDownloadOtherSide
                            : dlState.targetSide === 'server' && hasClientMods
                              ? handleDownloadOtherSide
                              : undefined}
                        onShare={() => (shareOpen = true)}
                        shareUrl={$page.url.toString()}
                    />
                {/if}

                <!-- Back link -->
                <Button variant="ghost" size="sm" href="/">
                    <ArrowLeftIcon class="mr-1.5 size-3.5" />
                    Back to Collections
                </Button>

                <!-- Resolution Hero -->
                <div bind:this={heroRef}>
                    <ResolutionHero
                        {resolutionState}
                        {collectionModCount}
                        dependencyCount={depModCount}
                        {unresolvedCount}
                        gameVersion={data.context.gameVersion}
                        loader={data.context.loader}
                        {sideStats}
                        {hasClientMods}
                        {hasServerMods}
                        {collectionNames}
                        onStartDownload={handleStartDownload}
                    />
                </div>

                <!-- Resolution details (consolidated auto-resolved + action required) -->
                {#if autoResolution.items.length > 0 || activeConflictCount > 0 || userMissingDeps.length > 0}
                    {#if resolutionDetailsDismissed}
                        <div transition:slide={safeTransition({ duration: 200 })}>
                            <Button
                                variant="secondary"
                                size="sm"
                                class="text-xs text-muted-foreground"
                                onclick={() => (resolutionDetailsDismissed = false)}
                            >
                                <InfoIcon class="mr-1.5 size-3.5" />
                                Show mod dependency details
                            </Button>
                        </div>
                    {:else}
                        <div
                            bind:this={resolutionDetailsRef}
                            transition:slide={safeTransition({ duration: 200 })}
                        >
                            <ResolutionDetails
                                autoResolvedItems={autoResolution.items}
                                conflicts={userConflicts}
                                missingDeps={userMissingDeps}
                                unresolvedRaw={data.unresolved}
                                excludedIds={effectiveExcludedIds}
                                {onExclude}
                                {onRestore}
                                onDismiss={() => (resolutionDetailsDismissed = true)}
                                loader={data.context.loader}
                                bind:activeTab={resolutionDetailsTab}
                            />
                        </div>
                    {/if}
                {/if}

                <!-- Mod list -->
                <div bind:this={modListRef}>
                    <ModListSection
                        projects={displayUserProjects}
                        dependencies={displayDeps}
                        projectTitleMap={data.projectTitleMap}
                        {warningsByProject}
                        {conflictProjectIds}
                        loader={data.context.loader}
                        excludedIds={effectiveExcludedIds}
                        onExclude={toggleExclude}
                        collectionNames={collectionNameMap}
                        showCollectionNames={data.collections.length > 1}
                        onSelectProject={handleSelectProject}
                    />
                </div>
            </div>

            <!-- Detail sheet -->
            <ModDetailSheet
                bind:open={sheetOpen}
                project={selectedProject}
                warnings={selectedProject
                    ? (warningsByProject.get(selectedProject.projectId) ?? [])
                    : []}
                isExcluded={selectedProject
                    ? effectiveExcludedIds.has(selectedProject.projectId)
                    : false}
                loader={data.context.loader}
                resolvedDependencies={(() => {
                    const sel = selectedProject;
                    return sel
                        ? allProjects
                              .filter((p) => p.dependencyOf === sel.projectId)
                              .map((p) => ({ title: p.projectTitle, iconUrl: p.iconUrl }))
                        : [];
                })()}
                onExclude={toggleExclude}
                onClose={() => {
                    sheetOpen = false;
                    selectedProject = null;
                }}
            />

            <!-- Sticky download bar -->
            <DownloadBar
                visible={showDownloadBar}
                {sideStats}
                {hasClientMods}
                {hasServerMods}
                {unresolvedCount}
                onStartDownload={handleStartDownload}
            />

            <!-- Download confirmation -->
            <DownloadConfirmation
                bind:open={downloadConfirmOpen}
                side={pendingDownloadSide}
                projects={allVisibleProjects}
                {serverOnlyCount}
                onConfirm={handleConfirmDownload}
                onClose={() => (downloadConfirmOpen = false)}
            />
        {/if}
    </div>
{/if}
