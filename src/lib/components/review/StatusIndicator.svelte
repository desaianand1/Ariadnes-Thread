<script lang="ts">
    import * as Tooltip from '$lib/components/ui/tooltip';
    import { cn } from '$lib/utils';

    interface Props {
        status: 'compatible' | 'warning' | 'conflict';
        message?: string;
    }

    let { status, message }: Props = $props();

    const STATUS_COLORS = {
        compatible: 'bg-emerald-500',
        warning: 'bg-yellow-500',
        conflict: 'bg-red-500'
    } as const;
</script>

{#if message}
    <Tooltip.Root>
        <Tooltip.Trigger>
            <span class={cn('inline-block size-2 shrink-0 rounded-full', STATUS_COLORS[status])}
            ></span>
        </Tooltip.Trigger>
        <Tooltip.Content>{message}</Tooltip.Content>
    </Tooltip.Root>
{:else}
    <span class={cn('inline-block size-2 shrink-0 rounded-full', STATUS_COLORS[status])}></span>
{/if}
