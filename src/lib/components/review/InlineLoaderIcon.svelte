<script lang="ts">
    import { onMount } from 'svelte';
    import { loadModLoaders, findLoaderBySlug } from '$lib/state/mod-loaders.svelte';
    import { cn } from '$lib/utils';

    interface Props {
        loaderSlug: string;
        class?: string;
    }

    let { loaderSlug, class: className }: Props = $props();
    let loaderItem = $derived(findLoaderBySlug(loaderSlug));

    onMount(() => loadModLoaders());
</script>

{#if loaderItem?.icon}
    <span class={cn('inline-flex items-center', className ?? 'size-3.5')} aria-hidden="true">
        <span class="inline-flex size-full [&>svg]:size-full">
            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
            {@html loaderItem.icon}
        </span>
    </span>
{/if}
