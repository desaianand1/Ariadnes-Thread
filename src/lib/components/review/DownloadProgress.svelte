<script lang="ts">
    import type { DownloadState } from '$lib/state/download.svelte';
    import type { Component } from 'svelte';
    import DownloadRow from './DownloadRow.svelte';
    import CopyablePath from './CopyablePath.svelte';
    import { slide, fly } from 'svelte/transition';
    import { safeTransition } from '$lib/utils/motion';
    import { useMinDuration } from '$lib/utils/min-duration.svelte';
    import { Button } from '$lib/components/ui/button';
    import { Progress } from '$lib/components/ui/progress';
    import { Skeleton } from '$lib/components/ui/skeleton';
    import * as Alert from '$lib/components/ui/alert';
    import * as Tabs from '$lib/components/ui/tabs';
    import { formatBytes, formatEta } from '$lib/utils/format';
    import { LAUNCHER_GUIDES } from '$lib/config/install-guides';
    import { ANIMATION_DURATION } from '$lib/config/constants';
    import { detectOS } from '$lib/utils/platform';
    import { SiCurseforge, SiModrinth } from '@icons-pack/svelte-simple-icons';
    import VanillaIcon from '$lib/components/icons/VanillaIcon.svelte';
    import PrismLauncherIcon from '$lib/components/icons/PrismLauncherIcon.svelte';
    import GdLauncherIcon from '$lib/components/icons/GdLauncherIcon.svelte';
    import AlertCircleIcon from '@lucide/svelte/icons/circle-alert';
    import DownloadIcon from '@lucide/svelte/icons/download';
    import CheckCircleIcon from '@lucide/svelte/icons/circle-check';
    import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
    import ScrollIcon from '@lucide/svelte/icons/scroll';
    import LoaderIcon from '@lucide/svelte/icons/loader';
    import ShareIcon from '@lucide/svelte/icons/share-2';
    import ServerIcon from '@lucide/svelte/icons/server';
    import MonitorIcon from '@lucide/svelte/icons/monitor';
    import XIcon from '@lucide/svelte/icons/x';

    interface Props {
        state: DownloadState;
        onCancel: () => void;
        onSaveClient: () => void;
        onSaveServer: () => void;
        onBackToReview: () => void;
        onRetry: () => void;
        onDownloadOtherSide?: (side: 'client' | 'server') => void;
        onShare?: () => void;
        shareUrl?: string;
    }

    let {
        state: dlState,
        onCancel,
        onSaveClient,
        onSaveServer,
        onBackToReview,
        onRetry,
        onDownloadOtherSide,
        onShare,
        shareUrl = ''
    }: Props = $props();

    const GUIDE_ICONS: Record<string, Component<{ class?: string }>> = {
        vanilla: VanillaIcon,
        prism: PrismLauncherIcon,
        curseforge: SiCurseforge,
        'modrinth-app': SiModrinth,
        gdlauncher: GdLauncherIcon
    };

    let completedCount = $derived(dlState.files.filter((f) => f.status === 'complete').length);
    let totalCount = $derived(dlState.files.length);

    let userOS = $derived(detectOS());
    let sideLabel = $derived(dlState.targetSide === 'client' ? 'Client Mods' : 'Server Mods');
    let otherSide = $derived<'client' | 'server'>(
        dlState.targetSide === 'client' ? 'server' : 'client'
    );
    let otherSidePrompt = $derived(
        otherSide === 'server' ? 'Also running a dedicated server?' : 'Need mods for your game too?'
    );
    let otherSideButtonLabel = $derived(
        otherSide === 'server' ? 'Download Server Mods' : 'Download Mods'
    );

    let hasClientZip = $derived(!!dlState.clientZipBlob);
    let hasServerZip = $derived(!!dlState.serverZipBlob);
    let hasBothZips = $derived(hasClientZip && hasServerZip);

    let currentSideZipSize = $derived(
        dlState.targetSide === 'client' ? dlState.clientZipSize : dlState.serverZipSize
    );

    // Mini-progress state
    let miniProgressPercent = $derived(
        dlState.overallTotalBytes > 0
            ? Math.round((dlState.overallBytesDownloaded / dlState.overallTotalBytes) * 100)
            : 0
    );

    // Prevent flash on short-lived verifying/zipping phases
    const isVerifying = useMinDuration(() => dlState.phase === 'verifying', 400);
    const isZipping = useMinDuration(() => dlState.phase === 'zipping', 400);

    let showVerifying = $derived(
        isVerifying() && dlState.phase !== 'complete' && dlState.phase !== 'error'
    );
    let showZipping = $derived(
        isZipping() && !showVerifying && dlState.phase !== 'complete' && dlState.phase !== 'error'
    );
