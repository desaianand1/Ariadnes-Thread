<script lang="ts">
    import type { FileProgress } from '$lib/state/download.svelte';
    import * as Avatar from '$lib/components/ui/avatar';
    import { Badge } from '$lib/components/ui/badge';
    import { Progress } from '$lib/components/ui/progress';
    import * as Tooltip from '$lib/components/ui/tooltip';
    import { formatBytes } from '$lib/utils/format';
    import CheckIcon from '@lucide/svelte/icons/check';
    import LoaderIcon from '@lucide/svelte/icons/loader';
    import AlertCircleIcon from '@lucide/svelte/icons/circle-alert';
    import ClockIcon from '@lucide/svelte/icons/clock';

    interface Props {
        file: FileProgress;
    }

    let { file }: Props = $props();

    let progressPercent = $derived(
        file.fileSize > 0 ? Math.round((file.bytesDownloaded / file.fileSize) * 100) : 0
    );
</script>

<div class="flex items-center gap-3 rounded-md border px-3 py-2">
    <!-- Avatar -->
    <Avatar.Root class="size-6 shrink-0 rounded">
        {#if file.iconUrl}
            <Avatar.Image src={file.iconUrl} alt={file.projectTitle} />
        {/if}
        <Avatar.Fallback class="rounded text-[10px]">
            {file.projectTitle.charAt(0)}
        </Avatar.Fallback>
    </Avatar.Root>

    <!-- Title -->
    <span class="min-w-0 flex-1 truncate text-sm font-medium">
        {file.projectTitle}
    </span>

    <!-- Status -->
    <div class="flex shrink-0 items-center gap-2">
        {#if file.status === 'queued'}
            <Badge variant="outline" class="gap-1 text-xs text-muted-foreground">
                <ClockIcon class="size-3" />
                Queued
            </Badge>
        {:else if file.status === 'downloading'}
            <div class="flex items-center gap-2">
                <Progress value={progressPercent} class="h-1.5 w-20" />
                <span class="w-8 text-right text-xs text-muted-foreground tabular-nums">
                    {progressPercent}%
                </span>
            </div>
        {:else if file.status === 'verifying'}
            <Badge variant="outline" class="gap-1 text-xs text-yellow-600 dark:text-yellow-400">
                <LoaderIcon class="size-3 animate-spin" />
                Verifying
            </Badge>
        {:else if file.status === 'complete'}
            <CheckIcon class="size-4 text-green-500" />
        {:else if file.status === 'error'}
            <Tooltip.Root>
                <Tooltip.Trigger>
                    <Badge variant="destructive" class="gap-1 text-xs">
                        <AlertCircleIcon class="size-3" />
                        Failed
                    </Badge>
                </Tooltip.Trigger>
                <Tooltip.Content>{file.error ?? 'Unknown error'}</Tooltip.Content>
            </Tooltip.Root>
        {/if}
    </div>

    <!-- File size -->
    <span class="hidden shrink-0 text-xs text-muted-foreground sm:inline">
        {formatBytes(file.fileSize)}
    </span>
</div>
