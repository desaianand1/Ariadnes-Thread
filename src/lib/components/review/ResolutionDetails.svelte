<script lang="ts">
    import type {
        AutoResolvedItem,
        ConflictItem,
        MissingDepItem
    } from '$lib/services/review-resolution';
    import {
        formatTechnicalReason,
        getFriendlyIssueReason,
        groupAvailabilityByLoader
    } from '$lib/services/review-resolution';
    import type { UnresolvedDependency, ModAvailability } from '$lib/services/types';
    import * as Tabs from '$lib/components/ui/tabs';
    import ModAvatar from './ModAvatar.svelte';
    import InlineLoaderIcon from './InlineLoaderIcon.svelte';
    import { Badge } from '$lib/components/ui/badge';
    import { Button } from '$lib/components/ui/button';
    import { cn } from '$lib/utils';
    import { slide } from 'svelte/transition';
    import { safeTransition } from '$lib/utils/motion';
    import {
        formatRelativeTime,
        formatFullDate,
        formatVersionNumber,
        getLoaderDisplayName,
        isStaleUpdate
    } from '$lib/utils/format';
    import { getTextColorByModLoader } from '$lib/utils/colors';
    import * as Tooltip from '$lib/components/ui/tooltip';
    import { STALE_MOD_THRESHOLD_DAYS } from '$lib/config/constants';
    import { Skeleton } from '$lib/components/ui/skeleton';
    import { SvelteSet } from 'svelte/reactivity';
    import AutoResolvedRow from './AutoResolvedRow.svelte';
    import UndoIcon from '@lucide/svelte/icons/undo-2';
    import CheckIcon from '@lucide/svelte/icons/check';
    import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
    import EyeOffIcon from '@lucide/svelte/icons/eye-off';
    import AlertTriangleIcon from '@lucide/svelte/icons/triangle-alert';
    import UnplugIcon from '@lucide/svelte/icons/unplug';
    import Link2OffIcon from '@lucide/svelte/icons/link-2-off';

    interface Props {
        autoResolvedItems: AutoResolvedItem[];
        conflicts: ConflictItem[];
        missingDeps: MissingDepItem[];
        unresolvedRaw: UnresolvedDependency[];
        excludedIds: Set<string>;
        onExclude: (id: string) => void;
        onRestore: (id: string) => void;
        modAvailability?: Record<string, ModAvailability>;
        advisorLoading?: boolean;
        unresolvedMetadata?: Record<string, { updated: string; description: string }>;
        showAdvisor?: boolean;
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
        modAvailability = {},
        advisorLoading = false,
        unresolvedMetadata = {},
        showAdvisor = false,
        activeTab = $bindable('issues')
    }: Props = $props();

    let expandedLoaders = new SvelteSet<string>();

    let activeConflictCount = $derived(
        conflicts.filter((c) => !excludedIds.has(c.projectA.id) && !excludedIds.has(c.projectB.id))
            .length
    );
    let visibleMissingDeps = $derived(missingDeps.filter((d) => !excludedIds.has(d.projectId)));
    let issueCount = $derived(activeConflictCount + visibleMissingDeps.length);
    let hasIssues = $derived(conflicts.length > 0 || missingDeps.length > 0);

    // Set initial tab based on content
    let initialTabSet = false;
    $effect(() => {
        if (initialTabSet) return;
        if (hasIssues) {
            activeTab = 'issues';
        } else if (autoResolvedItems.length > 0) {
            activeTab = 'autofixed';
        }
        initialTabSet = true;
    });

    function getModrinthUrl(projectId: string): string {
        return `https://modrinth.com/mod/${projectId}`;
    }

    function getReasonIcon(reason: string) {
        const lower = reason.toLowerCase();
        if (
            lower.includes('loader') ||
            lower.includes('fabric') ||
            lower.includes('forge') ||
            lower.includes('quilt') ||
            lower.includes('neoforge')
        ) {
            return UnplugIcon;
        }
        if (lower.includes('dependency') || lower.includes('required')) {
            return Link2OffIcon;
        }
        return AlertTriangleIcon;
    }

    // Sort: near-miss first, then truly unavailable
    let sortedMissingDeps = $derived(
        [...visibleMissingDeps].sort((a, b) => {
            const aIsNearMiss = modAvailability[a.projectId]?.isNearMiss ?? false;
            const bIsNearMiss = modAvailability[b.projectId]?.isNearMiss ?? false;
            if (aIsNearMiss && !bIsNearMiss) return -1;
            if (!aIsNearMiss && bIsNearMiss) return 1;
            return 0;
        })
    );
