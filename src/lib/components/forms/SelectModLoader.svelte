<script lang="ts">
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';
    import * as Popover from '$lib/components/ui/popover';
    import * as Command from '$lib/components/ui/command';
    import * as Drawer from '$lib/components/ui/drawer';
    import { Button } from '$lib/components/ui/button';
    import { Spinner } from '$lib/components/ui/spinner';
    import { loaderState, loadModLoaders, getGroupedLoaders } from '$lib/state/mod-loaders.svelte';
    import { cn } from '$lib/utils';
    import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';

    interface Props {
        value?: string;
        onValueChange?: (value: string) => void;
        disabled?: boolean;
        id?: string;
        error?: boolean;
    }

    let {
        value = $bindable(),
        onValueChange,
        disabled = false,
        id,
        error = false
    }: Props = $props();

    let grouped = $derived(getGroupedLoaders());
    let selectedLoader = $derived(loaderState.loaders.find((l) => l.slug === value));
    let open = $state(false);
    let isDesktop = $state(true);

    onMount(() => {
        loadModLoaders();
        isDesktop = window.innerWidth >= 768;
    });

    function onResize() {
        if (browser) {
            isDesktop = window.innerWidth >= 768;
        }
    }

    function handleSelect(selectedSlug: string) {
        value = selectedSlug;
        onValueChange?.(selectedSlug);
        open = false;
    }
</script>

<svelte:window onresize={onResize} />

{#snippet loaderItem(loader: (typeof loaderState.loaders)[0])}
    <Command.Item value={loader.slug} onSelect={() => handleSelect(loader.slug)}>
        <span
            class={cn(
                'flex items-center gap-2 [&_svg]:fill-current [&_svg]:!text-inherit',
                loader.colorClass
            )}
        >
            <span aria-hidden="true">{@html loader.icon}</span>
            {loader.name}
        </span>
    </Command.Item>
{/snippet}

{#snippet loaderList()}
    <Command.Root>
        <Command.List class="max-h-60">
            <Command.Empty>No loader found.</Command.Empty>

            {#if grouped.popular.length > 0}
                <Command.Group heading="Popular">
                    {#each grouped.popular as loader (loader.slug)}
                        {@render loaderItem(loader)}
                    {/each}
                </Command.Group>
                <Command.Separator />
            {/if}

            {#if grouped.other.length > 0}
                <Command.Group heading="Other">
                    {#each grouped.other as loader (loader.slug)}
                        {@render loaderItem(loader)}
                    {/each}
                </Command.Group>
            {/if}

            {#if grouped.plugins.length > 0}
                <Command.Separator />
                <Command.Group heading="Server Plugins">
                    {#each grouped.plugins as loader (loader.slug)}
                        {@render loaderItem(loader)}
                    {/each}
                </Command.Group>
            {/if}
        </Command.List>
    </Command.Root>
{/snippet}

{#snippet triggerContent()}
    {#if loaderState.isLoading}
        <span class="flex items-center gap-2">
            <Spinner class="size-4" />
            <span class="text-muted-foreground">Loading...</span>
        </span>
    {:else if selectedLoader}
        <span
            class={cn(
                'flex items-center gap-2 [&_svg]:fill-current [&_svg]:text-inherit!',
                selectedLoader.colorClass
            )}
        >
            <span aria-hidden="true">{@html selectedLoader.icon}</span>
            {selectedLoader.name}
        </span>
    {:else}
        <span class="text-muted-foreground">Select Mod Loader</span>
    {/if}
    <ChevronsUpDownIcon class="ml-auto size-4 shrink-0 opacity-50" />
{/snippet}

{#if isDesktop}
    <Popover.Root bind:open>
        <Popover.Trigger class="w-full min-w-50 justify-between">
            {#snippet child({ props })}
                <Button
                    {id}
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    aria-label="Select mod loader"
                    class={cn('w-full min-w-50 justify-between', error && 'border-destructive')}
                    {disabled}
                    {...props}
                >
                    {@render triggerContent()}
                </Button>
            {/snippet}
        </Popover.Trigger>
        <Popover.Content class="w-(--bits-popover-anchor-width) p-0" align="start">
            {@render loaderList()}
        </Popover.Content>
    </Popover.Root>
{:else}
    <Drawer.Root bind:open>
        <Drawer.Trigger class="w-full min-w-50 justify-between">
            {#snippet child({ props })}
                <Button
                    {id}
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    aria-label="Select mod loader"
                    class={cn('w-full min-w-50 justify-between', error && 'border-destructive')}
                    {disabled}
                    {...props}
                >
                    {@render triggerContent()}
                </Button>
            {/snippet}
        </Drawer.Trigger>
        <Drawer.Content>
            <Drawer.Header>
                <Drawer.Title>Select Mod Loader</Drawer.Title>
            </Drawer.Header>
            <div class="p-4 pt-0">
                {@render loaderList()}
            </div>
        </Drawer.Content>
    </Drawer.Root>
{/if}
