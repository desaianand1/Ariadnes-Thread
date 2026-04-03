<script lang="ts">
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';
    import * as Popover from '$lib/components/ui/popover';
    import * as Command from '$lib/components/ui/command';
    import * as Drawer from '$lib/components/ui/drawer';
    import * as Empty from '$lib/components/ui/empty';
    import { Button } from '$lib/components/ui/button';
    import { Badge } from '$lib/components/ui/badge';
    import { Skeleton } from '$lib/components/ui/skeleton';
    import { Spinner } from '$lib/components/ui/spinner';
    import { VERSION_TYPE_BADGE_CLASSES } from '$lib/utils/colors';
    import { cn } from '$lib/utils';
    import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
    import SearchXIcon from '@lucide/svelte/icons/search-x';
    import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';
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

    // Reset pagination when search changes
    let prevSearch = $state('');
    $effect(() => {
        if (searchQuery !== prevSearch) {
            prevSearch = searchQuery;
            visibleCount = 50;
        }
    });

    let query = $derived(searchQuery.trim().toLowerCase());

    let filteredPopular = $derived.by(() => {
        if (!query) return grouped.popular;
        return grouped.popular.filter((v) => v.value.toLowerCase().includes(query));
    });

    let filteredReleases = $derived.by(() => {
        if (!query) return grouped.releases;
        return grouped.releases.filter((v) => v.value.toLowerCase().includes(query));
    });

    let filteredAll = $derived.by(() => {
        if (!query) return grouped.all;
        return grouped.all.filter((v) => v.value.toLowerCase().includes(query));
    });

    let displayedAll = $derived(filteredAll.slice(0, visibleCount));

    function handleScroll(e: Event) {
        const el = e.currentTarget as HTMLElement;
        if (
            el.scrollHeight - el.scrollTop - el.clientHeight < 100 &&
            visibleCount < filteredAll.length
        ) {
            visibleCount = Math.min(visibleCount + 50, filteredAll.length);
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
    <Command.Root shouldFilter={false}>
        <Command.Input placeholder="Search versions..." bind:value={searchQuery} />
        <Command.List class="max-h-60" onscroll={handleScroll}>
            {#if versionState.isLoading}
                <div class="space-y-1 p-2">
                    {#each { length: 5 } as _, i (i)}
                        <Skeleton class="h-8 w-full rounded-sm" />
                    {/each}
                </div>
            {:else if filteredAll.length === 0}
                <Empty.Root class="border-none py-3 text-muted-foreground">
                    <Empty.Header>
                        <Empty.Media variant="icon">
                            <SearchXIcon class="text-muted-foreground" />
                        </Empty.Media>
                        <Empty.Title class="text-sm">No version found</Empty.Title>
                        <Empty.Description class="text-xs"
                            >Try a different search term.</Empty.Description
                        >
                    </Empty.Header>
                </Empty.Root>
            {:else}
                {#if filteredPopular.length > 0}
                    <Command.Group heading="Popular Releases">
                        {#each filteredPopular as version (version.value)}
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

                {#if filteredReleases.length > 0}
                    <Command.Group heading="Releases">
                        {#each filteredReleases as version (version.value)}
                            <Command.Item
                                value={version.value}
                                onSelect={() => handleSelect(version.value)}
                            >
                                <span class="truncate">{version.label}</span>
                            </Command.Item>
                        {/each}
                    </Command.Group>
                    <Command.Separator />
                {/if}

                <Command.Group heading="All Versions">
                    {#each displayedAll as version (version.value)}
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

                {#if visibleCount < filteredAll.length}
                    <div class="flex items-center justify-center py-2">
                        <LoaderCircleIcon class="size-4 animate-spin text-muted-foreground" />
                    </div>
                {/if}
            {/if}
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
                    aria-label="Select Minecraft version"
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
                    aria-label="Select Minecraft version"
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
