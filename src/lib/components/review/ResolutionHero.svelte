<script lang="ts">
    import type { ResolutionState, SideStats } from '$lib/services/review-resolution';
    import {
        computeDonutSegments,
        computeResolutionPercentage
    } from '$lib/services/review-resolution';
    import type { AlternativeProbe } from '$lib/services/types';
    import * as Chart from '$lib/components/ui/chart';
    import { PieChart, Text } from 'layerchart';
    import { Button } from '$lib/components/ui/button';
    import * as Tooltip from '$lib/components/ui/tooltip';
    import LoaderBadge from './LoaderBadge.svelte';
    import { formatBytes, getLoaderDisplayName, capitalize } from '$lib/utils/format';
    import { cn } from '$lib/utils';
    import { getResolutionPercentageColor } from '$lib/utils/colors';
    import { Skeleton } from '$lib/components/ui/skeleton';
    import InlineLoaderIcon from './InlineLoaderIcon.svelte';
    import DownloadIcon from '@lucide/svelte/icons/download';
    import ShareIcon from '@lucide/svelte/icons/share-2';
    import LightbulbIcon from '@lucide/svelte/icons/lightbulb';
    import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
    import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
    import BadgeCheckIcon from '@lucide/svelte/icons/badge-check';
    import PackageXIcon from '@lucide/svelte/icons/package-x';
    import { slide } from 'svelte/transition';
    import { safeTransition } from '$lib/utils/motion';

    type AdvisorStatus = 'loading' | 'found' | 'no_improvement' | 'no_issues' | 'error';

    interface Props {
        resolutionState: ResolutionState;
        resolvedModCount: number;
        dependencyCount: number;
        autoFixedCount: number;
        unavailableCount: number;
        gameVersion: string;
        loader: string;
        sideStats: { client: SideStats; server: SideStats; total: SideStats };
        hasClientMods: boolean;
        hasServerMods: boolean;
        collectionNames?: string;
        bestAlternative: AlternativeProbe | null;
        showAdvisor: boolean;
        advisorLoading?: boolean;
        advisorStatus?: AdvisorStatus;
        modpackSkippedCount?: number;
        excludedCount?: number;
        onAdvisorSwitch: () => void;
        onStartDownload: (side: 'client' | 'server') => void;
        onShare: () => void;
    }

    let {
        resolutionState,
        resolvedModCount,
        dependencyCount,
        autoFixedCount,
        unavailableCount,
        gameVersion,
        loader,
        sideStats,
        hasClientMods,
        hasServerMods,
        collectionNames,
        bestAlternative,
        showAdvisor,
        advisorLoading = false,
        advisorStatus = 'loading',
        modpackSkippedCount = 0,
        excludedCount = 0,
        onAdvisorSwitch,
        onStartDownload,
        onShare
    }: Props = $props();

    let percentage = $derived(
        computeResolutionPercentage(resolvedModCount, resolvedModCount + unavailableCount)
    );

    let collectionModCount = $derived(resolvedModCount - dependencyCount);
    let chartData = $derived(
        computeDonutSegments(collectionModCount, dependencyCount, autoFixedCount, unavailableCount)
    );

    const chartConfig = {
        resolved: { label: capitalize('resolved'), color: 'var(--chart-resolved)' },
        dependencies: { label: capitalize('dependencies'), color: 'var(--chart-dependencies)' },
        autofixed: { label: 'Auto-fixed', color: 'var(--chart-autofixed)' },
        unavailable: { label: capitalize('unavailable'), color: 'var(--chart-unavailable)' }
    } satisfies Chart.ChartConfig;

    // Subtext parts for hasIssues state
    let subtextParts = $derived.by(() => {
        const parts: string[] = [];
        if (dependencyCount > 0) {
            parts.push(
                `${dependencyCount} required ${dependencyCount === 1 ? 'library' : 'libraries'} added`
            );
        }
        if (autoFixedCount > 0) {
            parts.push(`${autoFixedCount} ${autoFixedCount === 1 ? 'issue' : 'issues'} auto-fixed`);
        }
        return parts;
    });

    let advisorVersionChanged = $derived(
        bestAlternative ? bestAlternative.version !== gameVersion : false
    );
    let advisorLoaderChanged = $derived(
        bestAlternative ? bestAlternative.loader !== loader : false
    );
</script>