</script>

<div class="rounded-lg border bg-card">
    <Tabs.Root bind:value={activeTab}>
        <div class="flex items-center border-b px-4 py-2.5">
            <Tabs.List>
                {#if autoResolvedItems.length > 0}
                    <Tabs.Trigger value="autofixed" class="text-xs">
                        <Tooltip.Root>
                            <Tooltip.Trigger>
                                {#snippet child({ props })}
                                    <span
                                        class="size-2 rounded-full bg-teal-500"
                                        aria-hidden="true"
                                        {...props}
                                    ></span>
                                {/snippet}
                            </Tooltip.Trigger>
                            <Tooltip.Content>Automatically resolved</Tooltip.Content>
                        </Tooltip.Root>
                        Auto-fixed ({autoResolvedItems.length})
                    </Tabs.Trigger>
                {/if}
                {#if hasIssues}
                    <Tabs.Trigger value="issues" class="text-xs">
                        <Tooltip.Root>
                            <Tooltip.Trigger>
                                {#snippet child({ props })}
                                    <span
                                        class="size-2 rounded-full bg-amber-500"
                                        aria-hidden="true"
                                        {...props}
                                    ></span>
                                {/snippet}
                            </Tooltip.Trigger>
                            <Tooltip.Content>Needs attention</Tooltip.Content>
                        </Tooltip.Root>
                        Issues ({issueCount > 0 ? issueCount : 'All resolved'})
                    </Tabs.Trigger>
                {/if}
            </Tabs.List>
        </div>

        <!-- Auto-fixed tab -->
        {#if autoResolvedItems.length > 0}
            <Tabs.Content value="autofixed" class="p-4">
                <div class="space-y-1">
                    {#each autoResolvedItems as item (item.projectId + item.type)}
                        <AutoResolvedRow {item} />
                    {/each}
                </div>
            </Tabs.Content>
        {/if}

        <!-- Issues tab -->
        {#if hasIssues}
            <Tabs.Content value="issues" class="space-y-4 p-4">
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

                <!-- Unavailable Mods -->
                {#if sortedMissingDeps.length > 0}
                    <div class="space-y-2">
                        <p class="text-sm font-medium">Unavailable mods:</p>
                        {#each sortedMissingDeps as dep (dep.projectId)}
                            {@const unresolvedData = unresolvedRaw.find(
                                (u) => u.projectId === dep.projectId
                            )}
                            {@const availability = modAvailability[dep.projectId]}
                            {@const metadata = unresolvedMetadata[dep.projectId]}
                            {@const isNearMiss = availability?.isNearMiss ?? false}
                            {@const ReasonIcon = getReasonIcon(dep.reason)}
                            {@const availableLoaders = availability?.availableOn
                                ? [...new Set(availability.availableOn.map((a) => a.loader))]
                                : undefined}
                            {@const friendlyReason = getFriendlyIssueReason(
                                dep.reason,
                                isNearMiss,
                                showAdvisor,
                                availableLoaders
                            )}
                            <div transition:slide={safeTransition({ duration: 150 })}>
                                <div
                                    class={cn(
                                        'rounded-md border p-3',
                                        isNearMiss
                                            ? 'border-l-4 border-l-teal-400 bg-teal-50/50 dark:bg-teal-950/20'
                                            : 'border-l-4 border-l-amber-400 bg-background/60'
                                    )}
                                >
                                    <div class="flex items-start gap-3">
                                        <ModAvatar
                                            iconUrl={unresolvedData?.projectIconUrl}
                                            title={dep.projectTitle}
                                            size="md"
                                            class="shrink-0"
                                        />
                                        <div class="min-w-0 flex-1 space-y-1.5">
                                            <!-- Title row -->
                                            <div class="flex items-start justify-between gap-2">
                                                <div>
                                                    <p class="text-sm font-semibold">
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
                                                    {#if metadata?.description || unresolvedData?.projectDescription}
                                                        <p
                                                            class="line-clamp-1 text-xs text-muted-foreground"
                                                        >
                                                            {metadata?.description ??
                                                                unresolvedData?.projectDescription}
                                                        </p>
                                                    {/if}
                                                </div>
                                                {#if advisorLoading}
                                                    <Skeleton
                                                        class="h-5 w-24 shrink-0 rounded-full"
                                                    />
                                                {:else if isNearMiss && availability?.availableOn?.[0]}
                                                    <Badge
                                                        variant="outline"
                                                        class="shrink-0 border-teal-200 bg-teal-50/50 text-[10px] text-teal-700 dark:border-teal-800 dark:bg-teal-950/20 dark:text-teal-300"
                                                    >
                                                        Try {availability.availableOn[0].version} instead
                                                    </Badge>
                                                {/if}
                                            </div>

                                            <!-- Reason with icon -->
                                            <div class="flex items-center gap-1.5 text-xs">
                                                <ReasonIcon
                                                    class={cn(
                                                        'size-3 shrink-0',
                                                        isNearMiss
                                                            ? 'text-teal-600 dark:text-teal-400'
                                                            : 'text-amber-600 dark:text-amber-400'
                                                    )}
                                                />
                                                <span
                                                    class={cn(
                                                        'font-medium',
                                                        isNearMiss
                                                            ? 'text-teal-700 dark:text-teal-300'
                                                            : 'text-amber-700 dark:text-amber-300'
                                                    )}
                                                >
                                                    {formatTechnicalReason(dep.reason)}
                                                </span>
                                            </div>
                                            <p class="text-xs text-muted-foreground/70 italic">
                                                {friendlyReason}
                                            </p>

                                            <!-- Required by -->
                                            <p class="text-xs text-muted-foreground">
                                                Required by {dep.requiredBy.join(', ')}
                                            </p>

                                            <!-- Where available (grouped by loader) -->
                                            {#if availability?.availableOn && availability.availableOn.length > 0}
                                                {@const loaderGroups = groupAvailabilityByLoader(
                                                    availability.availableOn
                                                )}
                                                <div
                                                    class="space-y-0.5 text-xs text-muted-foreground/80"
                                                >
                                                    <span>Also works with:</span>
                                                    {#each loaderGroups as group (group.loader)}
                                                        {@const maxVisible = 3}
                                                        {@const visibleVersions =
                                                            group.versions.slice(0, maxVisible)}
                                                        {@const hiddenCount =
                                                            group.versions.length - maxVisible}
                                                        {@const expandId = `${dep.projectId}-${group.loader}`}
                                                        <div
                                                            class="flex flex-wrap items-center gap-1 pl-1"
                                                        >
                                                            <InlineLoaderIcon
                                                                loaderSlug={group.loader}
                                                                class={cn(
                                                                    'size-3 shrink-0',
                                                                    getTextColorByModLoader(
                                                                        group.loader
                                                                    )
                                                                )}
                                                            />
                                                            <span
                                                                class={cn(
                                                                    'shrink-0',
                                                                    getTextColorByModLoader(
                                                                        group.loader
                                                                    )
                                                                )}
                                                                >{getLoaderDisplayName(
                                                                    group.loader
                                                                )}</span
                                                            >
                                                            {#each visibleVersions as version, i (i + version)}
                                                                <Badge
                                                                    variant="outline"
                                                                    class="text-[10px] leading-tight"
                                                                >
                                                                    {formatVersionNumber(version)}
                                                                </Badge>
                                                            {/each}
                                                            {#if hiddenCount > 0 && !expandedLoaders.has(expandId)}
                                                                <Button
                                                                    variant="link"
                                                                    size="sm"
                                                                    class="h-auto px-1 py-0 text-[10px] text-muted-foreground/60"
                                                                    aria-label="Show {hiddenCount} more versions for {getLoaderDisplayName(
                                                                        group.loader
                                                                    )}"
                                                                    aria-expanded="false"
                                                                    onclick={() => {
                                                                        expandedLoaders.add(
                                                                            expandId
                                                                        );
                                                                    }}
                                                                >
                                                                    +{hiddenCount} more
                                                                </Button>
                                                            {/if}
                                                            {#if hiddenCount > 0 && expandedLoaders.has(expandId)}
                                                                <span
                                                                    class="flex flex-wrap items-center gap-1"
                                                                    transition:slide={safeTransition(
                                                                        { duration: 150 }
                                                                    )}
                                                                >
                                                                    {#each group.versions.slice(maxVisible) as version, i (i + version)}
                                                                        <Badge
                                                                            variant="outline"
                                                                            class="text-[10px] leading-tight"
                                                                        >
                                                                            {formatVersionNumber(
                                                                                version
                                                                            )}
                                                                        </Badge>
                                                                    {/each}
                                                                    <Button
                                                                        variant="link"
                                                                        size="sm"
                                                                        class="h-auto px-1 py-0 text-[10px] text-muted-foreground/60"
                                                                        aria-label="Show fewer versions for {getLoaderDisplayName(
                                                                            group.loader
                                                                        )}"
                                                                        aria-expanded="true"
                                                                        onclick={() => {
                                                                            expandedLoaders.delete(
                                                                                expandId
                                                                            );
                                                                        }}
                                                                    >
                                                                        show less
                                                                    </Button>
                                                                </span>
                                                            {/if}
                                                        </div>
                                                    {/each}
                                                </div>
                                            {/if}

                                            <!-- Last updated — amber only for stale mods -->
                                            {#if metadata?.updated}
                                                {@const stale =
                                                    !isNearMiss &&
                                                    isStaleUpdate(
                                                        metadata.updated,
                                                        STALE_MOD_THRESHOLD_DAYS
                                                    )}
                                                <Tooltip.Root>
                                                    <Tooltip.Trigger>
                                                        {#snippet child({ props })}
                                                            <p
                                                                class={cn(
                                                                    'w-fit cursor-default text-xs',
                                                                    stale
                                                                        ? 'font-medium text-amber-600/80 dark:text-amber-400/80'
                                                                        : 'text-muted-foreground/60'
                                                                )}
                                                                {...props}
                                                            >
                                                                Last updated {formatRelativeTime(
                                                                    metadata.updated
                                                                )}
                                                            </p>
                                                        {/snippet}
                                                    </Tooltip.Trigger>
                                                    <Tooltip.Content
                                                        >{formatFullDate(
                                                            metadata.updated
                                                        )}</Tooltip.Content
                                                    >
                                                </Tooltip.Root>
                                            {/if}

                                            <!-- Actions -->
                                            <div class="flex items-center gap-2 pt-1">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    class="h-7 text-xs"
                                                    href={getModrinthUrl(
                                                        unresolvedData?.projectId ?? dep.projectId
                                                    )}
                                                    target="_blank"
                                                    rel="noopener noreferrer external"
                                                >
                                                    <ExternalLinkIcon class="mr-1 size-3" />
                                                    View on Modrinth
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    class="h-7 text-xs text-muted-foreground"
                                                    onclick={() => onExclude(dep.projectId)}
                                                >
                                                    <EyeOffIcon class="mr-1 size-3" />
                                                    Exclude from download
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        {/each}
                    </div>
                {/if}
            </Tabs.Content>
        {/if}
    </Tabs.Root>
</div>
