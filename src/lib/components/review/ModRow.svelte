<script lang="ts">
    import type { ResolvedProject, ResolutionWarning } from '$lib/services/types';
    import * as Avatar from '$lib/components/ui/avatar';
    import * as AlertDialog from '$lib/components/ui/alert-dialog';
    import { Button } from '$lib/components/ui/button';
    import SideBadge from './SideBadge.svelte';
    import LoaderBadge from './LoaderBadge.svelte';
    import StatusIndicator from './StatusIndicator.svelte';
    import { formatBytes } from '$lib/utils/format';
    import { cn } from '$lib/utils';
    import EyeOffIcon from '@lucide/svelte/icons/eye-off';
    import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw';

    interface Props {
        project: ResolvedProject;
        warnings: ResolutionWarning[];
        isConflict: boolean;
        loader: string;
        collectionName?: string;
        isExcluded?: boolean;
        onExclude?: (id: string) => void;
        onSelect?: (project: ResolvedProject) => void;
    }

    let {
        project,
        warnings,
        isConflict,
        loader,
        collectionName,
        isExcluded = false,
        onExclude,
        onSelect
    }: Props = $props();

    let status = $derived<'compatible' | 'warning' | 'conflict'>(
        isConflict ? 'conflict' : warnings.length > 0 ? 'warning' : 'compatible'
    );
    let statusMessage = $derived(
        isConflict ? 'Incompatible' : warnings.length > 0 ? warnings[0].message : undefined
    );
    let borderClass = $derived(
        isConflict
            ? 'border-l-2 border-l-red-400'
            : warnings.length > 0
              ? 'border-l-2 border-l-yellow-400'
              : ''
    );

    function handleRowClick(e: MouseEvent) {
        if (isExcluded) return;
        const target = e.target as HTMLElement;
        if (target.closest('button')) return;
        onSelect?.(project);
    }
</script>

<div
    class={cn(
        'group flex items-center gap-3 rounded-md border px-3 py-2.5 transition-colors',
        borderClass,
        isExcluded ? 'opacity-50' : 'cursor-pointer hover:bg-muted/30'
    )}
    role="button"
    tabindex="0"
    onclick={handleRowClick}
    onkeydown={(e) => e.key === 'Enter' && handleRowClick(e as unknown as MouseEvent)}
>
    <!-- Status dot -->
    <StatusIndicator {status} message={statusMessage} />

    <!-- Avatar -->
    <Avatar.Root class="size-8 shrink-0 rounded-lg">
        {#if project.iconUrl}
            <Avatar.Image src={project.iconUrl} alt={project.projectTitle} />
        {/if}
        <Avatar.Fallback class="rounded-lg text-xs">
            {project.projectTitle.charAt(0)}
        </Avatar.Fallback>
    </Avatar.Root>

    <!-- Content -->
    <div class="min-w-0 flex-1">
        <!-- Row 1: title + badges -->
        <div class="flex items-center gap-2">
            <span class={cn('truncate text-sm font-medium', isExcluded && 'line-through')}>
                {project.projectTitle}
            </span>
            <div class="hidden shrink-0 items-center gap-1.5 sm:flex">
                <SideBadge side={project.side} size="sm" />
                <LoaderBadge loaderSlug={loader} size="sm" />
            </div>
        </div>
        <!-- Row 2: description + metadata -->
        <div class="flex items-center gap-2 text-xs text-muted-foreground">
            <span class="min-w-0 truncate">
                {project.projectDescription || 'No description'}
            </span>
            {#if collectionName}
                <span class="hidden shrink-0 sm:inline">from: {collectionName}</span>
            {/if}
        </div>
    </div>

    <!-- Right side metadata -->
    <span class="hidden shrink-0 font-mono text-xs text-muted-foreground md:inline">
        {project.versionNumber}
    </span>
    <span class="hidden shrink-0 text-xs text-muted-foreground md:inline">
        {formatBytes(project.fileSize)}
    </span>

    <!-- Action button -->
    {#if onExclude}
        {#if isExcluded}
            <Button
                variant="ghost"
                size="sm"
                class="size-7 shrink-0 p-0"
                onclick={() => onExclude(project.projectId)}
            >
                <RotateCcwIcon class="size-3.5" />
                <span class="sr-only">Restore</span>
            </Button>
        {:else}
            <AlertDialog.Root>
                <AlertDialog.Trigger>
                    {#snippet child({ props })}
                        <Button
                            variant="ghost"
                            size="sm"
                            class="size-7 shrink-0 p-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
                            {...props}
                        >
                            <EyeOffIcon class="size-3.5" />
                            <span class="sr-only">Exclude</span>
                        </Button>
                    {/snippet}
                </AlertDialog.Trigger>
                <AlertDialog.Content>
                    <AlertDialog.Header>
                        <AlertDialog.Title>Exclude {project.projectTitle}?</AlertDialog.Title>
                        <AlertDialog.Description>
                            This mod won't be included in the ZIP download. You can restore it
                            anytime from the mod list.
                        </AlertDialog.Description>
                    </AlertDialog.Header>
                    <AlertDialog.Footer>
                        <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
                        <AlertDialog.Action onclick={() => onExclude(project.projectId)}>
                            Exclude
                        </AlertDialog.Action>
                    </AlertDialog.Footer>
                </AlertDialog.Content>
            </AlertDialog.Root>
        {/if}
    {/if}
</div>
