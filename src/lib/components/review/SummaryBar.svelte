<script lang="ts">
    import type { ResolutionStats } from '$lib/services/types';
    import { Badge } from '$lib/components/ui/badge';
    import { Button } from '$lib/components/ui/button';
    import * as Tooltip from '$lib/components/ui/tooltip';
    import { formatBytes, getLoaderDisplayName } from '$lib/utils/format';
    import { getBadgeClassesByModLoader } from '$lib/utils/colors';
    import DownloadIcon from '@lucide/svelte/icons/download';
    import ShareIcon from '@lucide/svelte/icons/share-2';

    interface Props {
        stats: ResolutionStats;
        context: { gameVersion: string; loader: string };
    }

    let { stats, context }: Props = $props();
</script>

<!-- Desktop: sticky top, Mobile: sticky bottom -->
<div
    class="sticky bottom-0 z-40 border-t bg-background/80 backdrop-blur-sm md:top-0 md:bottom-auto md:border-t-0 md:border-b"
>
    <div class="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
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
            <Badge variant="secondary" class={getBadgeClassesByModLoader(context.loader)}>
                {getLoaderDisplayName(context.loader)}
            </Badge>
        </div>

        <!-- Actions -->
        <div class="flex items-center gap-2 md:ml-auto">
            <span class="text-sm text-muted-foreground">{formatBytes(stats.totalDownloadSize)}</span
            >

            <Tooltip.Root>
                <Tooltip.Trigger>
                    <Button size="sm" disabled>
                        <DownloadIcon class="mr-1.5 size-3.5" />
                        Download ZIP
                    </Button>
                </Tooltip.Trigger>
                <Tooltip.Content>Coming in Phase 4</Tooltip.Content>
            </Tooltip.Root>

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
    </div>
</div>
