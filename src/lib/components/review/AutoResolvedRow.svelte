<script lang="ts">
    import type { AutoResolvedItem } from '$lib/services/review-resolution';
    import { Badge } from '$lib/components/ui/badge';
    import * as Tooltip from '$lib/components/ui/tooltip';
    import ModAvatar from './ModAvatar.svelte';
    import InlineLoaderIcon from './InlineLoaderIcon.svelte';
    import { VERSION_TYPE_BADGE_CLASSES, SIDE_LABELS, SIDE_ICONS } from '$lib/utils/colors';
    import { capitalize, getLoaderDisplayName, formatVersionNumber } from '$lib/utils/format';
    import { cn } from '$lib/utils';

    interface Props {
        item: AutoResolvedItem;
    }

    let { item }: Props = $props();
</script>

<div
    class={cn(
        'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm',
        item.type === 'auto-excluded' && 'opacity-50'
    )}
>
    <ModAvatar
        iconUrl={item.iconUrl}
        title={item.projectTitle}
        size="sm"
        rounding="rounded-md"
        class="shrink-0"
    />

    <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
            <span
                class={cn('truncate font-medium', item.type === 'auto-excluded' && 'line-through')}
            >
                {item.projectTitle}
            </span>

            <!-- Badges -->
            <div class="flex shrink-0 items-center gap-1">
                {#if item.versionNumber}
                    <Badge variant="outline" class="text-[10px] leading-tight">
                        {formatVersionNumber(item.versionNumber)}
                    </Badge>
                {/if}
                {#if item.type === 'fallback' && item.resolvedLoader}
                    <Badge variant="outline" class="text-[10px] leading-tight">
                        Via <InlineLoaderIcon loaderSlug={item.resolvedLoader} class="size-3" />
                        {getLoaderDisplayName(item.resolvedLoader)}
                    </Badge>
                {:else if item.type === 'beta-version' && item.versionType}
                    <Badge
                        variant="secondary"
                        class={cn(
                            'text-[10px] leading-tight',
                            VERSION_TYPE_BADGE_CLASSES[item.versionType]
                        )}
                    >
                        {capitalize(item.versionType)}
                    </Badge>
                {:else if item.type === 'auto-excluded'}
                    <Badge variant="secondary" class="text-[10px] leading-tight opacity-70">
                        Auto-excluded
                    </Badge>
                {:else if item.type === 'loader-independent'}
                    <Badge
                        variant="secondary"
                        class="bg-slate-100 text-[10px] leading-tight text-slate-600 dark:bg-slate-800/50 dark:text-slate-400"
                    >
                        No loader needed
                    </Badge>
                {:else if item.type === 'compatible-version-used' && item.resolvedGameVersion}
                    <Tooltip.Root>
                        <Tooltip.Trigger>
                            {#snippet child({ props })}
                                <Badge
                                    {...props}
                                    variant="secondary"
                                    class="bg-blue-100 text-[10px] leading-tight text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                >
                                    ~{item.resolvedGameVersion}
                                </Badge>
                            {/snippet}
                        </Tooltip.Trigger>
                        <Tooltip.Content>
                            <p class="max-w-xs text-xs">
                                This {item.projectType ?? 'project'} was made for MC {item.resolvedGameVersion}.
                                It should work on {item.targetGameVersion}, but minor differences
                                are possible.
                            </p>
                        </Tooltip.Content>
                    </Tooltip.Root>
                {/if}
                {#if item.side}
                    {@const SideIcon = SIDE_ICONS[item.side as keyof typeof SIDE_ICONS]}
                    <span
                        class="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground/70"
                    >
                        {#if SideIcon}
                            <SideIcon class="size-2.5" />
                        {/if}
                        {SIDE_LABELS[item.side] ?? item.side}
                    </span>
                {/if}
            </div>
        </div>

        <!-- Reason subtext -->
        <p class="mt-0.5 truncate text-xs text-muted-foreground">
            {item.reasonText}
        </p>
    </div>
</div>
