<script lang="ts">
    import { Input } from '$lib/components/ui/input';
    import * as ToggleGroup from '$lib/components/ui/toggle-group';
    import SearchIcon from '@lucide/svelte/icons/search';

    interface Props {
        searchQuery: string;
        sideFilter: 'all' | 'client' | 'server' | 'both';
        statusFilter: 'all' | 'compatible' | 'warnings' | 'conflicts';
    }

    let {
        searchQuery = $bindable(''),
        sideFilter = $bindable('all'),
        statusFilter = $bindable('all')
    }: Props = $props();

    let inputValue = $state(searchQuery);
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;

    function onInput(e: Event) {
        const target = e.target as HTMLInputElement;
        inputValue = target.value;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            searchQuery = inputValue;
        }, 200);
    }
</script>

<div class="flex flex-wrap items-center gap-3 px-4 py-3">
    <!-- Search -->
    <div class="relative min-w-[200px] flex-1">
        <SearchIcon
            class="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
            type="text"
            placeholder="Filter mods by name..."
            class="pl-9"
            value={inputValue}
            oninput={onInput}
        />
    </div>

    <!-- Side Filter -->
    <ToggleGroup.Root type="single" bind:value={sideFilter} variant="outline" size="sm">
        <ToggleGroup.Item value="all">All</ToggleGroup.Item>
        <ToggleGroup.Item value="client">Client</ToggleGroup.Item>
        <ToggleGroup.Item value="server">Server</ToggleGroup.Item>
        <ToggleGroup.Item value="both">Both</ToggleGroup.Item>
    </ToggleGroup.Root>

    <!-- Status Filter -->
    <ToggleGroup.Root type="single" bind:value={statusFilter} variant="outline" size="sm">
        <ToggleGroup.Item value="all">All</ToggleGroup.Item>
        <ToggleGroup.Item value="compatible">Compatible</ToggleGroup.Item>
        <ToggleGroup.Item value="warnings">Warnings</ToggleGroup.Item>
        <ToggleGroup.Item value="conflicts">Conflicts</ToggleGroup.Item>
    </ToggleGroup.Root>
</div>
