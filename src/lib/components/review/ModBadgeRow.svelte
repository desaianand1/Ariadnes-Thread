<script lang="ts">
    import type { ResolvedProject } from '$lib/services/types';
    import { Badge } from '$lib/components/ui/badge';
    import SideBadge from './SideBadge.svelte';
    import LoaderBadge from './LoaderBadge.svelte';
    import { VERSION_TYPE_BADGE_CLASSES } from '$lib/utils/colors';
    import { capitalize, getLoaderDisplayName } from '$lib/utils/format';
    import { cn } from '$lib/utils';

    interface Props {
        project: ResolvedProject;
        loader: string;
        size?: 'sm' | 'default';
        class?: string;
    }

    let { project, loader, size = 'default', class: className }: Props = $props();

    let badgeTextSize = $derived(
        size === 'sm' ? 'text-[9px] leading-tight' : 'text-[10px] leading-tight'
    );
</script>

<div class={cn('flex flex-wrap items-center gap-1', className)}>
    <SideBadge side={project.side} {size} />
    {#each project.loaders.filter((l) => l === loader || project.usedFallbackLoader) as loaderName (loaderName)}
        <LoaderBadge loaderSlug={loaderName} {size} />
    {/each}

    {#if project.versionType !== 'release'}
        <Badge
            variant="secondary"
            class={cn(badgeTextSize, VERSION_TYPE_BADGE_CLASSES[project.versionType])}
        >
            {capitalize(project.versionType)}
        </Badge>
    {/if}

    {#if project.usedFallbackLoader && project.resolvedLoader}
        <Badge variant="outline" class={badgeTextSize}>
            via {getLoaderDisplayName(project.resolvedLoader)}
        </Badge>
    {/if}
</div>
