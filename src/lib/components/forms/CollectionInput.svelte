<script lang="ts">
    import { Input } from '$lib/components/ui/input';
    import { Button } from '$lib/components/ui/button';
    import { Spinner } from '$lib/components/ui/spinner';
    import { cn } from '$lib/utils';
    import { slide, fade } from 'svelte/transition';
    import { safeTransition } from '$lib/utils/motion';
    import PlusIcon from '@lucide/svelte/icons/plus';
    import XIcon from '@lucide/svelte/icons/x';
    import CheckIcon from '@lucide/svelte/icons/check';
    import AlertCircleIcon from '@lucide/svelte/icons/alert-circle';
    import {
        collectionsState,
        addCollectionEntry,
        removeCollectionEntry,
        updateCollectionInput,
        hasValidCollection
    } from '$lib/state/collections.svelte';

    interface Props {
        disabled?: boolean;
    }

    let { disabled = false }: Props = $props();
</script>

<div class="space-y-3">
    {#each collectionsState.entries as entry, index (index)}
        <div class="space-y-2" transition:slide={safeTransition({ duration: 200 })}>
            <div class="flex items-center gap-2">
                <div class="relative flex-1">
                    <Input
                        type="text"
                        placeholder="Paste a Modrinth collection URL or ID"
                        class={cn(
                            'pr-10',
                            entry.status === 'valid' &&
                                'border-green-500 focus-visible:ring-green-500/20',
                            entry.status === 'invalid' &&
                                'border-destructive focus-visible:ring-destructive/20'
                        )}
                        value={entry.inputValue}
                        oninput={(e) => updateCollectionInput(index, e.currentTarget.value)}
                        {disabled}
                    />

                    <div class="absolute inset-y-0 right-0 flex items-center pr-3">
                        {#if entry.status === 'validating'}
                            <span in:fade={safeTransition({ duration: 150 })}>
                                <Spinner class="size-4" />
                            </span>
                        {:else if entry.status === 'valid'}
                            <span in:fade={safeTransition({ duration: 150 })}>
                                <CheckIcon class="size-4 text-green-500" />
                            </span>
                        {:else if entry.status === 'invalid'}
                            <span in:fade={safeTransition({ duration: 150 })}>
                                <AlertCircleIcon class="size-4 text-destructive" />
                            </span>
                        {/if}
                    </div>
                </div>

                {#if index > 0}
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        class="shrink-0 text-muted-foreground hover:text-destructive"
                        {disabled}
                        onclick={() => removeCollectionEntry(index)}
                        aria-label="Remove collection"
                    >
                        <XIcon class="size-4" />
                    </Button>
                {:else}
                    <div class="w-10 shrink-0"></div>
                {/if}
            </div>

            {#if entry.status === 'invalid' && entry.error}
                <p
                    class="text-sm text-destructive"
                    transition:slide={safeTransition({ duration: 200 })}
                >
                    {entry.error}
                </p>
            {/if}

            {#if entry.status === 'valid' && entry.collection}
                <div
                    class="rounded-md border border-green-500/20 bg-green-500/5 p-3"
                    transition:slide={safeTransition({ duration: 200 })}
                >
                    <div class="flex items-center gap-2">
                        {#if entry.collection.iconUrl}
                            <img src={entry.collection.iconUrl} alt="" class="size-6 rounded" />
                        {/if}
                        <span class="font-medium">{entry.collection.name}</span>
                        <span class="text-sm text-muted-foreground">
                            ({entry.collection.projectCount} mods)
                        </span>
                    </div>
                    {#if entry.collection.description}
                        <p class="mt-1 line-clamp-2 text-sm text-muted-foreground">
                            {entry.collection.description}
                        </p>
                    {/if}
                </div>
            {/if}
        </div>
    {/each}

    {#if collectionsState.entries.length < collectionsState.maxCollections}
        {#if hasValidCollection()}
            <Button
                type="button"
                variant="outline"
                size="sm"
                class="gap-1.5"
                disabled={disabled ||
                    collectionsState.entries.length >= collectionsState.maxCollections}
                onclick={() => addCollectionEntry()}
            >
                <PlusIcon class="size-4" />
                Add another collection
            </Button>
            {#if collectionsState.entries.length >= 2}
                <p class="text-xs text-muted-foreground">
                    Add up to {collectionsState.maxCollections} collections
                </p>
            {/if}
        {/if}
    {:else}
        <p class="text-xs text-muted-foreground">
            Maximum of {collectionsState.maxCollections} collections reached
        </p>
    {/if}
</div>
