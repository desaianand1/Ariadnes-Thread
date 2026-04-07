<script lang="ts">
    import { Badge } from '$lib/components/ui/badge';
    import { formatBytes } from '$lib/utils/format';
    import LoaderBadge from './LoaderBadge.svelte';
    import UserIcon from '@lucide/svelte/icons/user';
    import PackageIcon from '@lucide/svelte/icons/package';
    import AlertCircleIcon from '@lucide/svelte/icons/circle-alert';

    interface Props {
        curatorName?: string;
        collectionNames: string;
        gameVersion: string;
        loader: string;
        modCount: number;
        totalSize: number;
        categorySummary: Array<{ category: string; count: number }>;
        unavailableCount: number;
    }

    let {
        curatorName,
        collectionNames,
        gameVersion,
        loader,
        modCount,
        totalSize,
        categorySummary,
        unavailableCount
    }: Props = $props();
</script>

<div class="space-y-3">
    {#if curatorName}
        <div class="flex items-center gap-1.5 text-sm text-muted-foreground">
            <UserIcon class="size-3.5" />
            <span>Shared by <span class="font-medium text-foreground">{curatorName}</span></span>
        </div>
    {/if}

    <div>
        <h1 class="text-2xl font-bold tracking-tight">{collectionNames}</h1>
        <p class="mt-1 text-sm text-muted-foreground">
            for Minecraft {gameVersion} · <LoaderBadge loaderSlug={loader} size="sm" />
        </p>
    </div>

    {#if categorySummary.length > 0}
        <div class="flex flex-wrap gap-1.5">
            {#each categorySummary as { category, count } (category)}
                <Badge variant="secondary" class="text-xs font-normal">
                    {count}
                    {category.toLowerCase()}
                </Badge>
            {/each}
        </div>
    {/if}

    <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
        <span class="inline-flex items-center gap-1.5">
            <PackageIcon class="size-3.5" />
            {modCount} mods · {formatBytes(totalSize)}
        </span>

        {#if unavailableCount > 0}
            <span class="inline-flex items-center gap-1.5 text-yellow-600 dark:text-yellow-400">
                <AlertCircleIcon class="size-3.5" />
                {unavailableCount} mod{unavailableCount === 1 ? '' : 's'} couldn't be resolved for this
                version
            </span>
        {/if}
    </div>
</div>
