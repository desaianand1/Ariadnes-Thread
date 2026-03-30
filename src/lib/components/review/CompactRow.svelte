<script lang="ts">
    import type { ResolvedProject, ResolutionWarning } from '$lib/services/types';
    import * as Avatar from '$lib/components/ui/avatar';
    import { Badge } from '$lib/components/ui/badge';
    import { Button } from '$lib/components/ui/button';
    import * as Tooltip from '$lib/components/ui/tooltip';
    import { formatBytes } from '$lib/utils/format';
    import { cn } from '$lib/utils';
    import CheckIcon from '@lucide/svelte/icons/check';
    import AlertTriangleIcon from '@lucide/svelte/icons/triangle-alert';
    import XCircleIcon from '@lucide/svelte/icons/circle-x';
    import XIcon from '@lucide/svelte/icons/x';
    import UndoIcon from '@lucide/svelte/icons/undo-2';

    interface Props {
        project: ResolvedProject;
        warnings: ResolutionWarning[];
        isConflict: boolean;
        alsoIn?: string[];
        loader: string;
        onExclude?: (id: string) => void;
        isExcluded?: boolean;
    }

    // eslint-disable-next-line svelte/no-unused-props
    let { project, warnings, isConflict, onExclude, isExcluded = false }: Props = $props();

    const SIDE_BADGE_CLASSES = {
        client: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
        server: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
        both: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
    } as const;

    let hasWarnings = $derived(warnings.length > 0);
    let projectUrl = $derived(`https://modrinth.com/${project.projectType}/${project.projectSlug}`);
</script>

<div
    class="flex items-center gap-3 rounded-md border px-3 py-2 transition-colors hover:bg-muted/30"
    class:opacity-50={isExcluded}
>
    <!-- Avatar -->
    <Avatar.Root class="size-6 shrink-0 rounded">
        {#if project.iconUrl}
            <Avatar.Image src={project.iconUrl} alt={project.projectTitle} />
        {/if}
        <Avatar.Fallback class="rounded text-[10px]">
            {project.projectTitle.charAt(0)}
        </Avatar.Fallback>
    </Avatar.Root>

    <!-- Title -->
    <a
        href={projectUrl}
        target="_blank"
        rel="noopener noreferrer external"
        class="min-w-0 flex-1 truncate text-sm font-medium hover:underline"
    >
        {project.projectTitle}
    </a>

    <!-- Side badge -->
    <Badge
        variant="secondary"
        class={cn('shrink-0 text-[9px] leading-tight', SIDE_BADGE_CLASSES[project.side])}
    >
        {project.side}
    </Badge>

    <!-- Version -->
    <span class="shrink-0 text-xs text-muted-foreground">{project.versionNumber}</span>

    <!-- File size -->
    <span class="hidden shrink-0 text-xs text-muted-foreground sm:inline">
        {formatBytes(project.fileSize)}
    </span>

    <!-- Status icon -->
    <div class="shrink-0">
        {#if isConflict}
            <Tooltip.Root>
                <Tooltip.Trigger>
                    <XCircleIcon class="size-3.5 text-red-500" />
                </Tooltip.Trigger>
                <Tooltip.Content>Incompatible</Tooltip.Content>
            </Tooltip.Root>
        {:else if hasWarnings}
            <Tooltip.Root>
                <Tooltip.Trigger>
                    <AlertTriangleIcon class="size-3.5 text-yellow-500" />
                </Tooltip.Trigger>
                <Tooltip.Content>{warnings[0].message}</Tooltip.Content>
            </Tooltip.Root>
        {:else}
            <CheckIcon class="size-3.5 text-green-500" />
        {/if}
    </div>

    <!-- Exclude/Restore button -->
    {#if onExclude}
        <Tooltip.Root>
            <Tooltip.Trigger>
                {#if isExcluded}
                    <Button
                        variant="ghost"
                        size="sm"
                        class="size-6 shrink-0 p-0"
                        onclick={() => onExclude(project.projectId)}
                    >
                        <UndoIcon class="size-3.5" />
                    </Button>
                {:else}
                    <Button
                        variant="ghost"
                        size="sm"
                        class="size-6 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                        onclick={() => onExclude(project.projectId)}
                    >
                        <XIcon class="size-3.5" />
                    </Button>
                {/if}
            </Tooltip.Trigger>
            <Tooltip.Content>{isExcluded ? 'Restore' : 'Exclude'}</Tooltip.Content>
        </Tooltip.Root>
    {/if}
</div>
