<script lang="ts">
    import type { DownloadPhase } from '$lib/state/download.svelte';
    import { Button } from '$lib/components/ui/button';
    import { Progress } from '$lib/components/ui/progress';
    import * as Tooltip from '$lib/components/ui/tooltip';
    import { formatSpeed, formatEta } from '$lib/utils/format';
    import { useStableValue } from '$lib/utils/stable-value.svelte';
    import { STATUS_COLORS } from '$lib/utils/colors';
    import { cn } from '$lib/utils';
    import ShareIcon from '@lucide/svelte/icons/share-2';
    import XIcon from '@lucide/svelte/icons/x';
    import LoaderBadge from './LoaderBadge.svelte';

    interface Props {
        resolvedModCount: number;
        unavailableCount: number;
        context: { gameVersion: string; loader: string };
        downloadPhase?: DownloadPhase;
        downloadProgress?: number;
        downloadSpeed?: number;
        downloadEta?: number;
        isMiniProgress?: boolean;
        onCancelDownload?: () => void;
        onShare?: () => void;
        onClickMods?: () => void;
        onClickIssues?: () => void;
    }

    let {
        resolvedModCount,
        unavailableCount,
        context,
        downloadPhase = 'idle',
        downloadProgress = 0,
        downloadSpeed = 0,
        downloadEta = 0,
        isMiniProgress = false,
        onCancelDownload,
        onShare,
        onClickMods,
        onClickIssues
    }: Props = $props();

    let showFullProgress = $derived(
        !isMiniProgress &&
            (downloadPhase === 'downloading' ||
                downloadPhase === 'verifying' ||
                downloadPhase === 'zipping')
    );

    const stableSpeed = useStableValue(() => formatSpeed(downloadSpeed), 1000);
    const stableEta = useStableValue(() => formatEta(downloadEta), 1000);

    let showShareButton = $derived(downloadPhase === 'idle' || downloadPhase === 'complete');
</script>

<div class="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-sm">
    <div class="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        {#if showFullProgress}
            <!-- Download progress mode -->
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
                    <span
                        class="hidden shrink-0 text-xs text-muted-foreground tabular-nums sm:inline"
                    >
                        {stableSpeed()} · ETA {stableEta()}
                    </span>
                {/if}
            </div>
            <Button variant="outline" size="sm" onclick={onCancelDownload}>
                <XIcon class="mr-1.5 size-3.5" />
                Cancel
            </Button>
        {:else}
            <!-- Simplified stats -->
            <div class="flex flex-wrap items-center gap-1.5 text-sm">
                <button
                    class="inline-flex items-center gap-1.5 rounded-sm px-1.5 py-0.5 hover:bg-muted/50"
                    onclick={onClickMods}
                >
                    <span
                        class={cn('size-2 rounded-full', STATUS_COLORS.compatible)}
                        aria-hidden="true"
                    ></span>
                    <span>{resolvedModCount} mods ready</span>
                </button>

                {#if unavailableCount > 0}
                    <span class="text-muted-foreground/40">&middot;</span>
                    <button
                        class="inline-flex items-center gap-1.5 rounded-sm px-1.5 py-0.5 hover:bg-muted/50"
                        onclick={onClickIssues}
                    >
                        <span
                            class={cn('size-2 rounded-full', STATUS_COLORS.warning)}
                            aria-hidden="true"
                        ></span>
                        <span>{unavailableCount} unavailable</span>
                    </button>
                {/if}

                <span class="text-muted-foreground/40">&middot;</span>
                <span class="text-muted-foreground">MC {context.gameVersion}</span>
                <span class="text-muted-foreground/40">&middot;</span>
                <LoaderBadge loaderSlug={context.loader} size="sm" />
            </div>

            <!-- Share -->
            {#if showShareButton}
                <div class="flex items-center gap-2 md:ml-auto">
                    <Tooltip.Root>
                        <Tooltip.Trigger>
                            {#snippet child({ props })}
                                <Button variant="outline" size="sm" {...props} onclick={onShare}>
                                    <ShareIcon class="size-3.5" />
                                    <span class="sr-only">Share</span>
                                </Button>
                            {/snippet}
                        </Tooltip.Trigger>
                        <Tooltip.Content>Share</Tooltip.Content>
                    </Tooltip.Root>
                </div>
            {/if}
        {/if}
    </div>
</div>
