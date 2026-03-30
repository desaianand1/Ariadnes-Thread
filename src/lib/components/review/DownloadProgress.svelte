<script lang="ts">
    import type { DownloadState } from '$lib/state/download.svelte';
    import DownloadRow from './DownloadRow.svelte';
    import { Button } from '$lib/components/ui/button';
    import { Progress } from '$lib/components/ui/progress';
    import * as Alert from '$lib/components/ui/alert';
    import { formatBytes, formatSpeed, formatEta } from '$lib/utils/format';
    import AlertCircleIcon from '@lucide/svelte/icons/circle-alert';
    import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
    import DownloadIcon from '@lucide/svelte/icons/download';
    import CheckCircleIcon from '@lucide/svelte/icons/circle-check';

    interface Props {
        state: DownloadState;
        onCancel: () => void;
        onSave: () => void;
        onBackToReview: () => void;
    }

    let { state, onCancel, onSave, onBackToReview }: Props = $props();

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

    let sideLabel = $derived(state.targetSide === 'client' ? 'Client' : 'Server');

    // Sort files: downloading first, then queued, then complete, then error
    const STATUS_ORDER = {
        downloading: 0,
        queued: 1,
        verifying: 2,
        complete: 3,
        error: 4
    } as const;
    let sortedFiles = $derived(
        [...state.files].sort(
            (a, b) => (STATUS_ORDER[a.status] ?? 5) - (STATUS_ORDER[b.status] ?? 5)
        )
    );
</script>

<div class="space-y-4">
    <!-- Progress header -->
    {#if state.phase === 'downloading' || state.phase === 'verifying' || state.phase === 'zipping'}
        <div class="space-y-3 rounded-lg border bg-card p-4">
            <div class="flex items-center justify-between">
                <span class="text-sm font-medium">{phaseLabel}</span>
                <Button variant="outline" size="sm" onclick={onCancel}>Cancel</Button>
            </div>

            <Progress value={overallPercent} class="h-2" />

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
            class="space-y-3 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950/30"
        >
            <div class="flex items-center gap-2">
                <CheckCircleIcon class="size-5 text-green-600 dark:text-green-400" />
                <span class="font-medium text-green-800 dark:text-green-200">
                    {sideLabel} ZIP ready ({formatBytes(state.zipSize)})
                </span>
            </div>

            <div class="flex gap-2">
                <Button size="sm" onclick={onSave}>
                    <DownloadIcon class="mr-1.5 size-3.5" />
                    Save {sideLabel} ZIP
                </Button>
                <Button variant="outline" size="sm" onclick={onBackToReview}>
                    <ArrowLeftIcon class="mr-1.5 size-3.5" />
                    Back to Review
                </Button>
            </div>
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
            <Button variant="outline" size="sm" onclick={onBackToReview}>
                <ArrowLeftIcon class="mr-1.5 size-3.5" />
                Back to Review
            </Button>
        </div>
    {/if}

    <!-- File list -->
    {#if state.phase !== 'complete'}
        <div class="space-y-1">
            {#each sortedFiles as file (file.fileUrl)}
                <DownloadRow {file} />
            {/each}
        </div>
    {/if}
</div>