{#snippet advisorLoaderSkeleton()}
    <div class="flex items-center gap-3 rounded-lg border px-4 py-3">
        <Skeleton class="size-5 shrink-0 rounded-full" />
        <p class="flex-1 animate-pulse text-sm text-muted-foreground">
            Checking for better configurations…
        </p>
        <Skeleton class="h-8 w-16 rounded-md" />
    </div>
{/snippet}

{#snippet advisorCallout()}
    {#if bestAlternative}
        <div
            class="flex items-center gap-3 rounded-lg border border-teal-200 bg-teal-50/50 px-4 py-3 dark:border-teal-800 dark:bg-teal-950/20"
            transition:slide={safeTransition({ duration: 200 })}
        >
            <LightbulbIcon class="size-5 shrink-0 text-teal-600 dark:text-teal-400" />
            <p class="flex-1 text-sm text-teal-800 dark:text-teal-200">
                {#if advisorVersionChanged && advisorLoaderChanged}
                    Minecraft {bestAlternative.version} + <InlineLoaderIcon
                        loaderSlug={bestAlternative.loader}
                        class="size-3.5"
                    />
                    {getLoaderDisplayName(bestAlternative.loader)} resolves {bestAlternative.netGain}
                    more mod{bestAlternative.netGain === 1 ? '' : 's'} ({bestAlternative.percentage}%
                    total)
                {:else if advisorVersionChanged}
                    Minecraft {bestAlternative.version} resolves {bestAlternative.netGain} more mod{bestAlternative.netGain ===
                    1
                        ? ''
                        : 's'} ({bestAlternative.percentage}% total)
                {:else}
                    <InlineLoaderIcon loaderSlug={bestAlternative.loader} class="size-3.5" />
                    {getLoaderDisplayName(bestAlternative.loader)} resolves {bestAlternative.netGain}
                    more mod{bestAlternative.netGain === 1 ? '' : 's'} ({bestAlternative.percentage}%
                    total)
                {/if}
            </p>
            <Button
                size="sm"
                class="shrink-0 bg-teal-600 text-white hover:bg-teal-700 dark:bg-teal-600 dark:hover:bg-teal-700"
                onclick={onAdvisorSwitch}
            >
                {#if advisorLoaderChanged && !advisorVersionChanged}
                    Switch to <InlineLoaderIcon
                        loaderSlug={bestAlternative.loader}
                        class="size-3"
                    />
                    {getLoaderDisplayName(bestAlternative.loader)}
                {:else}
                    Switch to {bestAlternative.version}
                {/if}
            </Button>
        </div>
    {/if}
{/snippet}

{#if resolutionState === 'noMods'}
    <!-- Empty state -->
    <div class="rounded-lg border border-muted bg-card p-6">
        <div class="flex flex-col items-center gap-4 text-center">
            <PackageXIcon class="size-12 text-muted-foreground" />
            <div>
                {#if modpackSkippedCount > 0 && resolvedModCount === 0 && unavailableCount === 0}
                    <h2 class="text-lg font-semibold">All projects are modpacks</h2>
                    <p class="mt-1 text-sm text-muted-foreground">
                        All {modpackSkippedCount} projects in this collection are modpacks — import them
                        via your launcher directly.
                    </p>
                {:else}
                    <h2 class="text-lg font-semibold">
                        No mods found for {getLoaderDisplayName(loader)}
                        {gameVersion}
                    </h2>
                    <p class="mt-1 text-sm text-muted-foreground">
                        None of the mods in these collections have compatible versions.
                    </p>
                {/if}
            </div>

            {#if advisorLoading}
                <div class="w-full max-w-md">
                    {@render advisorLoaderSkeleton()}
                </div>
            {:else if showAdvisor && bestAlternative}
                <div class="w-full max-w-md">
                    {@render advisorCallout()}
                </div>
            {:else}
                <Button variant="outline" href="/">
                    <ArrowLeftIcon class="mr-1.5 size-3.5" />
                    Try different settings
                </Button>
            {/if}
        </div>
    </div>
{:else}
    <!-- allClear / hasIssues -->
    <div
        class={cn(
            'rounded-lg border bg-card p-6',
            resolutionState === 'allClear' &&
                'border-emerald-200 bg-emerald-50/30 dark:border-emerald-800 dark:bg-emerald-950/10'
        )}
    >
        <div class="flex flex-col items-center gap-6 md:flex-row md:items-start">
            <!-- Donut chart -->
            <div class="w-30 shrink-0 md:w-35">
                <Chart.Container config={chartConfig} class="aspect-square w-full">
                    <PieChart
                        data={chartData}
                        key="category"
                        value="count"
                        c="color"
                        innerRadius={resolutionState === 'allClear' ? 42 : 38}
                        padding={4}
                        props={{ pie: { sort: null } }}
                    >
                        {#snippet aboveMarks()}
                            <Text
                                value="{percentage}%"
                                textAnchor="middle"
                                verticalAnchor="middle"
                                class="{getResolutionPercentageColor(
                                    percentage
                                )} text-2xl! font-bold"
                                dy={-4}
                            />
                            <Text
                                value="resolved"
                                textAnchor="middle"
                                verticalAnchor="middle"
                                class="fill-muted-foreground! text-xs!"
                                dy={14}
                            />
                        {/snippet}
                        {#snippet tooltip()}
                            <Chart.Tooltip nameKey="category" hideLabel />
                        {/snippet}
                    </PieChart>
                </Chart.Container>
            </div>

            <!-- Content -->
            <div class="min-w-0 flex-1 space-y-4 text-center md:text-left">
                <div>
                    {#if resolutionState === 'allClear'}
                        <div class="flex items-center justify-center gap-2 md:justify-start">
                            <CircleCheckIcon
                                class="size-5 text-emerald-600 dark:text-emerald-400"
                            />
                            <h2 class="text-lg font-semibold">
                                All {resolvedModCount} mods ready to download
                            </h2>
                        </div>
                        <p class="mt-1 text-sm text-muted-foreground">
                            {#if dependencyCount > 0}
                                {dependencyCount} required {dependencyCount === 1
                                    ? 'library'
                                    : 'libraries'} added &middot;
                            {/if}
                            Everything resolved perfectly
                        </p>
                    {:else}
                        <h2 class="text-lg font-semibold">
                            {resolvedModCount} mods ready to download
                        </h2>
                        {#if subtextParts.length > 0}
                            <p class="mt-1 text-sm text-muted-foreground">
                                {subtextParts.join(' · ')}
                            </p>
                        {/if}
                    {/if}

                    <p
                        class="mt-1 flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground md:justify-start"
                    >
                        <span>Minecraft {gameVersion}</span>
                        <span class="opacity-40">&middot;</span>
                        <LoaderBadge loaderSlug={loader} size="sm" />
                        <span class="opacity-40">&middot;</span>
                        <span>{formatBytes(sideStats.total.downloadSize)} total</span>
                    </p>

                    {#if collectionNames}
                        <p class="mt-0.5 text-xs text-muted-foreground/60">
                            From: {collectionNames}
                        </p>
                    {/if}
                    {#if excludedCount > 0}
                        <p class="mt-0.5 text-xs text-muted-foreground/60">
                            {excludedCount} mod{excludedCount === 1 ? '' : 's'} excluded from download
                        </p>
                    {/if}
                </div>

                <!-- Download + Share buttons -->
                <div
                    class="flex flex-col items-center gap-3 sm:flex-row sm:flex-wrap md:items-start"
                >
                    {#if hasClientMods}
                        <div class="flex flex-col items-center md:items-start">
                            <Tooltip.Root>
                                <Tooltip.Trigger>
                                    {#snippet child({ props })}
                                        <Button
                                            size="lg"
                                            class="bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700"
                                            {...props}
                                            onclick={() => onStartDownload('client')}
                                        >
                                            <DownloadIcon class="mr-1.5 size-4" />
                                            Download Mods
                                        </Button>
                                    {/snippet}
                                </Tooltip.Trigger>
                                <Tooltip.Content
                                    >Mods for playing Minecraft on your computer</Tooltip.Content
                                >
                            </Tooltip.Root>
                            <span class="mt-1 pl-1 text-xs text-muted-foreground/70">
                                {sideStats.client.count} mods &middot; {formatBytes(
                                    sideStats.client.downloadSize
                                )}
                            </span>
                        </div>
                    {/if}
                    {#if hasServerMods}
                        <div class="flex flex-col items-center md:items-start">
                            <Tooltip.Root>
                                <Tooltip.Trigger>
                                    {#snippet child({ props })}
                                        <Button
                                            variant="outline"
                                            size="lg"
                                            class="border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
                                            {...props}
                                            onclick={() => onStartDownload('server')}
                                        >
                                            <DownloadIcon class="mr-1.5 size-4" />
                                            Download Server Mods
                                        </Button>
                                    {/snippet}
                                </Tooltip.Trigger>
                                <Tooltip.Content
                                    >Mods for running a dedicated Minecraft server</Tooltip.Content
                                >
                            </Tooltip.Root>
                            <span class="mt-1 pl-1 text-xs text-muted-foreground/70">
                                {sideStats.server.count} mods &middot; {formatBytes(
                                    sideStats.server.downloadSize
                                )}
                            </span>
                        </div>
                    {/if}
                    <div class="sm:ml-auto">
                        <Tooltip.Root>
                            <Tooltip.Trigger>
                                {#snippet child({ props })}
                                    <Button
                                        variant="outline"
                                        size="lg"
                                        class="px-3"
                                        {...props}
                                        onclick={onShare}
                                    >
                                        <ShareIcon class="size-4" />
                                        <span class="sr-only">Share</span>
                                    </Button>
                                {/snippet}
                            </Tooltip.Trigger>
                            <Tooltip.Content>Share</Tooltip.Content>
                        </Tooltip.Root>
                    </div>
                </div>

                <!-- Advisor callout -->
                {#if advisorLoading && resolutionState === 'hasIssues'}
                    {@render advisorLoaderSkeleton()}
                {:else if showAdvisor && bestAlternative}
                    {@render advisorCallout()}
                {:else if resolutionState === 'hasIssues' && advisorStatus === 'no_improvement'}
                    <div
                        class="flex items-center gap-2 rounded-lg border border-emerald-200/60 bg-emerald-50/30 px-4 py-2.5 dark:border-emerald-800/40 dark:bg-emerald-950/10"
                    >
                        <BadgeCheckIcon
                            class="size-4 shrink-0 text-emerald-600/70 dark:text-emerald-400/70"
                        />
                        <p class="text-sm text-emerald-700/80 dark:text-emerald-300/80">
                            This is the best configuration for your mods
                        </p>
                    </div>
                {/if}
            </div>
        </div>
    </div>
{/if}
