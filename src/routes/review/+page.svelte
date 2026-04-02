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
        resetDownload
    } from '$lib/state/download.svelte';
    import { replaceState } from '$app/navigation';
    import { page } from '$app/stores';
    import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
    import { SvelteSet } from 'svelte/reactivity';

    let { data }: { data: PageData } = $props();

    // --- UI-only state ---
    let selectedProject = $state<ResolvedProject | null>(null);
    let sheetOpen = $state(false);
    let shareOpen = $state(false);
    let heroRef = $state<HTMLElement | undefined>(undefined);
    let heroVisible = $state(true);
    let downloadOverride = $state(false);
    let resolutionDetailsRef = $state<HTMLElement | undefined>(undefined);
    let resolutionDetailsTab = $state<string>('action');
    let modListRef = $state<HTMLElement | undefined>(undefined);
    let downloadConfirmOpen = $state(false);
    let pendingDownloadSide = $state<'client' | 'server'>('client');

    let excludedIds = new SvelteSet<string>(data.context.excludedProjectIds ?? []);

    // --- Download state ---
    let dlState = $derived(getDownloadState());
    let isDownloading = $derived(dlState.phase !== 'idle');
    let downloadProgress = $derived(
        dlState.overallTotalBytes > 0
            ? Math.round((dlState.overallBytesDownloaded / dlState.overallTotalBytes) * 100)
            : 0
    );

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

    let visibleUserProjects = $derived(allVisibleProjects.filter((p) => !p.dependencyOf));
    let visibleDeps = $derived(allVisibleProjects.filter((p) => !!p.dependencyOf));

    let resolutionState = $derived(
        downloadOverride
            ? ('allClear' as const)
            : getResolutionState(
                  allVisibleProjects.length,
                  userConflicts.filter(
                      (c) => !excludedIds.has(c.projectA.id) && !excludedIds.has(c.projectB.id)
                  ).length,
                  userMissingDeps.length
              )
    );

    let sideStats = $derived(computeSideStats(allVisibleProjects));
    let collectionNameMap = $derived(buildCollectionNameMap(data.collections));

    let resolvedModCount = $derived(
        data.collections.reduce((sum, g) => sum + g.resolved.length, 0) + data.dependencies.length
    );
    let trueTotalCount = $derived(resolvedModCount + data.unresolved.length);

    let collectionNames = $derived(data.collections.map((g) => g.name).join(', '));
    let pageTitle = $derived(
        `Review: ${collectionNames} — ${trueTotalCount} mods for MC ${data.context.gameVersion} ${getLoaderDisplayName(data.context.loader)}`
    );

    let effectiveStats = $derived.by(() => ({
        ...data.stats,
        resolvedCount: allVisibleProjects.length,
        totalDownloadSize: allVisibleProjects.reduce((sum, r) => sum + r.fileSize, 0)
    }));

    let hasClientMods = $derived(
        allVisibleProjects.some((p) => p.side === 'client' || p.side === 'both')
    );
    let hasServerMods = $derived(
        allVisibleProjects.some((p) => p.side === 'server' || p.side === 'both')
    );

    // Active (unresolved) user conflicts — excluding ones where user already chose
    let activeConflictCount = $derived(
        userConflicts.filter(
            (c) => !excludedIds.has(c.projectA.id) && !excludedIds.has(c.projectB.id)
        ).length
    );

    let showDownloadBar = $derived(!heroVisible && dlState.phase === 'idle');

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
        initDownload(allVisibleProjects, pendingDownloadSide, data.downloadSettings);
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
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function handleRetryDownload() {
        const side = dlState.targetSide;
        if (!side) return;
        initDownload(allVisibleProjects, side, data.downloadSettings);
        startDownload();
    }

    function handleDownloadOtherSide(side: 'client' | 'server') {
        initDownload(allVisibleProjects, side, data.downloadSettings);
        startDownload();
    }

    function handleBackToReview() {
        resetDownload();
    }

    function handleDownloadAnyway() {
        downloadOverride = true;
        // Scroll hero into view so the user sees the now-green download buttons
        requestAnimationFrame(() => {
            heroRef?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }

    function handleSelectProject(project: ResolvedProject) {
        selectedProject = project;
        sheetOpen = true;
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
    description="Review and download {trueTotalCount} mods from {collectionNames} for Minecraft {data
        .context.gameVersion} on {data.context.loader}"
    path="/review"
/>

<div class="min-h-screen">
    <SummaryBar
        stats={effectiveStats}
        context={data.context}
        downloadPhase={dlState.phase}
        {downloadProgress}
        downloadSpeed={dlState.speedBytesPerSec}
        downloadEta={dlState.eta}
        onCancelDownload={handleCancelDownload}
        onShare={() => (shareOpen = true)}
        onClickCompatible={() => scrollToModList()}
        onClickWarnings={() => scrollToResolutionDetails('auto')}
        onClickConflicts={() => scrollToResolutionDetails('action')}
        onClickMissing={() => scrollToResolutionDetails('action')}
    />

    <SharePanel
        bind:open={shareOpen}
        pageUrl={$page.url.toString()}
        {collectionNames}
        emailEnabled={data.emailEnabled}
        turnstileSiteKey={data.turnstileSiteKey}
    />

    {#if isDownloading}
        <div class="mx-auto max-w-7xl space-y-4 px-4 py-4">
            <DownloadProgress
                state={dlState}
                onCancel={handleCancelDownload}
                onSave={handleSaveZip}
                onBackToReview={handleBackToReview}
                onRetry={handleRetryDownload}
                onDownloadOtherSide={dlState.targetSide === 'client' && hasServerMods
                    ? handleDownloadOtherSide
                    : dlState.targetSide === 'server' && hasClientMods
                      ? handleDownloadOtherSide
                      : undefined}
            />
        </div>
    {:else}
        <div class="mx-auto max-w-7xl space-y-6 px-4 py-6">
            <!-- Back link -->
            <Button variant="ghost" size="sm" href="/">
                <ArrowLeftIcon class="mr-1.5 size-3.5" />
                Back to Collections
            </Button>

            <!-- Resolution Hero -->
            <div bind:this={heroRef}>
                <ResolutionHero
                    {resolutionState}
                    totalResolved={allVisibleProjects.length}
                    totalProjects={trueTotalCount}
                    gameVersion={data.context.gameVersion}
                    loader={data.context.loader}
                    {sideStats}
                    {hasClientMods}
                    {hasServerMods}
                    {collectionNames}
                    onStartDownload={handleStartDownload}
                    onShare={() => (shareOpen = true)}
                />
            </div>

            <!-- Resolution details (consolidated auto-resolved + action required) -->
            {#if autoResolution.items.length > 0 || activeConflictCount > 0 || userMissingDeps.length > 0}
                <div bind:this={resolutionDetailsRef}>
                    <ResolutionDetails
                        autoResolvedItems={autoResolution.items}
                        conflicts={userConflicts}
                        missingDeps={userMissingDeps}
                        unresolvedRaw={data.unresolved}
                        excludedIds={effectiveExcludedIds}
                        {onExclude}
                        {onRestore}
                        onDownloadAnyway={handleDownloadAnyway}
                        excludedCount={effectiveExcludedIds.size}
                        bind:activeTab={resolutionDetailsTab}
                    />
                </div>
            {/if}

            <!-- Mod list -->
            <div bind:this={modListRef}>
                <ModListSection
                    projects={visibleUserProjects}
                    dependencies={visibleDeps}
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
            hasUnresolvedIssues={resolutionState === 'hasIssues'}
            onStartDownload={handleStartDownload}
        />

        <!-- Download confirmation -->
        <DownloadConfirmation
            bind:open={downloadConfirmOpen}
            side={pendingDownloadSide}
            projects={allVisibleProjects}
            onConfirm={handleConfirmDownload}
            onClose={() => (downloadConfirmOpen = false)}
        />
    {/if}
</div>
