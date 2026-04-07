<script lang="ts">
    import type { PageData } from './$types';
    import type {
        ResolvedProject,
        AlternativeProbe,
        CollectionGroup,
        ConflictEntry,
        ResolutionWarning,
        UnresolvedDependency,
        ResolutionStats
    } from '$lib/services/types';
    import type { BatchResult } from '$lib/services/resolution.server';
    import type { ViewMode } from '$lib/services/review-resolution';
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
        getConflictProjectIds,
        shouldShowAdvisor,
        getDependentMods
    } from '$lib/services/review-resolution';
    import * as AlertDialog from '$lib/components/ui/alert-dialog';
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
    import { MultiStepLoader, type StepStatus } from '$lib/components/ui/multi-step-loader';
    import { Button } from '$lib/components/ui/button';
    import { getLoaderDisplayName } from '$lib/utils/format';
    import { SEMANTIC_BANNER_COLORS } from '$lib/utils/colors';
    import { cn } from '$lib/utils';
    import { buildReviewUrl, buildAdvisorSwitchUrl } from '$lib/utils/url-state';
    import {
        getDownloadState,
        initDownload,
        startDownload,
        cancelDownload,
        resetDownloadFull,
        isStaleSession
    } from '$lib/state/download.svelte';
    import { replaceState, goto } from '$app/navigation';
    import { resolve } from '$app/paths';
    import { page } from '$app/stores';
    import { slide } from 'svelte/transition';
    import { safeTransition } from '$lib/utils/motion';
    import * as Empty from '$lib/components/ui/empty';
    import { getCachedData, setCachedData } from '$lib/utils/cache';
    import {
        CACHE_TTL,
        STORAGE_KEYS,
        TOAST_DURATION,
        VIEW_MODE_COOKIE
    } from '$lib/config/constants';
    import { toast } from 'svelte-sonner';
    import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
    import AlertCircleIcon from '@lucide/svelte/icons/circle-alert';
    import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
    import ArchiveRestoreIcon from '@lucide/svelte/icons/archive-restore';
    import XIcon from '@lucide/svelte/icons/x';
    import PackageIcon from '@lucide/svelte/icons/package';
    import { browser } from '$app/environment';
    import { untrack } from 'svelte';
    import { SvelteSet } from 'svelte/reactivity';

    let { data: serverData }: { data: PageData } = $props();

    let cachedFallback = $state<PageData | null>(null);
    let usingCache = $state(false);

    // Reset advisor switching state when new data arrives (navigation completed)
    $effect(() => {
        void serverData;
        advisorSwitching = false;
        if (advisorSwitchTimeout) {
            clearTimeout(advisorSwitchTimeout);
            advisorSwitchTimeout = undefined;
        }
    });

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

    // Placeholder for large loads before resolution completes
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

    // Common shape shared by both small and large load paths
    interface NormalizedPageData {
        loadError: string | undefined;
        collections: CollectionGroup[];
        dependencies: ResolvedProject[];
        conflicts: ConflictEntry[];
        warnings: ResolutionWarning[];
        unresolved: UnresolvedDependency[];
        stats: ResolutionStats;
        projectTitleMap: Record<string, string>;
        advisorData: Promise<{
            alternatives: AlternativeProbe[];
            modAvailability: Record<string, import('$lib/services/types').ModAvailability>;
        }>;
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

    // Unified data accessor: for small loads uses serverData directly,
    // for large loads constructs the same shape once resolutionData resolves
    let data: NormalizedPageData = $derived.by(() => {
        if (usingCache && cachedFallback) return cachedFallback as NormalizedPageData;
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
    let showLoadError = $derived(!serverData.isLargeLoad && !!data.loadError && !usingCache);

    // --- UI-only state ---
    let selectedProject = $state<ResolvedProject | null>(null);
    let sheetOpen = $state(false);
    let shareOpen = $state(false);
    let heroRef = $state<HTMLElement | undefined>(undefined);
    let heroVisible = $state(true);
    let resolutionDetailsRef = $state<HTMLElement | undefined>(undefined);
    let resolutionDetailsTab = $state<string>('issues');
    let modListRef = $state<HTMLElement | undefined>(undefined);
    let downloadConfirmOpen = $state(false);
    let pendingDownloadSide = $state<'client' | 'server'>('client');
    let autoSaveTriggered = $state(false);
    let modpackBannerDismissed = $state(false);
    let advisorSwitching = $state(false);
    let advisorSwitchTimeout = $state<ReturnType<typeof setTimeout> | undefined>(undefined);

    // --- Large load state ---
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

        // Reset state for new large load
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

        // Timer-based rate limit message: show after 3s on any loading step
        let rateLimitTimer: ReturnType<typeof setTimeout> | undefined;
        function startRateLimitTimer() {
            clearTimeout(rateLimitTimer);
            rateLimitTimer = setTimeout(() => {
                if (gen !== loadGeneration) return;
                largeLoadStatusMessage = 'Waiting for Modrinth — too many requests at once';
            }, 3000);
        }
        startRateLimitTimer();

        // Track per-batch progress
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

        // Dependencies step — resolves when resolutionData completes
        const depsStepIndex = serverData.batchProgress.length + 1;
        serverData.resolutionData
            .then((result: ResolvedPageData) => {
                if (gen !== loadGeneration) return;
                resolvedLargeData = result;
                largeLoadStatuses[depsStepIndex] = 'complete';
                largeLoadStatusMessage = undefined;
                largeLoadStep = depsStepIndex + 1;
                if (largeLoadStatuses[depsStepIndex + 1] !== undefined) {
                    largeLoadStatuses[depsStepIndex + 1] = 'loading';
                    startRateLimitTimer();
                }
            })
            .catch(() => {
                if (gen !== loadGeneration) return;
                largeLoadStatuses[depsStepIndex] = 'error';
                largeLoadError = true;
            });

        // Advisor step
        serverData.advisorData
            .then(() => {
                if (gen !== loadGeneration) return;
                const advisorStep = steps.length - 1;
                largeLoadStatuses[advisorStep] = 'complete';
                largeLoadStatusMessage = undefined;
                clearTimeout(rateLimitTimer);
            })
            .catch(() => {
                if (gen !== loadGeneration) return;
                clearTimeout(rateLimitTimer);
            });

        return () => {
            clearTimeout(rateLimitTimer);
        };
    });

    // View mode: SSR-safe via cookie, synced from serverData on navigation.
    // handleViewModeChange overrides via cookie + localStorage so subsequent loads pick up the user's choice server-side.
    let viewMode = $state<ViewMode>('detailed');
    $effect(() => {
        const mode = serverData.initialViewMode ?? 'detailed';
        untrack(() => {
            viewMode = mode;
        });
    });

    function handleViewModeChange(mode: ViewMode) {
        viewMode = mode;
        if (browser) {
            document.cookie = `${VIEW_MODE_COOKIE}=${mode};path=/;max-age=${60 * 60 * 24 * 365};SameSite=Lax`;
            localStorage.setItem(STORAGE_KEYS.VIEW_MODE_PREFERENCE, mode);
        }
    }

    let excludedIds = new SvelteSet<string>((() => data.context.excludedProjectIds ?? [])());

    // --- Download state ---
    let sessionKey = $derived(data.context.loadId);

    // Discard stale download state from a previous review session
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
            data.projectTitleMap,
            data.context.gameVersion,
            data.context.loader
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

    let visibleMissingDeps = $derived(
        userMissingDeps.filter((d) => !effectiveExcludedIds.has(d.projectId))
    );
    let resolutionState = $derived(
        getResolutionState(
            allVisibleProjects.length,
            userConflicts.filter(
                (c) => !excludedIds.has(c.projectA.id) && !excludedIds.has(c.projectB.id)
            ).length,
            visibleMissingDeps.length
        )
    );

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
    let trueTotalCount = $derived(resolvedModCount + unavailableCount);

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

    // --- Best Configuration Advisor (streamed) ---
    type AdvisorStatus = 'loading' | 'found' | 'no_improvement' | 'no_issues' | 'error';
    let advisorAlternatives = $state<AlternativeProbe[]>([]);
    let advisorModAvailability = $state<
        Record<string, import('$lib/services/types').ModAvailability>
    >({});
    let advisorLoading = $state(true);
    let advisorStatus = $state<AdvisorStatus>('loading');

    $effect(() => {
        const promise = data.advisorData;
        advisorLoading = true;
        advisorStatus = 'loading';
        advisorAlternatives = [];
        advisorModAvailability = {};

        const hadUnresolved = data.unresolved.length > 0;

        promise
            .then((result) => {
                advisorAlternatives = result.alternatives;
                advisorModAvailability = result.modAvailability;
                advisorLoading = false;

                if (result.alternatives.length > 0) {
                    advisorStatus = 'found';
                } else if (hadUnresolved) {
                    advisorStatus = 'no_improvement';
                } else {
                    advisorStatus = 'no_issues';
                }
            })
            .catch((err) => {
                advisorLoading = false;
                advisorStatus = 'error';
                if (import.meta.env.DEV) {
                    console.error('Advisor failed:', err);
                }
            });
    });

    let bestAlternative = $derived<AlternativeProbe | null>(advisorAlternatives[0] ?? null);
    let showAdvisor = $derived(
        resolutionState !== 'allClear' && shouldShowAdvisor(bestAlternative, trueTotalCount)
    );
    let autoFixedCount = $derived(autoResolution.items.length);

    let advisorSwitchSteps = $derived(
        bestAlternative
            ? [
                  {
                      text: `Switching to MC ${bestAlternative.version} ${getLoaderDisplayName(bestAlternative.loader)}...`
                  }
              ]
            : []
    );

    function handleCancelLargeLoad() {
        goto(resolve('/'));
    }

    function handleAdvisorSwitch() {
        if (!bestAlternative) return;
        advisorSwitching = true;
        advisorSwitchTimeout = setTimeout(() => {
            if (advisorSwitching) {
                advisorSwitching = false;
                toast.error('Configuration switch timed out. Please try again.', {
                    duration: TOAST_DURATION.ERROR
                });
            }
        }, 30_000);
        const newUrl = buildAdvisorSwitchUrl(
            $page.url,
            bestAlternative.version,
            bestAlternative.loader,
            data.context.gameVersion,
            data.context.loader
        );
        // newUrl is already a fully-resolved path from buildAdvisorSwitchUrl
        // eslint-disable-next-line svelte/no-navigation-without-resolve
        goto(newUrl);
    }

    // --- Modpack skip banner ---
    let modpackWarnings = $derived(
        data.warnings.filter(
            (w) =>
                w.message.toLowerCase().includes('modpack') &&
                w.message.toLowerCase().includes('skipped')
        )
    );
    let showModpackBanner = $derived(modpackWarnings.length > 0 && !modpackBannerDismissed);

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

    let cascadeConfirmOpen = $state(false);
    let cascadePendingId = $state<string | null>(null);
    let cascadeDependents = $state<string[]>([]);

    function onExclude(projectId: string) {
        const dependents = getDependentMods(projectId, allProjects);
        if (dependents.length > 0) {
            cascadePendingId = projectId;
            cascadeDependents = dependents;
            cascadeConfirmOpen = true;
            return;
        }
        excludedIds.add(projectId);
        syncUrlExclusions();
    }

    function confirmCascadeExclude() {
        if (cascadePendingId) {
            excludedIds.add(cascadePendingId);
            // Also exclude the dependents
            for (const p of allProjects) {
                if (p.dependencyOf === cascadePendingId) {
                    excludedIds.add(p.projectId);
                }
            }
            syncUrlExclusions();
        }
        cascadeConfirmOpen = false;
        cascadePendingId = null;
        cascadeDependents = [];
    }

    function cancelCascadeExclude() {
        cascadeConfirmOpen = false;
        cascadePendingId = null;
        cascadeDependents = [];
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
        initDownload(allVisibleProjects, pendingDownloadSide, {
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

    function handleDownloadOtherSide(side: 'client' | 'server') {
        autoSaveTriggered = false;
        initDownload(allVisibleProjects, side, { ...data.downloadSettings, sessionKey });
        startDownload();
    }

    function handleBackToReview() {
        resetDownloadFull();
    }

    async function handleShare() {
        if (browser && 'share' in navigator) {
            try {
                await navigator.share({
                    title: collectionNames,
                    text: `Check out this mod collection: ${collectionNames}`,
                    url: $page.url.toString()
                });
                return;
            } catch (err) {
                if (err instanceof Error && err.name === 'AbortError') return;
            }
        }
        shareOpen = true;
    }

    function handleSelectProject(project: ResolvedProject) {
        selectedProject = project;
        sheetOpen = true;
    }

    // Cache successful resolution results for browser refresh fallback.
    // Guard: only write when serverData's context matches the current URL to avoid
    // caching stale data during SvelteKit navigation transitions.
    $effect(() => {
        if (!serverData.loadError && !serverData.isLargeLoad) {
            const searchParams = $page.url.search;
            const contextIds = serverData.context?.collectionIds;
            const urlIds = $page.url.searchParams.get('c');
            if (searchParams && contextIds && urlIds && contextIds.join(',') === urlIds) {
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

<!-- Large load multi-step loader -->
{#if serverData.isLargeLoad && !resolvedLargeData && !largeLoadError}
    <MultiStepLoader
        states={serverData.loadSteps}
        loading={true}
        currentStep={largeLoadStep}
        stepStatuses={largeLoadStatuses}
        showProgress
        title="Preparing your mods..."
        description="You've got a lot of mods — hang tight while we check everything works together."
        statusMessage={largeLoadStatusMessage}
        onCancel={handleCancelLargeLoad}
    />
{/if}

<!-- Advisor switch loader -->
{#if advisorSwitching}
    <MultiStepLoader
        states={advisorSwitchSteps}
        loading={true}
        currentStep={0}
        showProgress
        title="Switching configuration..."
        description="Checking your mods against the new version. This won't take long."
    />
{/if}

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
{:else if serverData.isLargeLoad && !resolvedLargeData}
    <!-- Large load in progress — MultiStepLoader overlay handles feedback -->
    {#if largeLoadError}
        <div class="flex min-h-[60vh] items-center justify-center px-4">
            <Empty.Root class="border-none">
                <Empty.Header>
                    <Empty.Media>
                        <AlertCircleIcon class="size-16 text-muted-foreground" />
                    </Empty.Media>
                    <Empty.Title class="text-2xl font-bold tracking-tight"
                        >Failed to load</Empty.Title
                    >
                    <Empty.Description class="max-w-md text-base">
                        Some batches failed to resolve. Try again or use fewer collections.
                    </Empty.Description>
                </Empty.Header>
                <Empty.Content>
                    <div class="flex gap-3">
                        <Button variant="outline" onclick={() => location.reload()}>
                            <RefreshCwIcon class="mr-2 size-4" />
                            Try again
                        </Button>
                        <Button variant="ghost" href="/">
                            <ArrowLeftIcon class="mr-2 size-4" />
                            Back to home
                        </Button>
                    </div>
                </Empty.Content>
            </Empty.Root>
        </div>
    {/if}
{:else}
    <div class="min-h-screen">
        {#if usingCache}
            <div
                class={cn(
                    'border-b px-4 py-2 text-center text-sm',
                    SEMANTIC_BANNER_COLORS.warning.border,
                    SEMANTIC_BANNER_COLORS.warning.bg,
                    SEMANTIC_BANNER_COLORS.warning.text
                )}
            >
                Viewing cached results. <Button
                    variant="link"
                    class="p-0"
                    onclick={() => location.reload()}>Reload</Button
                > to fetch fresh data.
            </div>
        {/if}

        <SummaryBar
            {resolvedModCount}
            {unavailableCount}
            context={data.context}
            downloadPhase={dlState.phase}
            {downloadProgress}
            downloadSpeed={dlState.speedBytesPerSec}
            downloadEta={dlState.eta}
            isMiniProgress={dlState.isMiniProgress}
            onCancelDownload={handleCancelDownload}
            onShare={handleShare}
            onClickMods={() => scrollToModList()}
            onClickIssues={() => scrollToResolutionDetails('issues')}
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
                    onShare={handleShare}
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
                        onShare={handleShare}
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
                        {resolvedModCount}
                        dependencyCount={depModCount}
                        {autoFixedCount}
                        {unavailableCount}
                        gameVersion={data.context.gameVersion}
                        loader={data.context.loader}
                        {sideStats}
                        {hasClientMods}
                        {hasServerMods}
                        {collectionNames}
                        {bestAlternative}
                        {showAdvisor}
                        {advisorLoading}
                        {advisorStatus}
                        modpackSkippedCount={modpackWarnings.length}
                        excludedCount={excludedIds.size}
                        onAdvisorSwitch={handleAdvisorSwitch}
                        onStartDownload={handleStartDownload}
                        onShare={handleShare}
                    />
                </div>

                <!-- Resolution details — only shown when there are issues -->
                {#if resolutionState === 'hasIssues' && (autoResolution.items.length > 0 || activeConflictCount > 0 || visibleMissingDeps.length > 0)}
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
                            modAvailability={advisorModAvailability}
                            {advisorLoading}
                            unresolvedMetadata={data.unresolvedMetadata}
                            {showAdvisor}
                            bind:activeTab={resolutionDetailsTab}
                        />
                    </div>
                {/if}

                <!-- Modpack skip banner -->
                {#if showModpackBanner}
                    <div
                        class="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50/50 px-4 py-3 dark:border-blue-800 dark:bg-blue-950/20"
                        transition:slide={safeTransition({ duration: 200 })}
                    >
                        <PackageIcon class="size-4 shrink-0 text-blue-600 dark:text-blue-400" />
                        <p class="flex-1 text-sm text-blue-800 dark:text-blue-200">
                            {modpackWarnings.length}
                            {modpackWarnings.length === 1 ? 'modpack was' : 'modpacks were'} skipped —
                            they're already packaged for launcher import.
                        </p>
                        <Button
                            variant="ghost"
                            size="sm"
                            class="size-7 shrink-0 p-0 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
                            onclick={() => (modpackBannerDismissed = true)}
                            aria-label="Dismiss"
                        >
                            <XIcon class="size-3.5" />
                        </Button>
                    </div>
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
                        collections={data.collections}
                        {viewMode}
                        onViewModeChange={handleViewModeChange}
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
                {unavailableCount}
                onStartDownload={handleStartDownload}
                onShare={handleShare}
            />

            <!-- Download confirmation -->
            <DownloadConfirmation
                bind:open={downloadConfirmOpen}
                side={pendingDownloadSide}
                projects={allVisibleProjects}
                {serverOnlyCount}
                {advisorLoading}
                hasIssues={resolutionState === 'hasIssues'}
                onConfirm={handleConfirmDownload}
                onClose={() => (downloadConfirmOpen = false)}
            />

            <!-- Cascade exclude confirmation -->
            <AlertDialog.Root bind:open={cascadeConfirmOpen}>
                <AlertDialog.Content>
                    <AlertDialog.Header>
                        <AlertDialog.Title>Also removes dependent mods</AlertDialog.Title>
                        <AlertDialog.Description>
                            Excluding this mod will also remove: {cascadeDependents.join(', ')}
                            {cascadeDependents.length === 1
                                ? ' (it depends on this mod).'
                                : ' (they depend on this mod).'}
                        </AlertDialog.Description>
                    </AlertDialog.Header>
                    <AlertDialog.Footer>
                        <AlertDialog.Cancel onclick={cancelCascadeExclude}
                            >Cancel</AlertDialog.Cancel
                        >
                        <AlertDialog.Action onclick={confirmCascadeExclude}>
                            Exclude all
                        </AlertDialog.Action>
                    </AlertDialog.Footer>
                </AlertDialog.Content>
            </AlertDialog.Root>
        {/if}
    </div>
{/if}
