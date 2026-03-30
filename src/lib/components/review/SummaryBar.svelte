<script lang="ts">
    import type { ResolutionStats } from '$lib/services/types';
    import type { DownloadPhase } from '$lib/state/download.svelte';
    import { Badge } from '$lib/components/ui/badge';
    import { Button } from '$lib/components/ui/button';
    import { Progress } from '$lib/components/ui/progress';
    import * as Tooltip from '$lib/components/ui/tooltip';
    import * as ToggleGroup from '$lib/components/ui/toggle-group';
    import { formatBytes, formatSpeed, formatEta, getLoaderDisplayName } from '$lib/utils/format';
    import { getBadgeClassesByModLoader } from '$lib/utils/colors';
    import { cn } from '$lib/utils';
    import ShareIcon from '@lucide/svelte/icons/share-2';
    import LayoutListIcon from '@lucide/svelte/icons/layout-list';
    import Rows3Icon from '@lucide/svelte/icons/rows-3';
    import XIcon from '@lucide/svelte/icons/x';
    import MonitorIcon from '@lucide/svelte/icons/monitor';
    import ServerIcon from '@lucide/svelte/icons/server';

    interface Props {
        stats: ResolutionStats;
        context: { gameVersion: string; loader: string };
        viewMode?: 'detailed' | 'compact';
        downloadPhase?: DownloadPhase;
        downloadProgress?: number;
        downloadSpeed?: number;
        downloadEta?: number;
        onStartDownload?: (side: 'client' | 'server') => void;
        onCancelDownload?: () => void;
        hasClientMods?: boolean;
        hasServerMods?: boolean;
    }

    let {
        stats,
        context,
        viewMode = $bindable('detailed'),
        downloadPhase = 'idle',
        downloadProgress = 0,
        downloadSpeed = 0,
        downloadEta = 0,
        onStartDownload,
        onCancelDownload,
        hasClientMods = true,
        hasServerMods = true
    }: Props = $props();

    let isActiveDownload = $derived(
        downloadPhase === 'downloading' ||
            downloadPhase === 'verifying' ||
            downloadPhase === 'zipping'
    );
</script>

<!-- Desktop: sticky top, Mobile: sticky bottom -->
<div
    class="sticky bottom-0 z-40 border-t bg-background/80 backdrop-blur-sm md:top-0 md:bottom-auto md:border-t-0 md:border-b"
>
    <div class="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        {#if isActiveDownload}
            <!-- Download progress mode -->
            <div class="flex flex-1 items-center gap-4">
                <Progress value={downloadProgress} class="h-2 flex-1" />
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
            <!-- Normal review mode -->
            <!-- Stats -->
            <div class="flex flex-wrap items-center gap-3 text-sm">
                <span class="flex items-center gap-1.5">
                    <span class="size-2 rounded-full bg-green-500"></span>
                    {stats.resolvedCount} compatible
                </span>

                {#if stats.warningCount > 0}
                    <span class="flex items-center gap-1.5">
                        <span class="size-2 rounded-full bg-yellow-500"></span>
                        {stats.warningCount} warnings
                    </span>
                {/if}

                {#if stats.conflictCount > 0}
                    <span class="flex items-center gap-1.5">
                        <span class="size-2 rounded-full bg-red-500"></span>
                        {stats.conflictCount} conflicts
                    </span>
                {/if}

                {#if stats.unresolvedCount > 0}
                    <span class="flex items-center gap-1.5">
                        <span class="size-2 rounded-full bg-orange-500"></span>
                        {stats.unresolvedCount} missing
                    </span>
                {/if}
            </div>

            <!-- Context badges -->
            <div class="flex items-center gap-2">
                <Badge variant="outline">{context.gameVersion}</Badge>
                <Badge variant="secondary" class={cn(getBadgeClassesByModLoader(context.loader))}>
                    {getLoaderDisplayName(context.loader)}
                </Badge>
            </div>

            <!-- Actions -->
            <div class="flex items-center gap-2 md:ml-auto">
                <span class="text-sm text-muted-foreground"
                    >{formatBytes(stats.totalDownloadSize)}</span
                >

                <!-- View mode toggle -->
                <ToggleGroup.Root type="single" bind:value={viewMode} variant="outline" size="sm">
                    <Tooltip.Root>
                        <Tooltip.Trigger>
                            <ToggleGroup.Item value="detailed" aria-label="Detailed view">
                                <LayoutListIcon class="size-3.5" />
                            </ToggleGroup.Item>
                        </Tooltip.Trigger>
                        <Tooltip.Content>Detailed view</Tooltip.Content>
                    </Tooltip.Root>
                    <Tooltip.Root>
                        <Tooltip.Trigger>
                            <ToggleGroup.Item value="compact" aria-label="Compact view">
                                <Rows3Icon class="size-3.5" />
                            </ToggleGroup.Item>
                        </Tooltip.Trigger>
                        <Tooltip.Content>Compact view</Tooltip.Content>
                    </Tooltip.Root>
                </ToggleGroup.Root>

                <!-- Download buttons -->
                {#if hasClientMods}
                    <Button size="sm" onclick={() => onStartDownload?.('client')}>
                        <MonitorIcon class="mr-1.5 size-3.5" />
                        <span class="hidden sm:inline">Download</span> Client ZIP
                    </Button>
                {/if}

                {#if hasServerMods}
                    <Button size="sm" variant="outline" onclick={() => onStartDownload?.('server')}>
                        <ServerIcon class="mr-1.5 size-3.5" />
                        <span class="hidden sm:inline">Download</span> Server ZIP
                    </Button>
                {/if}

                <Tooltip.Root>
                    <Tooltip.Trigger>
                        <Button size="sm" variant="outline" disabled>
                            <ShareIcon class="mr-1.5 size-3.5" />
                            Share
                        </Button>
                    </Tooltip.Trigger>
                    <Tooltip.Content>Coming in Phase 5</Tooltip.Content>
                </Tooltip.Root>
            </div>
        {/if}
    </div>
</div>
