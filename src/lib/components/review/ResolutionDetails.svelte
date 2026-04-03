<script lang="ts">
    import type {
        AutoResolvedItem,
        ConflictItem,
        MissingDepItem
    } from '$lib/services/review-resolution';
    import type { UnresolvedDependency } from '$lib/services/types';
    import * as Tabs from '$lib/components/ui/tabs';
    import ModAvatar from './ModAvatar.svelte';
    import { Badge } from '$lib/components/ui/badge';
    import { Button } from '$lib/components/ui/button';
    import { cn } from '$lib/utils';
    import { slide } from 'svelte/transition';
    import { safeTransition } from '$lib/utils/motion';
    import AutoResolvedRow from './AutoResolvedRow.svelte';
    import UndoIcon from '@lucide/svelte/icons/undo-2';
    import CheckIcon from '@lucide/svelte/icons/check';
    import XIcon from '@lucide/svelte/icons/x';
    import SearchXIcon from '@lucide/svelte/icons/search-x';

    interface Props {
        autoResolvedItems: AutoResolvedItem[];
        conflicts: ConflictItem[];
        missingDeps: MissingDepItem[];
        unresolvedRaw: UnresolvedDependency[];
        excludedIds: Set<string>;
        onExclude: (id: string) => void;
        onRestore: (id: string) => void;
        onDismiss: () => void;
        loader: string;
        activeTab?: string;
    }

    let {
        autoResolvedItems,
        conflicts,
        missingDeps,
        unresolvedRaw,
        excludedIds,
        onExclude,
        onRestore,
        onDismiss,
        loader,
        activeTab = $bindable('action')
    }: Props = $props();

    let activeConflictCount = $derived(
        conflicts.filter((c) => !excludedIds.has(c.projectA.id) && !excludedIds.has(c.projectB.id))
            .length
    );
    let actionItemCount = $derived(activeConflictCount + missingDeps.length);
    let hasActionItems = $derived(conflicts.length > 0 || missingDeps.length > 0);

    // Set initial tab based on content — only runs once
    let initialTabSet = false;
    $effect(() => {
        if (initialTabSet) return;
        if (hasActionItems) {
            activeTab = 'action';
        } else if (autoResolvedItems.length > 0) {
            activeTab = 'auto';
        }
        initialTabSet = true;
    });
</script>

<div
    class={cn(
        'rounded-lg border bg-card',
        hasActionItems ? 'border-l-4 border-l-amber-400' : 'border-l-4 border-l-blue-400'
    )}
