<script lang="ts">
    import type { SideStats } from '$lib/services/review-resolution';
    import { Button } from '$lib/components/ui/button';
    import * as Tooltip from '$lib/components/ui/tooltip';
    import { formatBytes } from '$lib/utils/format';
    import { fly } from 'svelte/transition';
    import { safeTransition } from '$lib/utils/motion';
    import DownloadIcon from '@lucide/svelte/icons/download';
    import MonitorIcon from '@lucide/svelte/icons/monitor';
    import ServerIcon from '@lucide/svelte/icons/server';
    import PackageIcon from '@lucide/svelte/icons/package';

    interface Props {
        visible: boolean;
        sideStats: { client: SideStats; server: SideStats; total: SideStats };
        hasClientMods: boolean;
        hasServerMods: boolean;
        hasUnresolvedIssues: boolean;
        onStartDownload: (side: 'client' | 'server') => void;
    }

    let {
        visible,
        sideStats,
        hasClientMods,
        hasServerMods,
        hasUnresolvedIssues,
        onStartDownload
    }: Props = $props();
</script>

{#if visible}
    <div
        class="sticky bottom-0 z-40 border-t-2 bg-background backdrop-blur-sm"
        transition:fly={safeTransition({ y: 40, duration: 200 })}
    >
        <div class="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
            <!-- Left: total size -->
            <div class="flex items-center gap-2 text-sm text-muted-foreground">
                <PackageIcon class="size-4" />
                <span>{formatBytes(sideStats.total.downloadSize)} total</span>
            </div>

            <!-- Right: download buttons -->
            <div class="flex flex-wrap items-center gap-2">
                {#if hasClientMods}
                    {#if hasUnresolvedIssues}
                        <Tooltip.Root>
                            <Tooltip.Trigger>
                                {#snippet child({ props })}
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        class="h-auto flex-col border-amber-300 py-1.5 text-amber-700 dark:border-amber-700 dark:text-amber-300"
                                        onclick={() => onStartDownload('client')}
                                        {...props}
                                    >
                                        <span class="flex items-center gap-1.5">
                                            <DownloadIcon class="size-3.5" />
                                            <MonitorIcon class="size-3.5" />
                                            {hasServerMods
                                                ? 'Download Client Mods'
                                                : 'Download Mods'}
                                        </span>
                                        <span class="text-[10px] font-normal opacity-70">
                                            For your .minecraft · {sideStats.client.count} mods · {formatBytes(
                                                sideStats.client.downloadSize
                                            )}
                                        </span>
                                    </Button>
                                {/snippet}
                            </Tooltip.Trigger>
                            <Tooltip.Content>Some issues are unresolved</Tooltip.Content>
                        </Tooltip.Root>
                    {:else}
                        <Button
                            size="sm"
                            class="h-auto flex-col bg-emerald-600 py-1.5 text-white hover:bg-emerald-700"
                            onclick={() => onStartDownload('client')}
                        >
                            <span class="flex items-center gap-1.5">
                                <DownloadIcon class="size-3.5" />
                                <MonitorIcon class="size-3.5" />
                                Download Client Mods
                            </span>
                            <span class="text-[10px] font-normal opacity-70">
                                For your .minecraft · {sideStats.client.count} mods · {formatBytes(
                                    sideStats.client.downloadSize
                                )}
                            </span>
                        </Button>
                    {/if}
                {/if}

                {#if hasServerMods}
                    {#if hasUnresolvedIssues}
                        <Tooltip.Root>
                            <Tooltip.Trigger>
                                {#snippet child({ props })}
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        class="h-auto flex-col border-amber-300 py-1.5 text-amber-700 dark:border-amber-700 dark:text-amber-300"
                                        onclick={() => onStartDownload('server')}
                                        {...props}
                                    >
                                        <span class="flex items-center gap-1.5">
                                            <DownloadIcon class="size-3.5" />
                                            <ServerIcon class="size-3.5" />
                                            Download Server Mods
                                        </span>
                                        <span class="text-[10px] font-normal opacity-70">
                                            For dedicated servers · {sideStats.server.count} mods · {formatBytes(
                                                sideStats.server.downloadSize
                                            )}
                                        </span>
                                    </Button>
                                {/snippet}
                            </Tooltip.Trigger>
                            <Tooltip.Content>Some issues are unresolved</Tooltip.Content>
                        </Tooltip.Root>
                    {:else}
                        <Button
                            size="sm"
                            variant="outline"
                            class="h-auto flex-col py-1.5"
                            onclick={() => onStartDownload('server')}
                        >
                            <span class="flex items-center gap-1.5">
                                <DownloadIcon class="size-3.5" />
                                <ServerIcon class="size-3.5" />
                                Download Server Mods
                            </span>
                            <span class="text-[10px] font-normal opacity-70">
                                For your server · {sideStats.server.count} mods · {formatBytes(
                                    sideStats.server.downloadSize
                                )}
                            </span>
                        </Button>
                    {/if}
                {/if}
            </div>
        </div>
    </div>
{/if}
