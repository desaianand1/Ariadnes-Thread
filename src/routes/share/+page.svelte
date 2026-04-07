<script lang="ts">
    import type { PageData } from './$types';
    import type {
        ResolvedProject,
        CollectionGroup,
        ConflictEntry,
        ResolutionWarning,
        UnresolvedDependency,
        ResolutionStats
    } from '$lib/services/types';
    import type { BatchResult } from '$lib/services/resolution.server';
    import {
        computeAutoResolution,
        computeSideStats,
        buildCollectionNameMap,
        buildWarningsMap,
        getConflictProjectIds,
        getCollectionProjectIds,
        computeCategorySummary
    } from '$lib/services/review-resolution';
    import MetaTags from '$lib/components/MetaTags.svelte';
    import SummaryBar from '$lib/components/review/SummaryBar.svelte';
    import ShareHero from '$lib/components/review/ShareHero.svelte';
    import LauncherCardGrid from '$lib/components/review/LauncherCardGrid.svelte';
    import ModListSection from '$lib/components/review/ModListSection.svelte';
    import ModDetailSheet from '$lib/components/review/ModDetailSheet.svelte';
    import DownloadProgress from '$lib/components/review/DownloadProgress.svelte';
    import { MultiStepLoader, type StepStatus } from '$lib/components/ui/multi-step-loader';
    import { Button } from '$lib/components/ui/button';
    import * as Empty from '$lib/components/ui/empty';
    import {
        getDownloadState,
        initDownload,
        startDownload,
        cancelDownload,
        resetDownloadFull,
        isStaleSession
    } from '$lib/state/download.svelte';
    import { goto } from '$app/navigation';
    import { resolve } from '$app/paths';
    import { toast } from 'svelte-sonner';
    import { TOAST_DURATION } from '$lib/config/constants';
    import AlertCircleIcon from '@lucide/svelte/icons/circle-alert';
    import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
    import PackageIcon from '@lucide/svelte/icons/package';
    import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
    import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
    import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
    import { browser } from '$app/environment';
    import { untrack } from 'svelte';
    import { SvelteSet } from 'svelte/reactivity';
    import { fade, slide } from 'svelte/transition';
    import { safeTransition } from '$lib/utils/motion';
    import { SEMANTIC_BANNER_COLORS } from '$lib/utils/colors';

    let { data: serverData }: { data: PageData } = $props();

    // Large load state
    const EMPTY_PAGE_DATA = {
        loadError: undefined as string | undefined,
        collections: [] as CollectionGroup[],
        dependencies: [] as ResolvedProject[],
        conflicts: [] as ConflictEntry[],
        warnings: [] as ResolutionWarning[],
        unresolved: [] as UnresolvedDependency[],
        stats: {
            totalProjects: 0,
            resolvedCount: 0,
            unresolvedCount: 0,
            dependencyCount: 0,
            conflictCount: 0,
            warningCount: 0,
            totalDownloadSize: 0
        } satisfies ResolutionStats,
        projectTitleMap: {} as Record<string, string>,
        unresolvedMetadata: {} as Record<
            string,
            { updated: string; description: string; projectType?: string }
        >
    };

    interface NormalizedPageData {
        loadError: string | undefined;
        collections: CollectionGroup[];
        dependencies: ResolvedProject[];
        conflicts: ConflictEntry[];
        warnings: ResolutionWarning[];
        unresolved: UnresolvedDependency[];
        stats: ResolutionStats;
        projectTitleMap: Record<string, string>;
        unresolvedMetadata: Record<
            string,
            { updated: string; description: string; projectType?: string }
        >;
        context: {
            loadId: string;
            gameVersion: string;
            loader: string;
            collectionIds: string[];
            excludedProjectIds: string[];
        };
        downloadSettings: { concurrentDownloads: number; retryCount: number };
        initialViewMode: 'simple' | 'detailed';
        emailEnabled: boolean;
        turnstileSiteKey: string;
    }

    type ResolvedPageData = {
        collections: CollectionGroup[];
        dependencies: ResolvedProject[];
        conflicts: ConflictEntry[];
        warnings: ResolutionWarning[];
        unresolved: UnresolvedDependency[];
        stats: ResolutionStats;
        projectTitleMap: Record<string, string>;
        unresolvedMetadata: Record<
            string,
            { updated: string; description: string; projectType?: string }
        >;
    };

    let resolvedLargeData = $state<ResolvedPageData | null>(null);
    let largeLoadStep = $state(0);
    let largeLoadStatuses = $state<StepStatus[]>([]);
    let largeLoadError = $state(false);
    let largeLoadStatusMessage = $state<string | undefined>(undefined);
    let loadGeneration = 0;

    // Track batch progress for large loads
    $effect(() => {
        if (!serverData.isLargeLoad) return;

        const gen = ++loadGeneration;

        resolvedLargeData = null;
        largeLoadError = false;
        largeLoadStatusMessage = undefined;

        const steps = serverData.loadSteps;
        largeLoadStatuses = steps.map((_, i) => {
            if (i === 0) return 'complete' as StepStatus;
            if (i === 1) return 'loading' as StepStatus;
            return 'pending' as StepStatus;
        });
        largeLoadStep = 1;

        let rateLimitTimer: ReturnType<typeof setTimeout> | undefined;
        function startRateLimitTimer() {
            clearTimeout(rateLimitTimer);
            rateLimitTimer = setTimeout(() => {
                if (gen !== loadGeneration) return;
                largeLoadStatusMessage = 'Waiting for Modrinth — too many requests at once';
            }, 3000);
        }
        startRateLimitTimer();

        serverData.batchProgress.forEach((batchPromise: Promise<BatchResult>, i: number) => {
            const stepIndex = i + 1;
            batchPromise
                .then(() => {
                    if (gen !== loadGeneration) return;
                    largeLoadStatuses[stepIndex] = 'complete';
                    largeLoadStatusMessage = undefined;
                    const next = stepIndex + 1;
                    if (next < steps.length) {
                        largeLoadStep = next;
                        largeLoadStatuses[next] = 'loading';
                        startRateLimitTimer();
                    }
                })
                .catch(() => {
                    if (gen !== loadGeneration) return;
                    largeLoadStatuses[stepIndex] = 'error';
                    largeLoadStatusMessage = undefined;
                    largeLoadError = true;
                });
        });

        const depsStepIndex = serverData.batchProgress.length + 1;
        serverData.resolutionData
            .then((result: ResolvedPageData) => {
                if (gen !== loadGeneration) return;
                resolvedLargeData = result;
                largeLoadStatuses[depsStepIndex] = 'complete';
                largeLoadStatusMessage = undefined;
                // Mark advisor step complete (skipped for share)
                const advisorStep = steps.length - 1;
                largeLoadStatuses[advisorStep] = 'complete';
                clearTimeout(rateLimitTimer);
            })
            .catch(() => {
                if (gen !== loadGeneration) return;
                largeLoadStatuses[depsStepIndex] = 'error';
                largeLoadError = true;
            });

        return () => {
            clearTimeout(rateLimitTimer);
        };
    });

    let data: NormalizedPageData = $derived.by(() => {
        if (serverData.isLargeLoad) {
            const resolved = resolvedLargeData ?? EMPTY_PAGE_DATA;
            return {
                ...serverData,
                ...resolved,
                loadError: undefined
            } as NormalizedPageData;
        }
        return serverData as NormalizedPageData;
    });

    let showLoadError = $derived(!serverData.isLargeLoad && !!data.loadError);

    // --- UI-only state ---
    let selectedProject = $state<ResolvedProject | null>(null);
    let sheetOpen = $state(false);
    let modListExpanded = $state(false);
    let autoSaveTriggered = $state(false);
    let preselectedLauncher = $state<string | undefined>(undefined);

    // --- Download state ---
    let sessionKey = $derived(data.context.loadId);

    $effect(() => {
        const key = sessionKey;
        untrack(() => {
            if (isStaleSession(key)) {
                resetDownloadFull();
            }
        });
    });

    let dlState = $derived(getDownloadState());
    let isDownloading = $derived(
        dlState.phase !== 'idle' && !(dlState.isMiniProgress && dlState.phase === 'complete')
    );
    let downloadProgress = $derived(
        dlState.overallTotalBytes > 0
            ? Math.round((dlState.overallBytesDownloaded / dlState.overallTotalBytes) * 100)
            : 0
    );

    // --- Derived data ---
    let warningsByProject = $derived(buildWarningsMap(data.warnings));
    let conflictProjectIds = $derived(getConflictProjectIds(data.conflicts));
    let collectionProjectIds = $derived(getCollectionProjectIds(data.collections));

    let autoResolution = $derived(
        computeAutoResolution(
            [...data.collections.flatMap((g) => g.resolved), ...data.dependencies],
            data.conflicts,
            collectionProjectIds,
            data.projectTitleMap,
            data.context.gameVersion,
            data.context.loader
        )
    );

    let effectiveExcludedIds = $derived(
        new SvelteSet([
            ...(data.context.excludedProjectIds ?? []),
            ...autoResolution.autoExcludedIds
        ])
    );

    let allProjects = $derived([
        ...data.collections.flatMap((g) => g.resolved),
        ...data.dependencies
    ]);
    let allVisibleProjects = $derived(
        allProjects.filter((p) => !effectiveExcludedIds.has(p.projectId))
    );

    let displayUserProjects = $derived(allProjects.filter((p) => !p.dependencyOf));
    let displayDeps = $derived(allProjects.filter((p) => !!p.dependencyOf));

    let sideStats = $derived(computeSideStats(allVisibleProjects));
    let collectionNameMap = $derived(buildCollectionNameMap(data.collections));

    let collectionModCount = $derived(
        data.collections.reduce((sum, g) => sum + g.resolved.length, 0)
    );
    let depModCount = $derived(data.dependencies.length);
    let unavailableCount = $derived(
        data.unresolved.filter((u) => !effectiveExcludedIds.has(u.projectId)).length
    );
    let resolvedModCount = $derived(collectionModCount + depModCount);

    let collectionNames = $derived(data.collections.map((g) => g.name).join(', '));

    let categorySummary = $derived(computeCategorySummary(allVisibleProjects));

    let hasClientMods = $derived(
        allVisibleProjects.some((p) => p.side === 'client' || p.side === 'both')
    );

    // --- Meta tags ---
    let metaTitle = $derived(
        serverData.curatorName
            ? `${serverData.curatorName}'s mods for MC ${data.context.gameVersion}`
            : `Minecraft mods for ${data.context.gameVersion}`
    );
    let categorySummaryText = $derived(
        categorySummary.map((c) => `${c.count} ${c.category.toLowerCase()}`).join(', ')
    );
    let metaDescription = $derived(
        `${resolvedModCount} mods ready to download${categorySummaryText ? ` — ${categorySummaryText}` : ''}`
    );

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

    // --- Download handlers ---
    function handleLauncherDownload(launcherId: string) {
        preselectedLauncher = launcherId;
        autoSaveTriggered = false;
        // Skip confirmation — start download immediately for client mods
        initDownload(allVisibleProjects, 'client', {
            ...data.downloadSettings,
            sessionKey
        });
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
        initDownload(allVisibleProjects, side, { ...data.downloadSettings, sessionKey });
        startDownload();
    }

    function handleBackToReview() {
        resetDownloadFull();
    }

    function handleSelectProject(project: ResolvedProject) {
        selectedProject = project;
        sheetOpen = true;
    }

    function handleCancelLargeLoad() {
        goto(resolve('/'));
    }

    let curatorLabel = $derived(serverData.curatorName || 'the person who shared this');

    // Prevent accidental navigation during download
    $effect(() => {
        if (browser && isDownloading) {
            const handler = (e: BeforeUnloadEvent) => {
                e.preventDefault();
            };
            window.addEventListener('beforeunload', handler);
            return () => window.removeEventListener('beforeunload', handler);
        }
    });
