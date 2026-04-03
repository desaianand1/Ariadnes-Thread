<script lang="ts">
    import { Button } from '$lib/components/ui/button';
    import * as Tooltip from '$lib/components/ui/tooltip';
    import CopyIcon from '@lucide/svelte/icons/copy';
    import CheckIcon from '@lucide/svelte/icons/check';

    interface Props {
        value: string;
    }

    let { value }: Props = $props();

    let copied = $state(false);

    async function copy() {
        try {
            await navigator.clipboard.writeText(value);
        } catch {
            const textarea = document.createElement('textarea');
            textarea.value = value;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
        }
        copied = true;
        setTimeout(() => (copied = false), 2000);
    }
</script>

<Tooltip.Root>
    <Tooltip.Trigger>
        {#snippet child({ props })}
            <Button
                variant="outline"
                size="sm"
                class="h-auto gap-1.5 px-2 py-0.5 font-mono text-xs"
                onclick={copy}
                {...props}
            >
                <code class="min-w-0 truncate">{value}</code>
                {#if copied}
                    <CheckIcon class="size-3 shrink-0 text-emerald-500" />
                {:else}
                    <CopyIcon class="size-3 shrink-0 opacity-50" />
                {/if}
            </Button>
        {/snippet}
    </Tooltip.Trigger>
    <Tooltip.Content>
        {copied ? 'Copied!' : 'Click to copy path'}
    </Tooltip.Content>
</Tooltip.Root>
