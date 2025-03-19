<script lang="ts">
  import { cn } from '$lib/utils';
  import type { SelectModLoaderItem } from '$state/mod-loader.svelte';

  interface ModLoaderItemProps {
    item: SelectModLoaderItem;
    iconClassNames?: string;
    labelClassNames?: string;
    containerClassNames?: string;
  }

  const { item, iconClassNames, labelClassNames, containerClassNames }: ModLoaderItemProps =
    $props();
</script>

<div
  class={cn(
    'flex items-center justify-start text-center gap-4',
    containerClassNames,
    item.colorClassName
  )}
>
  {#if item.iconSvg}
    <div class={cn('w-4 h-4', iconClassNames)}>{@html item.iconSvg}</div>
  {/if}
  <span class={cn('text-sm', item.value !== '' ? 'font-bold' : '', labelClassNames)}
    >{item.label}</span
  >
</div>