</script>

<MetaTags title={metaTitle} description={metaDescription} path="/share" />

<!-- Large load overlay -->
{#if serverData.isLargeLoad && !resolvedLargeData && !largeLoadError}
    <MultiStepLoader
        states={serverData.loadSteps}
        loading={true}
        currentStep={largeLoadStep}
        stepStatuses={largeLoadStatuses}
        showProgress
        title="Loading mods..."
        description="Checking compatibility for your configuration."
        statusMessage={largeLoadStatusMessage}
        onCancel={handleCancelLargeLoad}
    />
{/if}

<!-- Large load error -->
{#if serverData.isLargeLoad && largeLoadError && !resolvedLargeData}
    <div class="mx-auto flex max-w-7xl flex-col items-center justify-center gap-4 px-4 py-20">
        <AlertCircleIcon class="size-12 text-destructive" />
        <h2 class="text-lg font-semibold">Something went wrong loading these mods</h2>
        <p class="text-center text-sm text-muted-foreground">
            Ask {curatorLabel} to check the link.
        </p>
        <Button onclick={() => location.reload()}>
            <RefreshCwIcon class="mr-1.5 size-3.5" />
            Try again
        </Button>
    </div>
{/if}

<!-- Error state -->
{#if showLoadError}
    <div class="mx-auto flex max-w-7xl flex-col items-center justify-center gap-4 px-4 py-20">
        <AlertCircleIcon class="size-12 text-destructive" />
        <h2 class="text-lg font-semibold">Something went wrong loading these mods</h2>
        <p class="text-center text-sm text-muted-foreground">
            Ask {curatorLabel} to check the link.
        </p>
        <Button onclick={() => location.reload()}>
            <RefreshCwIcon class="mr-1.5 size-3.5" />
            Try again
        </Button>
    </div>
{/if}

<!-- Main content -->
{#if !showLoadError && !(serverData.isLargeLoad && !resolvedLargeData)}
    <!-- Summary bar — simplified for share page (no issues pill, no share button) -->
    <SummaryBar
        {resolvedModCount}
        {unavailableCount}
        context={{ gameVersion: data.context.gameVersion, loader: data.context.loader }}
        downloadPhase={dlState.phase}
        {downloadProgress}
        downloadSpeed={dlState.speedBytesPerSec}
        downloadEta={dlState.eta}
        isMiniProgress={dlState.isMiniProgress}
        onCancelDownload={handleCancelDownload}
    />

    <div class="mx-auto max-w-7xl px-4 py-8">
        {#if isDownloading || dlState.phase === 'complete'}
            <!-- Download progress view -->
            <div in:fade={safeTransition({ duration: 150 })}>
                <DownloadProgress
                    state={dlState}
                    onCancel={handleCancelDownload}
                    onSaveClient={handleSaveClientZip}
                    onSaveServer={handleSaveServerZip}
                    onBackToReview={handleBackToReview}
                    onRetry={handleRetryDownload}
                    {preselectedLauncher}
                    hideOtherSideDownload
                />
            </div>
        {:else if resolvedModCount === 0}
            <!-- Empty state -->
            <Empty.Root class="py-20 text-muted-foreground">
                <Empty.Header>
                    <Empty.Media variant="icon">
                        <PackageIcon class="text-muted-foreground" />
                    </Empty.Media>
                    <Empty.Title>No Mods Found</Empty.Title>
                    <Empty.Description>
                        No compatible mods were found for this configuration. Ask {curatorLabel} to check
                        the link.
                    </Empty.Description>
                </Empty.Header>
            </Empty.Root>
        {:else}
            <!-- Share hero -->
            <div class="space-y-8" out:fade={safeTransition({ duration: 150 })}>
                <ShareHero
                    curatorName={serverData.curatorName}
                    {collectionNames}
                    gameVersion={data.context.gameVersion}
                    loader={data.context.loader}
                    modCount={resolvedModCount}
                    totalSize={sideStats.total.downloadSize}
                    {categorySummary}
                    {unavailableCount}
                />

                <!-- Launcher cards / server-only message -->
                {#if hasClientMods}
                    <LauncherCardGrid onDownload={handleLauncherDownload} />
                {:else}
                    <div
                        class="rounded-md border px-4 py-5 text-center {SEMANTIC_BANNER_COLORS
                            .success.bg} {SEMANTIC_BANNER_COLORS.success.border}"
                    >
                        <CircleCheckIcon
                            class="mx-auto mb-3 size-8 {SEMANTIC_BANNER_COLORS.success.text}"
                        />
                        <h3 class="text-base font-semibold {SEMANTIC_BANNER_COLORS.success.text}">
                            You're all set — no download needed!
                        </h3>
                        <p class="mt-1.5 text-sm text-muted-foreground">
                            These mods run on the server side only. {curatorLabel} has already set everything
                            up — just join the server and play.
                        </p>
                    </div>
                {/if}

                <!-- Collapsible mod list -->
                <div>
                    {#if !modListExpanded}
                        <div out:fade={safeTransition({ duration: 100 })}>
                            <Button
                                variant="ghost"
                                class="w-full justify-between text-muted-foreground"
                                onclick={() => (modListExpanded = true)}
                            >
                                <span class="flex items-center gap-2">
                                    <PackageIcon class="size-4" />
                                    View all {resolvedModCount} mods
                                </span>
                                <ChevronRightIcon class="size-4" />
                            </Button>
                        </div>
                    {:else}
                        <div transition:slide={safeTransition({ duration: 200 })}>
                            <Button
                                variant="ghost"
                                class="mb-3 w-full justify-between text-muted-foreground"
                                onclick={() => (modListExpanded = false)}
                            >
                                <span class="flex items-center gap-2">
                                    <PackageIcon class="size-4" />
                                    Collapse mod list
                                </span>
                                <ChevronDownIcon class="size-4" />
                            </Button>
                            <ModListSection
                                projects={displayUserProjects}
                                dependencies={displayDeps}
                                projectTitleMap={data.projectTitleMap}
                                {warningsByProject}
                                {conflictProjectIds}
                                loader={data.context.loader}
                                excludedIds={effectiveExcludedIds}
                                collectionNames={collectionNameMap}
                                showCollectionNames={data.collections.length > 1}
                                onSelectProject={handleSelectProject}
                                collections={data.collections}
                            />
                        </div>
                    {/if}
                </div>
            </div>
        {/if}
    </div>

    <!-- Mod detail sheet (read-only) -->
    <ModDetailSheet
        bind:open={sheetOpen}
        project={selectedProject}
        warnings={selectedProject ? (warningsByProject.get(selectedProject.projectId) ?? []) : []}
        isExcluded={selectedProject ? effectiveExcludedIds.has(selectedProject.projectId) : false}
        loader={data.context.loader}
        onClose={() => (sheetOpen = false)}
    />
{/if}
