<script lang="ts">
    import * as Tooltip from '$lib/components/ui/tooltip';
    import { STATUS_COLORS } from '$lib/utils/colors';
    import { cn } from '$lib/utils';

    interface Props {
        status: 'compatible' | 'warning' | 'conflict';
        message?: string;
    }

    let { status, message }: Props = $props();
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
