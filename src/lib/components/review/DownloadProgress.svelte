<script lang="ts">
    import type { DownloadState } from '$lib/state/download.svelte';
    import DownloadRow from './DownloadRow.svelte';
    import { slide } from 'svelte/transition';
    import { safeTransition } from '$lib/utils/motion';
    import { Button } from '$lib/components/ui/button';
    import { Progress } from '$lib/components/ui/progress';
    import * as Alert from '$lib/components/ui/alert';
    import * as Tabs from '$lib/components/ui/tabs';
    import { formatBytes, formatSpeed, formatEta } from '$lib/utils/format';
    import { LAUNCHER_GUIDES } from '$lib/config/install-guides';
    import AlertCircleIcon from '@lucide/svelte/icons/circle-alert';
    import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
    import DownloadIcon from '@lucide/svelte/icons/download';
    import CheckCircleIcon from '@lucide/svelte/icons/circle-check';
    import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';

    interface Props {
        state: DownloadState;
        onCancel: () => void;
        onSave: () => void;
        onBackToReview: () => void;
        onRetry: () => void;
        onDownloadOtherSide?: (side: 'client' | 'server') => void;
    }

    let { state, onCancel, onSave, onBackToReview, onRetry, onDownloadOtherSide }: Props = $props();

    let overallPercent = $derived(
        state.overallTotalBytes > 0
            ? Math.round((state.overallBytesDownloaded / state.overallTotalBytes) * 100)
            : 0
    );

    let completedCount = $derived(state.files.filter((f) => f.status === 'complete').length);
    let totalCount = $derived(state.files.length);

    let phaseLabel = $derived.by(() => {
        switch (state.phase) {
            case 'downloading':
                return `Downloading ${completedCount}/${totalCount}...`;
            case 'verifying':
                return 'Verifying file integrity...';
            case 'zipping':
                return 'Building ZIP...';
            case 'complete':
                return 'Download complete';
            case 'error':
                return 'Download failed';
            default:
                return '';
        }
    });

    let sideLabel = $derived(state.targetSide === 'client' ? 'Mods' : 'Server Mods');
    let otherSide = $derived<'client' | 'server'>(
        state.targetSide === 'client' ? 'server' : 'client'
    );
    let otherSidePrompt = $derived(
        otherSide === 'server' ? 'Also running a dedicated server?' : 'Need mods for your game too?'
    );
    let otherSideButtonLabel = $derived(
        otherSide === 'server' ? 'Download Server Mods' : 'Download Mods'
    );
</script>

<div class="space-y-4">
    <!-- Progress header -->
    {#if state.phase === 'downloading' || state.phase === 'verifying' || state.phase === 'zipping'}
        <div class="space-y-3 rounded-lg border bg-card p-4">
            <div class="flex items-center justify-between">
                <span class="text-sm font-medium" aria-live="polite">{phaseLabel}</span>
                <Button variant="outline" size="sm" onclick={onCancel}>Cancel</Button>
            </div>

            <div
                class="**:data-[slot=progress-indicator]:bg-emerald-500 dark:**:data-[slot=progress-indicator]:bg-emerald-400"
            >
                <Progress value={overallPercent} class="h-2 bg-emerald-100 dark:bg-emerald-950" />
            </div>

            <div class="flex items-center justify-between text-xs text-muted-foreground">
                <span
                    >{formatBytes(state.overallBytesDownloaded)} / {formatBytes(
                        state.overallTotalBytes
                    )}</span
                >
                {#if state.phase === 'downloading'}
                    <span>{formatSpeed(state.speedBytesPerSec)} · ETA {formatEta(state.eta)}</span>
                {/if}
            </div>
        </div>
    {/if}

    <!-- Complete state -->
    {#if state.phase === 'complete' && state.zipBlob}
        <div
            class="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/30"
        >
            <div class="flex items-center gap-2">
                <CheckCircleIcon class="size-5 text-emerald-600 dark:text-emerald-400" />
                <span class="font-medium text-emerald-800 dark:text-emerald-200">
                    {sideLabel} ZIP ready ({formatBytes(state.zipSize)})
                </span>
            </div>

            <div class="flex flex-wrap gap-2">
                <Button size="sm" onclick={onSave}>
                    <DownloadIcon class="mr-1.5 size-3.5" />
                    Save ZIP
                </Button>
                <Button variant="outline" size="sm" onclick={onBackToReview}>
                    <ArrowLeftIcon class="mr-1.5 size-3.5" />
                    Back to Review
                </Button>
            </div>

            {#if onDownloadOtherSide}
                <div class="flex items-center gap-3 border-t pt-3">
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
        </div>

        <!-- Installation Guide -->
        <div class="rounded-lg border bg-card p-4">
            <h3 class="mb-3 text-sm font-medium">Installation Guide</h3>
            <Tabs.Root value="vanilla">
                <div class="scrollbar-thin overflow-x-auto">
                    <Tabs.List class="flex-nowrap">
                        {#each LAUNCHER_GUIDES as guide (guide.id)}
                            <Tabs.Trigger value={guide.id} class="shrink-0 text-xs">
                                {guide.name}
                            </Tabs.Trigger>
                        {/each}
                    </Tabs.List>
                </div>

                {#each LAUNCHER_GUIDES as guide (guide.id)}
                    <Tabs.Content value={guide.id} class="pt-3">
                        <ol class="list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
                            {#each guide.steps as step, i (i)}
                                <li>{step}</li>
                            {/each}
                        </ol>
                    </Tabs.Content>
                {/each}
            </Tabs.Root>
        </div>
    {/if}

    <!-- Error state -->
    {#if state.phase === 'error'}
        <Alert.Root variant="destructive">
            <AlertCircleIcon class="size-4" />
            <Alert.Title>Download failed</Alert.Title>
            <Alert.Description>
                {state.errorMessage ?? 'An unknown error occurred during download.'}
            </Alert.Description>
        </Alert.Root>
        <div class="flex gap-2">
            <Button size="sm" onclick={onRetry}>
                <RefreshCwIcon class="mr-1.5 size-3.5" />
                Retry
            </Button>
            <Button variant="outline" size="sm" onclick={onBackToReview}>
                <ArrowLeftIcon class="mr-1.5 size-3.5" />
                Back to Review
            </Button>
        </div>
    {/if}

    <!-- File list -->
    {#if state.phase !== 'complete'}
        <div class="space-y-1">
            {#each state.files as file (file.fileUrl)}
                <div transition:slide={safeTransition({ duration: 150 })}>
                    <DownloadRow {file} />
                </div>
            {/each}
        </div>
    {/if}
</div>
