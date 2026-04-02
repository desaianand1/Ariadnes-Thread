<script lang="ts">
    import type { Snippet } from 'svelte';
    import { onMount } from 'svelte';
    import * as Dialog from '$lib/components/ui/dialog';
    import * as Drawer from '$lib/components/ui/drawer';
    import { Button } from '$lib/components/ui/button';
    import XIcon from '@lucide/svelte/icons/x';

    interface Props {
        open: boolean;
        title: Snippet;
        description?: Snippet;
        children: Snippet;
        footer?: Snippet;
        onClose: () => void;
        /** Max width class for the dialog (default: "sm:max-w-md") */
        dialogClass?: string;
    }

    let {
        open = $bindable(),
        title,
        description,
        children,
        footer,
        onClose,
        dialogClass = 'sm:max-w-md'
    }: Props = $props();

    let isMobile = $state(false);

    onMount(() => {
        const mql = window.matchMedia('(max-width: 639px)');
        isMobile = mql.matches;
        const handler = (e: MediaQueryListEvent) => {
            isMobile = e.matches;
        };
        mql.addEventListener('change', handler);
        return () => mql.removeEventListener('change', handler);
    });
</script>

{#if isMobile}
    <Drawer.Root bind:open {onClose}>
        <Drawer.Content>
            <Drawer.Header class="flex items-center justify-between">
                <div>
                    <Drawer.Title>{@render title()}</Drawer.Title>
                    {#if description}
                        <Drawer.Description>{@render description()}</Drawer.Description>
                    {/if}
                </div>
                <Drawer.Close>
                    <Button variant="ghost" size="icon" class="shrink-0">
                        <XIcon class="size-4" />
                        <span class="sr-only">Close</span>
                    </Button>
                </Drawer.Close>
            </Drawer.Header>
            <div class="px-4 pb-4">
                {@render children()}
                {#if footer}
                    <div class="flex flex-col gap-2 pt-4">
                        {@render footer()}
                    </div>
                {/if}
            </div>
        </Drawer.Content>
    </Drawer.Root>
{:else}
    <Dialog.Root bind:open onOpenChange={(v) => !v && onClose()}>
        <Dialog.Content class={dialogClass}>
            <Dialog.Header>
                <Dialog.Title>{@render title()}</Dialog.Title>
                {#if description}
                    <Dialog.Description>{@render description()}</Dialog.Description>
                {/if}
            </Dialog.Header>
            <div class="px-0 pb-0">
                {@render children()}
            </div>
            {#if footer}
                <Dialog.Footer>
                    {@render footer()}
                </Dialog.Footer>
            {/if}
        </Dialog.Content>
    </Dialog.Root>
{/if}
