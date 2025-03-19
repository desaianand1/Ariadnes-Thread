<script lang="ts">
  import { cn } from '$lib/utils';
  import type { SelectMinecraftVersionItem } from '$state/minecraft-version.svelte';
  import { Badge } from '$ui/badge';

  interface MinecraftVersionItemProps {
    item: SelectMinecraftVersionItem;
    containerClassNames?: string;
    badgeClassNames?: string;
    labelClassNames?: string;
  }
  const { item, badgeClassNames, labelClassNames, containerClassNames }: MinecraftVersionItemProps =
    $props();

  function getVersionTypeStyle(versionType: SelectMinecraftVersionItem['versionType']): string {
    const styles: Record<SelectMinecraftVersionItem['versionType'], string> = {
      alpha:
        'bg-rose-300/20 hover:bg-rose-300/20 text-rose-600 dark:bg-rose-600/20 dark:hover:bg-rose-600/20 dark:ring-rose-600',
      beta: 'bg-cyan-300/20 hover:bg-cyan-300/20 text-cyan-600 dark:bg-cyan-600/20 dark:hover:bg-cyan-600/20 dark:ring-cyan-600',
      snapshot:
        'bg-amber-300/20 hover:bg-amber-300/20 text-amber-600 dark:bg-amber-600/20 dark:hover:bg-amber-600/20 dark:ring-amber-600',
      release:
        'bg-emerald-300/20 hover:bg-emerald-300/20 text-emerald-600 dark:bg-emerald-600/20 dark:hover:bg-emerald-600/20 dark:ring-emerald-600'
    };
    return styles[versionType] || '';
  }
</script>

<div class={cn('flex items-center justify-start text-center gap-4', containerClassNames)}>
  {#if item.value !== ''}
    <Badge
      class={cn(
        'max-w-24 w-20 truncate justify-center dark:ring-1 shadow-none',
        getVersionTypeStyle(item.versionType),
        badgeClassNames
      )}
    >
      {item.versionType}
    </Badge>
  {/if}
  <span
    class={cn(
      'text-sm tracking-widest max-w-24 truncate',
      item.value !== '' ? 'font-bold' : '',
      labelClassNames
    )}>{item.label}</span
  >
</div>
