<script lang="ts">
    import type { ResolutionStats } from '$lib/services/types';
    import type { DownloadPhase } from '$lib/state/download.svelte';
    import { Badge } from '$lib/components/ui/badge';
    import { Button } from '$lib/components/ui/button';
    import { Progress } from '$lib/components/ui/progress';
    import * as Tooltip from '$lib/components/ui/tooltip';
    import { formatBytes, formatSpeed, formatEta } from '$lib/utils/format';
    import ShareIcon from '@lucide/svelte/icons/share-2';
    import XIcon from '@lucide/svelte/icons/x';
    import LoaderBadge from './LoaderBadge.svelte';

    interface Props {
        stats: ResolutionStats;
        context: { gameVersion: string; loader: string };
        downloadPhase?: DownloadPhase;
        downloadProgress?: number;
        downloadSpeed?: number;
        downloadEta?: number;
        onCancelDownload?: () => void;
        onShare?: () => void;
        onClickCompatible?: () => void;
        onClickWarnings?: () => void;
        onClickConflicts?: () => void;
        onClickMissing?: () => void;
    }

    let {
        stats,
        context,
        downloadPhase = 'idle',
        downloadProgress = 0,
        downloadSpeed = 0,
        downloadEta = 0,
        onCancelDownload,
        onShare,
        onClickCompatible,
        onClickWarnings,
        onClickConflicts,
        onClickMissing
    }: Props = $props();

    let isActiveDownload = $derived(
        downloadPhase === 'downloading' ||
            downloadPhase === 'verifying' ||
            downloadPhase === 'zipping'
    );
</script>

<div class="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-sm">
    <div class="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        {#if isActiveDownload}
            <!-- Download progress mode — emerald themed -->
            <div class="flex flex-1 items-center gap-4">
                <div
                    class="flex-1 **:data-[slot=progress-indicator]:bg-emerald-500 dark:**:data-[slot=progress-indicator]:bg-emerald-400"
                >
                    <Progress
                        value={downloadProgress}
                        class="h-2 bg-emerald-100 dark:bg-emerald-950"
                    />
                </div>
                <span class="shrink-0 text-sm tabular-nums">
                    {downloadProgress}%
                </span>
                {#if downloadPhase === 'downloading'}
                    <span class="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                        {formatSpeed(downloadSpeed)} · ETA {formatEta(downloadEta)}
                    </span>
                {/if}
            </div>
            <Button variant="outline" size="sm" onclick={onCancelDownload}>
                <XIcon class="mr-1.5 size-3.5" />
                Cancel
            </Button>
        {:else}
            <!-- Normal review mode — clickable stats -->
            <div class="flex flex-wrap items-center gap-1 text-sm">
                <Button
                    variant="ghost"
                    size="sm"
                    class="h-auto gap-1.5 px-1.5 py-0.5"
                    aria-label="Scroll to {stats.resolvedCount} compatible mods"
                    onclick={onClickCompatible}
                >
                    <span class="size-2 rounded-full bg-emerald-500" aria-hidden="true"></span>
                    {stats.resolvedCount} compatible
                </Button>

                {#if stats.warningCount > 0}
                    <Button
                        variant="ghost"
                        size="sm"
                        class="h-auto gap-1.5 px-1.5 py-0.5"
                        aria-label="Scroll to {stats.warningCount} warnings"
                        onclick={onClickWarnings}
                    >
                        <span class="size-2 rounded-full bg-yellow-500" aria-hidden="true"></span>
                        {stats.warningCount} warnings
                    </Button>
                {/if}

                {#if stats.conflictCount > 0}
                    <Button
                        variant="ghost"
                        size="sm"
                        class="h-auto gap-1.5 px-1.5 py-0.5"
                        aria-label="Scroll to {stats.conflictCount} conflicts"
                        onclick={onClickConflicts}
                    >
                        <span class="size-2 rounded-full bg-red-500" aria-hidden="true"></span>
                        {stats.conflictCount} conflicts
                    </Button>
                {/if}

                {#if stats.unresolvedCount > 0}
                    <Button
                        variant="ghost"
                        size="sm"
                        class="h-auto gap-1.5 px-1.5 py-0.5"
                        aria-label="Scroll to {stats.unresolvedCount} missing dependencies"
                        onclick={onClickMissing}
                    >
                        <span class="size-2 rounded-full bg-orange-500" aria-hidden="true"></span>
                        {stats.unresolvedCount} missing
                    </Button>
                {/if}
            </div>

            <!-- Context badges -->
            <div class="flex items-center gap-2">
                <Badge variant="outline">{context.gameVersion}</Badge>
                <LoaderBadge loaderSlug={context.loader} size="sm" />
            </div>

            <!-- Actions -->
            <div class="flex items-center gap-2 md:ml-auto">
                <span class="text-sm text-muted-foreground"
                    >{formatBytes(stats.totalDownloadSize)}</span
                >

                <Tooltip.Root>
                    <Tooltip.Trigger>
                        {#snippet child({ props })}
                            <Button variant="outline" size="sm" onclick={onShare} {...props}>
                                <ShareIcon class="size-3.5" />
                                <span class="sr-only">Share</span>
                            </Button>
                        {/snippet}
                    </Tooltip.Trigger>
                    <Tooltip.Content>Share</Tooltip.Content>
                </Tooltip.Root>
            </div>
        {/if}
    </div>
</div>
