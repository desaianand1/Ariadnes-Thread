<script lang="ts">
    import type { AutoResolvedItem } from '$lib/services/review-resolution';
    import { Badge } from '$lib/components/ui/badge';
    import ModAvatar from './ModAvatar.svelte';
    import SideBadge from './SideBadge.svelte';
    import LoaderBadge from './LoaderBadge.svelte';
    import { VERSION_TYPE_BADGE_CLASSES } from '$lib/utils/colors';
    import { capitalize, formatBytes, getLoaderDisplayName } from '$lib/utils/format';
    import { cn } from '$lib/utils';

    interface Props {
        item: AutoResolvedItem;
        loader: string;
    }

    let { item, loader }: Props = $props();
</script>

<div
    class={cn(
        'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm',
        item.type === 'auto-excluded' && 'opacity-50'
    )}
>
    <ModAvatar
        iconUrl={item.iconUrl}
        title={item.projectTitle}
        size="sm"
        rounding="rounded-md"
        class="shrink-0"
    />

    <span
        class={cn('min-w-0 truncate font-medium', item.type === 'auto-excluded' && 'line-through')}
    >
        {item.projectTitle}
    </span>

    <div class="hidden shrink-0 items-center gap-1 sm:flex">
        {#if item.side}
            <SideBadge side={item.side} size="sm" />
        {/if}
        {#if item.resolvedLoader}
            <LoaderBadge loaderSlug={item.resolvedLoader} size="sm" />
        {:else}
            <LoaderBadge loaderSlug={loader} size="sm" />
        {/if}
    </div>

    <!-- Resolution tag -->
    {#if item.type === 'fallback' && item.resolvedLoader}
        <Badge variant="outline" class="shrink-0 text-[10px] leading-tight">
            via {getLoaderDisplayName(item.resolvedLoader)}
        </Badge>
    {:else if item.type === 'beta-version' && item.versionType}
        <Badge
            variant="secondary"
            class={cn(
                'shrink-0 text-[10px] leading-tight',
                VERSION_TYPE_BADGE_CLASSES[item.versionType]
            )}
        >
            {capitalize(item.versionType)}
        </Badge>
    {:else if item.type === 'auto-excluded'}
        <Badge variant="secondary" class="shrink-0 text-[10px] leading-tight opacity-70"
            >auto-excluded</Badge
        >
    {/if}

    <div class="ml-auto hidden shrink-0 items-center gap-3 text-xs text-muted-foreground md:flex">
        {#if item.versionNumber}
            <Badge variant="outline" class="font-mono text-[10px] leading-tight"
                >{item.versionNumber}</Badge
            >
        {/if}
        {#if item.fileSize}
            <span>{formatBytes(item.fileSize)}</span>
        {/if}
    </div>
</div>
