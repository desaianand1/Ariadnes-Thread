<script lang="ts">
    import type { ResolvedProject, ResolutionWarning } from '$lib/services/types';
    import { deriveModStatus } from '$lib/services/review-resolution';
    import ModAvatar from './ModAvatar.svelte';
    import ExcludeConfirmDialog from './ExcludeConfirmDialog.svelte';
    import { Badge } from '$lib/components/ui/badge';
    import { Button } from '$lib/components/ui/button';
    import SideBadge from './SideBadge.svelte';
    import LoaderBadge from './LoaderBadge.svelte';
    import StatusIndicator from './StatusIndicator.svelte';
    import { formatBytes, formatVersionNumber } from '$lib/utils/format';
    import { cn } from '$lib/utils';
    import EyeOffIcon from '@lucide/svelte/icons/eye-off';
    import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw';
    import FileIcon from '@lucide/svelte/icons/file';

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

    let modStatus = $derived(deriveModStatus(isConflict, warnings));
    let status = $derived(modStatus.status);
    let statusMessage = $derived(modStatus.statusMessage);
    let borderClass = $derived(modStatus.borderClass);

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
    onkeydown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect?.(project);
        }
    }}
>
    <!-- Status dot -->
    <StatusIndicator {status} message={statusMessage} />

    <!-- Avatar -->
    <ModAvatar iconUrl={project.iconUrl} title={project.projectTitle} size="md" class="shrink-0" />

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
            {#if project.dependencyOf && collectionName}
                <span class="hidden shrink-0 text-muted-foreground/70 sm:inline"
                    >required by: {collectionName}</span
                >
            {:else if collectionName}
                <span class="hidden shrink-0 sm:inline">from {collectionName}</span>
            {/if}
        </div>
    </div>

    <!-- Right side metadata -->
    <Badge
        variant="outline"
        class="hidden shrink-0 font-mono text-[10px] leading-tight md:inline-flex"
    >
        {formatVersionNumber(project.versionNumber)}
    </Badge>
    <span class="hidden shrink-0 items-center gap-1 text-xs text-muted-foreground md:inline-flex">
        <FileIcon class="size-3" />
        {formatBytes(project.fileSize)}
    </span>

    <!-- Action button -->
    {#if onExclude}
        {#if isExcluded}
            <Button
                variant="ghost"
                size="sm"
                class="size-9 shrink-0 p-0 sm:size-7"
                onclick={() => onExclude(project.projectId)}
            >
                <RotateCcwIcon class="size-3.5" />
                <span class="sr-only">Restore</span>
            </Button>
        {:else}
            <ExcludeConfirmDialog
                projectTitle={project.projectTitle}
                onConfirm={() => onExclude(project.projectId)}
            >
                {#snippet trigger({ props })}
                    <Button
                        variant="ghost"
                        size="sm"
                        class="size-9 shrink-0 p-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive sm:size-7"
                        {...props}
                    >
                        <EyeOffIcon class="size-3.5" />
                        <span class="sr-only">Exclude</span>
                    </Button>
                {/snippet}
            </ExcludeConfirmDialog>
        {/if}
    {/if}
</div>
