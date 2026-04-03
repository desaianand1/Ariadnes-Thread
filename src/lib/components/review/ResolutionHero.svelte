<script lang="ts">
    import type { ResolutionState, SideStats } from '$lib/services/review-resolution';
    import { Button } from '$lib/components/ui/button';
    import LoaderBadge from './LoaderBadge.svelte';
    import { SIDE_ICONS } from '$lib/utils/colors';
    import { formatBytes } from '$lib/utils/format';
    import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
    import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
    import CircleXIcon from '@lucide/svelte/icons/circle-x';
    import DownloadIcon from '@lucide/svelte/icons/download';
    import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';

    interface Props {
        resolutionState: ResolutionState;
        collectionModCount: number;
        dependencyCount: number;
        unresolvedCount: number;
        gameVersion: string;
        loader: string;
        sideStats: { client: SideStats; server: SideStats; total: SideStats };
        hasClientMods: boolean;
        hasServerMods: boolean;
        collectionNames?: string;
        onStartDownload: (side: 'client' | 'server') => void;
    }

    let {
        resolutionState,
        collectionModCount,
        dependencyCount,
        unresolvedCount,
        gameVersion,
        loader,
        sideStats,
        hasClientMods,
        hasServerMods,
        collectionNames,
        onStartDownload
    }: Props = $props();

    let readyHeading = $derived.by(() => {
        const parts: string[] = [];
        parts.push(`${collectionModCount} mod${collectionModCount !== 1 ? 's' : ''}`);
        if (dependencyCount > 0) {
            parts.push(
                `${dependencyCount} ${dependencyCount === 1 ? 'dependency' : 'dependencies'}`
            );
        }
        return parts.join(' + ') + ' ready for download';
    });
</script>

{#snippet downloadButtons(subtitleColor: string, clientLabel: string, serverLabel: string)}
    <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {#if hasClientMods}
            <div class="flex flex-col items-start">
                <Button
                    size="lg"
                    class="w-full bg-emerald-600 text-white hover:bg-emerald-700 sm:w-auto dark:bg-emerald-600 dark:hover:bg-emerald-700"
                    onclick={() => onStartDownload('client')}
                >
                    <DownloadIcon class="mr-1.5 size-4" />
                    <SIDE_ICONS.client class="mr-1 size-4" />
                    {hasServerMods ? 'Download Client Mods' : 'Download Mods'}
                </Button>
                <span class="mt-1 pl-1 text-xs {subtitleColor}">
                    {clientLabel} &middot; {sideStats.client.count} mods &middot; {formatBytes(
                        sideStats.client.downloadSize
                    )}
                </span>
            </div>
        {/if}
        {#if hasServerMods}
            <div class="flex flex-col items-start">
                <Button
                    size="lg"
                    variant="outline"
                    class="w-full border-emerald-300 text-emerald-700 hover:bg-emerald-100 sm:w-auto dark:border-emerald-700 dark:text-emerald-300 dark:hover:bg-emerald-900/30"
                    onclick={() => onStartDownload('server')}
                >
                    <DownloadIcon class="mr-1.5 size-4" />
                    <SIDE_ICONS.server class="mr-1 size-4" />
                    Download Server Mods
                </Button>
                <span class="mt-1 pl-1 text-xs {subtitleColor}">
                    {serverLabel} &middot; {sideStats.server.count} mods &middot; {formatBytes(
                        sideStats.server.downloadSize
                    )}
                </span>
            </div>
        {/if}
    </div>
{/snippet}

{#if resolutionState === 'allClear'}
    <div
        class="rounded-lg border border-emerald-200 bg-emerald-50/50 p-6 dark:border-emerald-800 dark:bg-emerald-950/20"
    >
        <div class="flex items-start gap-4">
            <CircleCheckIcon
                class="mt-0.5 size-6 shrink-0 text-emerald-600 dark:text-emerald-400"
            />
            <div class="min-w-0 flex-1 space-y-4">
                <div>
                    <h2 class="text-lg font-semibold text-emerald-900 dark:text-emerald-100">
                        {readyHeading}
                    </h2>
                    <p
                        class="mt-1 flex flex-wrap items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300"
                    >
                        <span>Minecraft {gameVersion}</span>
                        <span class="text-emerald-400">&middot;</span>
                        <LoaderBadge loaderSlug={loader} size="sm" />
                        <span class="text-emerald-400">&middot;</span>
                        <span>{formatBytes(sideStats.total.downloadSize)} total</span>
                    </p>
                    {#if collectionNames}
                        <p class="mt-0.5 text-xs text-emerald-600/70 dark:text-emerald-400/60">
                            From: {collectionNames}
                        </p>
                    {/if}
                </div>

                {@render downloadButtons(
                    'text-emerald-600/70 dark:text-emerald-400/70',
                    'For MC Launchers',
                    'For Servers'
                )}
            </div>
        </div>
    </div>
{:else if resolutionState === 'hasIssues'}
    <div
        class="rounded-lg border border-amber-200 bg-amber-50/50 p-6 dark:border-amber-800 dark:bg-amber-950/20"
    >
        <div class="flex items-start gap-4">
            <TriangleAlertIcon class="mt-0.5 size-6 shrink-0 text-amber-600 dark:text-amber-400" />
            <div class="min-w-0 flex-1 space-y-4">
                <div>
                    <h2 class="text-lg font-semibold text-amber-900 dark:text-amber-100">
                        {readyHeading}
                        <span class="text-amber-600 dark:text-amber-400">
                            &middot; {unresolvedCount} unavailable
                        </span>
                    </h2>
                    <p
                        class="mt-1 flex flex-wrap items-center gap-2 text-sm text-amber-700 dark:text-amber-300"
                    >
                        <span>Minecraft {gameVersion}</span>
                        <span class="text-amber-400">&middot;</span>
                        <LoaderBadge loaderSlug={loader} size="sm" />
                        <span class="text-amber-400">&middot;</span>
                        <span>{formatBytes(sideStats.total.downloadSize)} total</span>
                    </p>
                    {#if collectionNames}
                        <p class="mt-0.5 text-xs text-amber-600/70 dark:text-amber-400/60">
                            From: {collectionNames}
                        </p>
                    {/if}
                </div>

                {@render downloadButtons(
                    'text-amber-600/70 dark:text-amber-400/70',
                    '.minecraft',
                    'servers'
                )}
            </div>
        </div>
    </div>
{:else}
    <div
        class="rounded-lg border border-red-200 bg-red-50/50 p-6 dark:border-red-800 dark:bg-red-950/20"
    >
        <div class="flex items-start gap-4">
            <CircleXIcon class="mt-0.5 size-6 shrink-0 text-red-600 dark:text-red-400" />
            <div class="min-w-0 flex-1 space-y-4">
                <div>
                    <h2 class="text-lg font-semibold text-red-900 dark:text-red-100">
                        No compatible mods found
                    </h2>
                    <p class="mt-1 text-sm text-red-700 dark:text-red-300">
                        None of the mods in these collections have versions compatible with
                        Minecraft {gameVersion} on this loader. Try a different version or loader.
                    </p>
                </div>
                <Button variant="outline" href="/">
                    <ArrowLeftIcon class="mr-1.5 size-3.5" />
                    Try different settings
                </Button>
            </div>
        </div>
    </div>
{/if}