</script>

<div class="space-y-4">
    <!-- Verifying skeleton -->
    {#if showVerifying && dlState.phase !== 'downloading'}
        <div
            class="space-y-3 rounded-lg border bg-card p-4"
            in:fly={safeTransition({ y: 10, duration: ANIMATION_DURATION.NORMAL })}
        >
            <div class="flex items-center gap-2">
                <LoaderIcon class="size-4 animate-spin text-muted-foreground" />
                <span class="text-sm font-medium">Verifying file integrity...</span>
            </div>
            <Skeleton class="h-2 w-full" />
        </div>
    {/if}

    <!-- Zipping skeleton -->
    {#if showZipping && dlState.phase !== 'downloading'}
        <div
            class="space-y-3 rounded-lg border bg-card p-4"
            in:fly={safeTransition({ y: 10, duration: ANIMATION_DURATION.NORMAL })}
        >
            <div class="flex items-center gap-2">
                <LoaderIcon class="size-4 animate-spin text-muted-foreground" />
                <span class="text-sm font-medium">Building ZIP...</span>
            </div>
            <Skeleton class="h-2 w-full" />
        </div>
    {/if}

    <!-- Complete state -->
    {#if dlState.phase === 'complete'}
        <!-- Top card: Download Status -->
        <div
            class="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-900 dark:bg-emerald-950/30"
            in:fly={safeTransition({ y: 10, duration: ANIMATION_DURATION.NORMAL })}
        >
            {#if hasBothZips}
                <!-- Both downloads complete -->
                <div
                    class="flex items-center gap-2"
                    in:slide={safeTransition({ duration: ANIMATION_DURATION.FAST })}
                >
                    <CheckCircleIcon class="size-5 text-emerald-600 dark:text-emerald-400" />
                    <span class="font-medium text-emerald-800 dark:text-emerald-200">
                        Both downloads complete
                    </span>
                </div>

                <div class="flex flex-wrap gap-2">
                    <Button size="sm" onclick={onSaveClient}>
                        <MonitorIcon class="mr-1.5 size-3.5" />
                        Save Client ZIP
                        <span class="ml-1 text-xs opacity-70"
                            >{formatBytes(dlState.clientZipSize)}</span
                        >
                    </Button>
                    <Button size="sm" variant="secondary" onclick={onSaveServer}>
                        <ServerIcon class="mr-1.5 size-3.5" />
                        Save Server ZIP
                        <span class="ml-1 text-xs opacity-70"
                            >{formatBytes(dlState.serverZipSize)}</span
                        >
                    </Button>
                </div>
                <p class="text-xs text-muted-foreground">
                    Download didn't start? Use the save buttons above.
                </p>
            {:else}
                <!-- Single side complete -->
                <div class="flex items-center gap-2">
                    <CheckCircleIcon class="size-5 text-emerald-600 dark:text-emerald-400" />
                    <span class="font-medium text-emerald-800 dark:text-emerald-200">
                        {sideLabel} ({formatBytes(currentSideZipSize)})
                    </span>
                </div>

                <p class="text-xs text-muted-foreground">
                    Download didn't start?
                    <Button
                        variant="link"
                        size="sm"
                        class="h-auto p-0 text-xs"
                        onclick={dlState.targetSide === 'client' ? onSaveClient : onSaveServer}
                    >
                        Save ZIP
                    </Button>
                </p>

                <!-- Mini-progress for other-side download -->
                {#if dlState.isMiniProgress && dlState.phase !== 'complete'}
                    <!-- This won't render here since phase is 'complete', handled below -->
                {/if}

                <!-- "Download Other Side" CTA -->
                {#if onDownloadOtherSide}
                    <div
                        class="flex items-center gap-3 border-t pt-3"
                        transition:slide={safeTransition({ duration: ANIMATION_DURATION.FAST })}
                    >
                        <span class="text-sm text-muted-foreground">{otherSidePrompt}</span>
                        <Button
                            variant="secondary"
                            size="sm"
                            onclick={() => onDownloadOtherSide(otherSide)}
                        >
                            <DownloadIcon class="mr-1.5 size-3.5" />
                            {otherSideButtonLabel}
                        </Button>
                    </div>
                {/if}
            {/if}
        </div>

        <!-- Bottom card: Share & Install -->
        <div
            class="space-y-4 rounded-lg border bg-card p-4"
            in:fly={safeTransition({ y: 10, duration: ANIMATION_DURATION.NORMAL, delay: 100 })}
        >
            <!-- Inline Share -->
            {#if shareUrl}
                <div class="space-y-2">
                    <p class="text-sm text-muted-foreground">
                        Send this link to friends so they can download too:
                    </p>
                    <div class="flex items-center gap-2">
                        <CopyablePath value={shareUrl} />
                        {#if onShare}
                            <Button variant="outline" size="sm" onclick={onShare}>
                                <ShareIcon class="mr-1.5 size-3.5" />
                                More options
                            </Button>
                        {/if}
                    </div>
                </div>
            {/if}

            <!-- Installation Guide -->
            <div>
                <span class="mb-3 inline-flex items-center gap-1.5">
                    <ScrollIcon class="size-4" />
                    <h3 class="text-sm font-medium">Installation Guide</h3>
                </span>

                <Tabs.Root value="vanilla">
                    <div class="scrollbar-thin overflow-x-auto">
                        <Tabs.List class="flex-nowrap">
                            {#each LAUNCHER_GUIDES as guide (guide.id)}
                                <Tabs.Trigger value={guide.id} class="shrink-0 gap-1.5 text-xs">
                                    {#if GUIDE_ICONS[guide.id]}
                                        {@const Icon = GUIDE_ICONS[guide.id]}
                                        <Icon class="size-3.5" />
                                    {/if}
                                    {guide.name}
                                </Tabs.Trigger>
                            {/each}
                        </Tabs.List>
                    </div>

                    {#each LAUNCHER_GUIDES as guide (guide.id)}
                        <Tabs.Content value={guide.id} class="pt-3">
                            <ol class="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
                                {#each guide.steps as step, i (i)}
                                    <li>
                                        {#if step.type === 'path'}
                                            {step.prefix}
                                            <div class="mt-1">
                                                <CopyablePath value={step.paths[userOS]} />
                                            </div>
                                        {:else}
                                            {step.text}
                                        {/if}
                                    </li>
                                {/each}
                            </ol>
                        </Tabs.Content>
                    {/each}
                </Tabs.Root>
            </div>
        </div>
    {/if}

    <!-- Inline mini-progress (shown inside completion card context when downloading other side) -->
    {#if dlState.isMiniProgress && (dlState.phase === 'downloading' || dlState.phase === 'verifying' || dlState.phase === 'zipping')}
        <div
            class="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-900 dark:bg-emerald-950/30"
            transition:slide={safeTransition({ duration: ANIMATION_DURATION.FAST })}
        >
            {#if dlState.phase === 'downloading'}
                <div class="space-y-2">
                    <div class="flex items-center justify-between">
                        <span class="text-sm font-medium"
                            >Downloading {otherSide === 'server' ? 'server' : 'client'} mods...</span
                        >
                        <Button
                            variant="ghost"
                            size="sm"
                            class="h-auto px-1.5 py-0.5 text-xs text-muted-foreground"
                            onclick={onCancel}
                        >
                            <XIcon class="mr-1 size-3" />
                            Cancel
                        </Button>
                    </div>
                    <div
                        class="**:data-[slot=progress-indicator]:bg-emerald-500 dark:**:data-[slot=progress-indicator]:bg-emerald-400"
                    >
                        <Progress
                            value={miniProgressPercent}
                            class="h-2 bg-emerald-100 dark:bg-emerald-950"
                        />
                    </div>
                    <span class="text-xs text-muted-foreground">
                        {completedCount}/{totalCount} files · ETA {formatEta(dlState.eta)}
                    </span>
                </div>
            {:else}
                <div class="flex items-center gap-2">
                    <LoaderIcon class="size-4 animate-spin text-muted-foreground" />
                    <span class="text-sm font-medium">
                        {dlState.phase === 'verifying' ? 'Verifying...' : 'Building ZIP...'}
                    </span>
                </div>
                <Skeleton class="h-2 w-full" />
            {/if}
        </div>
    {/if}

    <!-- Error state -->
    {#if dlState.phase === 'error'}
        <Alert.Root variant="destructive">
            <AlertCircleIcon class="size-4" />
            <Alert.Title>Download failed</Alert.Title>
            <Alert.Description>
                {dlState.errorMessage ?? 'An unknown error occurred during download.'}
            </Alert.Description>
        </Alert.Root>
        <div class="flex gap-2">
            <Button size="sm" onclick={onRetry}>
                <RefreshCwIcon class="mr-1.5 size-3.5" />
                Retry
            </Button>
            <Button variant="outline" size="sm" onclick={onBackToReview}>Back to Review</Button>
        </div>
    {/if}

    <!-- File list (full download only, not mini-progress) -->
    {#if dlState.phase === 'downloading' && !dlState.isMiniProgress}
        <div class="space-y-1">
            {#each dlState.files as file (file.fileUrl)}
                <div transition:slide={safeTransition({ duration: 150 })}>
                    <DownloadRow {file} />
                </div>
            {/each}
        </div>
    {/if}
</div>
