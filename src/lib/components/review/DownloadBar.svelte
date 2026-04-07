<script lang="ts">
    import type { SideStats } from '$lib/services/review-resolution';
    import { Button } from '$lib/components/ui/button';
    import { formatBytes } from '$lib/utils/format';
    import { fly } from 'svelte/transition';
    import { safeTransition } from '$lib/utils/motion';
    import * as Tooltip from '$lib/components/ui/tooltip';
    import DownloadIcon from '@lucide/svelte/icons/download';
    import ShareIcon from '@lucide/svelte/icons/share-2';
    import PackageIcon from '@lucide/svelte/icons/package';

    interface Props {
        visible: boolean;
        sideStats: { client: SideStats; server: SideStats; total: SideStats };
        hasClientMods: boolean;
        hasServerMods: boolean;
        unavailableCount: number;
        onStartDownload: (side: 'client' | 'server') => void;
        onShare?: () => void;
    }

    let {
        visible,
        sideStats,
        hasClientMods,
        hasServerMods,
        unavailableCount,
        onStartDownload,
        onShare
    }: Props = $props();
</script>

{#if visible}
    <div
        class="sticky bottom-0 z-40 border-t-2 bg-background py-3.5 backdrop-blur-sm"
        transition:fly={safeTransition({ y: 40, duration: 200 })}
    >
        <div class="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
            <!-- Left: total size + unavailable count -->
            <div class="flex items-center gap-2 text-sm text-muted-foreground">
                <PackageIcon class="size-4" />
                <span>{formatBytes(sideStats.total.downloadSize)} total</span>
                {#if unavailableCount > 0}
                    <span class="text-muted-foreground/60">&middot;</span>
                    <span class="text-muted-foreground/70">{unavailableCount} unavailable</span>
                {/if}
            </div>

            <!-- Right: download buttons + share -->
            <div class="flex flex-wrap items-center gap-2">
                {#if hasClientMods}
                    <Button
                        size="sm"
                        class="h-auto flex-col bg-emerald-600 py-1.5 text-white hover:bg-emerald-700"
                        onclick={() => onStartDownload('client')}
                    >
                        <span class="flex items-center gap-1.5">
                            <DownloadIcon class="size-3.5" />
                            Download Mods
                        </span>
                        <span class="text-[10px] font-normal opacity-70">
                            {sideStats.client.count} mods &middot; {formatBytes(
                                sideStats.client.downloadSize
                            )}
                        </span>
                    </Button>
                {/if}

                {#if hasServerMods}
                    <Button
                        size="sm"
                        variant="outline"
                        class="h-auto flex-col border-emerald-300 py-1.5 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300"
                        onclick={() => onStartDownload('server')}
                    >
                        <span class="flex items-center gap-1.5">
                            <DownloadIcon class="size-3.5" />
                            Download Server Mods
                        </span>
                        <span class="text-[10px] font-normal opacity-70">
                            {sideStats.server.count} mods &middot; {formatBytes(
                                sideStats.server.downloadSize
                            )}
                        </span>
                    </Button>
                {/if}

                {#if onShare}
                    <Tooltip.Root>
                        <Tooltip.Trigger>
                            {#snippet child({ props })}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    class="px-2.5"
                                    {...props}
                                    onclick={onShare}
                                >
                                    <ShareIcon class="size-3.5" />
                                    <span class="sr-only">Share</span>
                                </Button>
                            {/snippet}
                        </Tooltip.Trigger>
                        <Tooltip.Content>Share</Tooltip.Content>
                    </Tooltip.Root>
                {/if}
            </div>
        </div>
    </div>
{/if}
