<script lang="ts">
    import type { ResolvedProject, ResolutionWarning } from '$lib/services/types';
    import { Button } from '$lib/components/ui/button';
    import * as Card from '$lib/components/ui/card';
    import * as Avatar from '$lib/components/ui/avatar';
    import * as Tooltip from '$lib/components/ui/tooltip';
    import SideBadge from './SideBadge.svelte';
    import LoaderBadge from './LoaderBadge.svelte';
    import StatusIndicator from './StatusIndicator.svelte';
    import { VERSION_TYPE_BADGE_CLASSES } from '$lib/utils/colors';
    import { formatBytes, getLoaderDisplayName } from '$lib/utils/format';
    import { Badge } from '$lib/components/ui/badge';
    import { cn } from '$lib/utils';
    import { fade, fly } from 'svelte/transition';
    import EyeOffIcon from '@lucide/svelte/icons/eye-off';
    import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw';
    import ExternalLinkIcon from '@lucide/svelte/icons/external-link';

    interface Props {
        project: ResolvedProject;
        warnings: ResolutionWarning[];
        isConflict: boolean;
        alsoIn?: string[];
        loader: string;
        index?: number;
        onExclude?: (id: string) => void;
        isExcluded?: boolean;
        onSelect?: (project: ResolvedProject) => void;
    }

    let {
        project,
        warnings,
        isConflict,
        alsoIn,
        loader,
        index = 0,
        onExclude,
        isExcluded = false,
        onSelect
    }: Props = $props();

    let hasWarnings = $derived(warnings.length > 0);
    let projectUrl = $derived(`https://modrinth.com/${project.projectType}/${project.projectSlug}`);

    let status = $derived<'compatible' | 'warning' | 'conflict'>(
        isConflict ? 'conflict' : hasWarnings ? 'warning' : 'compatible'
    );
    let statusMessage = $derived(
        isConflict ? 'Incompatible' : hasWarnings ? warnings[0].message : undefined
    );
    let borderClass = $derived(
        isConflict
            ? 'border-l-2 border-l-red-400'
            : hasWarnings
              ? 'border-l-2 border-l-yellow-400'
              : ''
    );
</script>

<div
    in:fly={{ y: 10, duration: 200, delay: Math.min(index * 50, 500) }}
    out:fade={{ duration: 150 }}
>
    <Card.Root
        class={cn(
            'relative overflow-hidden transition-shadow hover:shadow-md',
            borderClass,
            isExcluded && 'opacity-50'
        )}
    >
        <Card.Content class="flex gap-3 p-3">
            <!-- Project Icon -->
            <div class="shrink-0">
                <Avatar.Root class="size-10 rounded-lg">
                    {#if project.iconUrl}
                        <Avatar.Image src={project.iconUrl} alt={project.projectTitle} />
                    {/if}
                    <Avatar.Fallback class="rounded-lg text-sm">
                        {project.projectTitle.charAt(0)}
                    </Avatar.Fallback>
                </Avatar.Root>
            </div>

            <!-- Content -->
            <div class="min-w-0 flex-1">
                <!-- Title Row -->
                <div class="flex items-start justify-between gap-2">
                    <div class="flex min-w-0 items-center gap-1.5">
                        <StatusIndicator {status} message={statusMessage} />
                        <a
                            href={projectUrl}
                            target="_blank"
                            rel="noopener noreferrer external"
                            class="truncate font-semibold hover:underline"
                        >
                            {project.projectTitle}
                        </a>
                    </div>

                    <!-- Action buttons -->
                    <div class="flex shrink-0 items-center gap-1">
                        {#if onSelect}
                            <Tooltip.Root>
                                <Tooltip.Trigger>
                                    {#snippet child({ props })}
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            class="size-6 p-0"
                                            onclick={() => onSelect(project)}
                                            {...props}
                                        >
                                            <ExternalLinkIcon class="size-3.5" />
                                        </Button>
                                    {/snippet}
                                </Tooltip.Trigger>
                                <Tooltip.Content>View details</Tooltip.Content>
                            </Tooltip.Root>
                        {/if}
                        {#if onExclude}
                            <Tooltip.Root>
                                <Tooltip.Trigger>
                                    {#snippet child({ props })}
                                        {#if isExcluded}
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                class="size-6 p-0"
                                                onclick={() => onExclude(project.projectId)}
                                                {...props}
                                            >
                                                <RotateCcwIcon class="size-3.5" />
                                            </Button>
                                        {:else}
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                class="size-6 p-0 text-muted-foreground hover:text-destructive"
                                                onclick={() => onExclude(project.projectId)}
                                                {...props}
                                            >
                                                <EyeOffIcon class="size-3.5" />
                                            </Button>
                                        {/if}
                                    {/snippet}
                                </Tooltip.Trigger>
                                <Tooltip.Content
                                    >{isExcluded ? 'Restore' : 'Exclude'}</Tooltip.Content
                                >
                            </Tooltip.Root>
                        {/if}
                    </div>
                </div>

                <!-- Description -->
                {#if project.projectDescription}
                    <p class="line-clamp-1 text-sm text-muted-foreground">
                        {project.projectDescription}
                    </p>
                {/if}

                <!-- Badges Row -->
                <div class="mt-1.5 flex flex-wrap items-center gap-1">
                    <SideBadge side={project.side} size="sm" />
                    {#each project.loaders.filter((l) => l === loader || project.usedFallbackLoader) as loaderName (loaderName)}
                        <LoaderBadge loaderSlug={loaderName} size="sm" />
                    {/each}

                    {#if project.versionType !== 'release'}
                        <Badge
                            variant="secondary"
                            class={cn(
                                'text-[10px] leading-tight',
                                VERSION_TYPE_BADGE_CLASSES[project.versionType]
                            )}
                        >
                            {project.versionType}
                        </Badge>
                    {/if}

                    {#if project.usedFallbackLoader && project.resolvedLoader}
                        <Badge variant="outline" class="text-[10px] leading-tight">
                            via {getLoaderDisplayName(project.resolvedLoader)}
                        </Badge>
                    {/if}
                </div>

                <!-- Metadata Row -->
                <div class="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span>{project.versionNumber || 'Unknown'}</span>
                    <span>&middot;</span>
                    <span>{project.fileSize ? formatBytes(project.fileSize) : 'Unknown size'}</span>
                    {#if project.dependencyCount > 0}
                        <span>&middot;</span>
                        <span>{project.dependencyCount} deps</span>
                    {/if}
                </div>

                <!-- Inline warning -->
                {#if hasWarnings}
                    <div
                        class="mt-1.5 rounded bg-yellow-50 px-2 py-1 text-xs text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400"
                    >
                        {warnings[0].message}
                    </div>
                {/if}

                <!-- Also in -->
                {#if alsoIn && alsoIn.length > 0}
                    <div class="mt-1 text-xs text-muted-foreground">
                        Also in: {alsoIn.join(', ')}
                    </div>
                {/if}
            </div>
        </Card.Content>
    </Card.Root>
</div>
