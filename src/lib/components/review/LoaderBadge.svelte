<script lang="ts">
    import { onMount } from 'svelte';
    import { loadModLoaders, findLoaderBySlug } from '$lib/state/mod-loaders.svelte';
    import { getBadgeClassesByModLoader } from '$lib/utils/colors';
    import { getLoaderDisplayName } from '$lib/utils/format';
    import { Badge } from '$lib/components/ui/badge';
    import { cn } from '$lib/utils';

    interface Props {
        loaderSlug: string;
        size?: 'sm' | 'default';
    }

    let { loaderSlug, size = 'default' }: Props = $props();
    let loaderItem = $derived(findLoaderBySlug(loaderSlug));
    let textSize = $derived(
        size === 'sm' ? 'text-[9px] leading-tight' : 'text-[10px] leading-tight'
    );

    onMount(() => loadModLoaders());
</script>

<Badge variant="secondary" class={cn('gap-1', textSize, getBadgeClassesByModLoader(loaderSlug))}>
    {#if loaderItem?.icon}
        <span class="inline-flex size-3 [&>svg]:size-full">
            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
            {@html loaderItem.icon}
        </span>
    {/if}
    {getLoaderDisplayName(loaderSlug)}
</Badge>
