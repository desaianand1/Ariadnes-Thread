<script lang="ts">
    import type { ConflictEntry } from '$lib/services/types';
    import * as Alert from '$lib/components/ui/alert';
    import { Button } from '$lib/components/ui/button';
    import { Badge } from '$lib/components/ui/badge';
    import { fly } from 'svelte/transition';
    import AlertTriangleIcon from '@lucide/svelte/icons/triangle-alert';
    import XIcon from '@lucide/svelte/icons/x';
    import UndoIcon from '@lucide/svelte/icons/undo-2';
    import { SvelteSet } from 'svelte/reactivity';

    interface Props {
        conflicts: ConflictEntry[];
        projectTitleMap: Record<string, string>;
        excludedIds: Set<string>;
        onExclude: (projectId: string) => void;
        onRestore: (projectId: string) => void;
    }

    let { conflicts, projectTitleMap, excludedIds, onExclude, onRestore }: Props = $props();

    /** Dedupe conflict pairs so A↔B only appears once */
    let uniquePairs = $derived.by(() => {
        const seen = new SvelteSet<string>();
        const pairs: { a: string; b: string; declaredBy: string }[] = [];
        for (const c of conflicts) {
            const key = [c.projectId, c.conflictsWith].sort().join(':');
            if (!seen.has(key)) {
                seen.add(key);
                pairs.push({ a: c.projectId, b: c.conflictsWith, declaredBy: c.declaredBy });
            }
        }
        return pairs;
    });

    function titleOf(id: string): string {
        return projectTitleMap[id] ?? id;
    }
</script>

{#if conflicts.length > 0}
    <Alert.Root variant="destructive">
        <AlertTriangleIcon class="size-4" />
        <Alert.Title
            >{uniquePairs.length} conflict{uniquePairs.length !== 1 ? 's' : ''} detected</Alert.Title
        >
        <Alert.Description>
            <p class="mb-3 text-sm">
                These mods have declared incompatibilities. Exclude one from each pair to resolve.
            </p>
            <div class="space-y-2">
                {#each uniquePairs as { a, b, declaredBy }, i (`${a}:${b}`)}
                    <div
                        in:fly={{ y: 8, duration: 200, delay: i * 50 }}
                        class="flex flex-wrap items-center gap-2 rounded-md bg-background/50 p-2 text-sm"
                    >
                        <!-- Mod A -->
                        <div class="flex items-center gap-1.5">
                            {#if excludedIds.has(a)}
                                <Badge variant="outline" class="opacity-60">Excluded</Badge>
                                <span class="line-through opacity-60">{titleOf(a)}</span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    class="h-6 px-1.5"
                                    onclick={() => onRestore(a)}
                                >
                                    <UndoIcon class="mr-1 size-3" />
                                    Restore
                                </Button>
                            {:else}
                                <span class="font-medium">{titleOf(a)}</span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    class="h-6 px-1.5 text-destructive hover:text-destructive"
                                    onclick={() => onExclude(a)}
                                >
                                    <XIcon class="mr-1 size-3" />
                                    Exclude
                                </Button>
                            {/if}
                        </div>

                        <span class="text-xs text-muted-foreground">vs</span>

                        <!-- Mod B -->
                        <div class="flex items-center gap-1.5">
                            {#if excludedIds.has(b)}
                                <Badge variant="outline" class="opacity-60">Excluded</Badge>
                                <span class="line-through opacity-60">{titleOf(b)}</span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    class="h-6 px-1.5"
                                    onclick={() => onRestore(b)}
                                >
                                    <UndoIcon class="mr-1 size-3" />
                                    Restore
                                </Button>
                            {:else}
                                <span class="font-medium">{titleOf(b)}</span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    class="h-6 px-1.5 text-destructive hover:text-destructive"
                                    onclick={() => onExclude(b)}
                                >
                                    <XIcon class="mr-1 size-3" />
                                    Exclude
                                </Button>
                            {/if}
                        </div>

                        {#if declaredBy}
                            <span class="ml-auto text-xs text-muted-foreground">
                                declared by {titleOf(declaredBy)}
                            </span>
                        {/if}
                    </div>
                {/each}
            </div>
        </Alert.Description>
    </Alert.Root>
{/if}
