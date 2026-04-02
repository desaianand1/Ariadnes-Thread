<script lang="ts">
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';
    import * as Popover from '$lib/components/ui/popover';
    import * as Command from '$lib/components/ui/command';
    import * as Drawer from '$lib/components/ui/drawer';
    import { Button } from '$lib/components/ui/button';
    import { Badge } from '$lib/components/ui/badge';
    import { Spinner } from '$lib/components/ui/spinner';
    import { VERSION_TYPE_BADGE_CLASSES } from '$lib/utils/colors';
    import { cn } from '$lib/utils';
    import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
    import {
        versionState,
        loadMinecraftVersions,
        getGroupedVersions
    } from '$lib/state/minecraft-versions.svelte';
    import { capitalize } from '$lib/utils/format';

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

    let grouped = $derived(getGroupedVersions());
    let open = $state(false);
    let isDesktop = $state(true);
    let visibleCount = $state(50);
    let searchQuery = $state('');

    $effect(() => {
        if (open) {
            visibleCount = 50;
            searchQuery = '';
        }
    });

    let displayedOther = $derived.by(() => {
        if (searchQuery.trim()) return grouped.other;
        return grouped.other.slice(0, visibleCount);
    });

    function handleScroll(e: Event) {
        const el = e.currentTarget as HTMLElement;
        if (
            el.scrollHeight - el.scrollTop - el.clientHeight < 100 &&
            visibleCount < grouped.other.length
        ) {
            visibleCount = Math.min(visibleCount + 50, grouped.other.length);
        }
    }

    onMount(() => {
        loadMinecraftVersions();
        isDesktop = window.innerWidth >= 768;
    });

    function onResize() {
        if (browser) {
            isDesktop = window.innerWidth >= 768;
        }
    }

    function handleSelect(selectedValue: string) {
        value = selectedValue;
        onValueChange?.(selectedValue);
        open = false;
    }
</script>

<svelte:window onresize={onResize} />

{#snippet versionList()}
    <Command.Root>
        <Command.Input placeholder="Search versions..." bind:value={searchQuery} />
        <Command.List class="max-h-60" onscroll={handleScroll}>
            <Command.Empty>No version found.</Command.Empty>

            {#if grouped.popular.length > 0}
                <Command.Group heading="Popular Releases">
                    {#each grouped.popular as version (version.value)}
                        <Command.Item
                            value={version.value}
                            onSelect={() => handleSelect(version.value)}
                        >
                            <span class="truncate">{version.label}</span>
                            {#if version.versionType !== 'release'}
                                <Badge
                                    variant="secondary"
                                    class={cn(
                                        'ml-auto shrink-0 text-[10px] leading-tight',
                                        VERSION_TYPE_BADGE_CLASSES[version.versionType]
                                    )}
                                >
                                    {capitalize(version.versionType)}
                                </Badge>
                            {/if}
                        </Command.Item>
                    {/each}
                </Command.Group>
                <Command.Separator />
            {/if}

            <Command.Group heading="All Versions">
                {#each displayedOther as version (version.value)}
                    <Command.Item
                        value={version.value}
                        onSelect={() => handleSelect(version.value)}
                    >
                        <span class="truncate">{version.label}</span>
                        {#if version.versionType !== 'release'}
                            <Badge
                                variant="secondary"
                                class={cn(
                                    'ml-auto shrink-0 text-[10px] leading-tight',
                                    VERSION_TYPE_BADGE_CLASSES[version.versionType]
                                )}
                            >
                                {capitalize(version.versionType)}
                            </Badge>
                        {/if}
                    </Command.Item>
                {/each}
            </Command.Group>
        </Command.List>
    </Command.Root>
{/snippet}

{#snippet triggerContent()}
    {#if versionState.isLoading}
        <span class="flex items-center gap-2">
            <Spinner class="size-4" />
            <span class="text-muted-foreground">Loading...</span>
        </span>
    {:else if value}
        {value}
    {:else}
        <span class="text-muted-foreground">Select Version</span>
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
                    class={cn('w-full min-w-50 justify-between', error && 'border-destructive')}
                    {disabled}
                    {...props}
                >
                    {@render triggerContent()}
                </Button>
            {/snippet}
        </Popover.Trigger>
        <Popover.Content class="w-(--bits-popover-anchor-width) p-0" align="start">
            {@render versionList()}
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
                <Drawer.Title>Select Minecraft Version</Drawer.Title>
            </Drawer.Header>
            <div class="p-4 pt-0">
                {@render versionList()}
            </div>
        </Drawer.Content>
    </Drawer.Root>
{/if}