>
    <Tabs.Root bind:value={activeTab}>
        <div class="flex items-center justify-between border-b px-4 py-2.5">
            <h3 class="text-sm font-medium text-muted-foreground">Mod Dependency Resolution</h3>
            <div class="flex items-center gap-1">
                <Tabs.List>
                    {#if autoResolvedItems.length > 0}
                        <Tabs.Trigger value="auto" class="text-xs">
                            <span class="size-2 rounded-full bg-green-500" aria-hidden="true"
                            ></span>
                            Auto-resolved ({autoResolvedItems.length})
                        </Tabs.Trigger>
                    {/if}
                    {#if hasActionItems}
                        <Tabs.Trigger value="action" class="text-xs">
                            <span class="size-2 rounded-full bg-amber-500" aria-hidden="true"
                            ></span>
                            Needs Attention ({actionItemCount > 0
                                ? actionItemCount
                                : 'All resolved'})
                        </Tabs.Trigger>
                    {/if}
                </Tabs.List>
                <Button
                    variant="ghost"
                    size="sm"
                    class="h-7 px-2 text-xs text-muted-foreground"
                    onclick={onDismiss}
                >
                    <XIcon class="mr-1 size-3" /> Dismiss
                </Button>
            </div>
        </div>

        <!-- Auto-resolved tab -->
        {#if autoResolvedItems.length > 0}
            <Tabs.Content value="auto" class="p-4">
                <div class="space-y-1">
                    {#each autoResolvedItems as item (item.projectId + item.type)}
                        <AutoResolvedRow {item} {loader} />
                    {/each}
                </div>
            </Tabs.Content>
        {/if}

        <!-- Needs Attention tab -->
        {#if hasActionItems}
            <Tabs.Content value="action" class="space-y-4 p-4">
                <!-- Conflicts -->
                {#if conflicts.length > 0}
                    <div class="space-y-2">
                        <p class="text-sm font-medium">
                            Incompatible mods — choose one from each pair:
                        </p>
                        {#each conflicts as conflict (`${conflict.projectA.id}:${conflict.projectB.id}`)}
                            {@const aExcluded = excludedIds.has(conflict.projectA.id)}
                            {@const bExcluded = excludedIds.has(conflict.projectB.id)}
                            <div transition:slide={safeTransition({ duration: 150 })}>
                                <div
                                    class="flex flex-wrap items-center gap-3 rounded-md border bg-background/60 p-3"
                                >
                                    <!-- Mod A -->
                                    <div
                                        class="flex items-center gap-2"
                                        class:opacity-40={aExcluded}
                                    >
                                        <ModAvatar
                                            iconUrl={conflict.projectA.iconUrl}
                                            title={conflict.projectA.title}
                                            size="sm"
                                            rounding="rounded-md"
                                            class="size-7"
                                        />
                                        <span
                                            class="text-sm font-medium"
                                            class:line-through={aExcluded}
                                        >
                                            {conflict.projectA.title}
                                        </span>
                                    </div>

                                    {#if aExcluded}
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            class="h-7 text-xs"
                                            onclick={() => onRestore(conflict.projectA.id)}
                                        >
                                            <UndoIcon class="mr-1 size-3" />
                                            Restore
                                        </Button>
                                    {:else if !bExcluded}
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            class="h-7 text-xs"
                                            onclick={() => onExclude(conflict.projectB.id)}
                                        >
                                            <CheckIcon class="mr-1 size-3" />
                                            Keep
                                        </Button>
                                    {:else}
                                        <Badge variant="secondary" class="text-xs">Kept</Badge>
                                    {/if}

                                    <span class="text-xs text-muted-foreground">vs</span>

                                    <!-- Mod B -->
                                    <div
                                        class="flex items-center gap-2"
                                        class:opacity-40={bExcluded}
                                    >
                                        <ModAvatar
                                            iconUrl={conflict.projectB.iconUrl}
                                            title={conflict.projectB.title}
                                            size="sm"
                                            rounding="rounded-md"
                                            class="size-7"
                                        />
                                        <span
                                            class="text-sm font-medium"
                                            class:line-through={bExcluded}
                                        >
                                            {conflict.projectB.title}
                                        </span>
                                    </div>

                                    {#if bExcluded}
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            class="h-7 text-xs"
                                            onclick={() => onRestore(conflict.projectB.id)}
                                        >
                                            <UndoIcon class="mr-1 size-3" />
                                            Restore
                                        </Button>
                                    {:else if !aExcluded}
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            class="h-7 text-xs"
                                            onclick={() => onExclude(conflict.projectA.id)}
                                        >
                                            <CheckIcon class="mr-1 size-3" />
                                            Keep
                                        </Button>
                                    {:else}
                                        <Badge variant="secondary" class="text-xs">Kept</Badge>
                                    {/if}

                                    {#if conflict.declaredBy}
                                        <span class="ml-auto text-xs text-muted-foreground">
                                            declared by {conflict.declaredBy}
                                        </span>
                                    {/if}
                                </div>
                            </div>
                        {/each}
                    </div>
                {/if}

                <!-- Missing Dependencies -->
                {#if missingDeps.length > 0}
                    <div class="space-y-2">
                        <p class="text-sm font-medium">Missing dependencies:</p>
                        {#each missingDeps as dep (dep.projectId)}
                            {@const unresolvedData = unresolvedRaw.find(
                                (u) => u.projectId === dep.projectId
                            )}
                            <div transition:slide={safeTransition({ duration: 150 })}>
                                <div
                                    class="flex items-start gap-3 rounded-md border bg-background/60 p-3"
                                >
                                    <ModAvatar
                                        iconUrl={unresolvedData?.projectIconUrl}
                                        title={dep.projectTitle}
                                        size="md"
                                        class="shrink-0"
                                    />
                                    <div class="min-w-0 flex-1">
                                        <p class="text-sm font-medium">
                                            {#if dep.projectTitle.match(/^[a-zA-Z0-9]{6,10}$/)}
                                                <code
                                                    class="rounded bg-muted px-1.5 py-0.5 font-mono text-xs"
                                                >
                                                    {dep.projectTitle}
                                                </code>
                                            {:else}
                                                {dep.projectTitle}
                                            {/if}
                                        </p>
                                        {#if unresolvedData?.projectDescription}
                                            <p class="text-xs text-muted-foreground">
                                                {unresolvedData.projectDescription}
                                            </p>
                                        {/if}
                                        <p class="mt-1 text-xs text-muted-foreground">
                                            Required by: {dep.requiredBy.join(', ')}
                                        </p>
                                    </div>
                                    <Badge
                                        variant="outline"
                                        class="shrink-0 border-amber-200 bg-amber-50/50 text-xs text-amber-600 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-400"
                                    >
                                        <SearchXIcon class="size-3.5" />
                                        {dep.reason}</Badge
                                    >
                                </div>
                            </div>
                        {/each}
                    </div>
                {/if}
            </Tabs.Content>
        {/if}
    </Tabs.Root>
</div>
