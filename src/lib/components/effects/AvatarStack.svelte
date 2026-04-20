<script lang="ts">
    import * as Avatar from '$lib/components/ui/avatar/index.js';
    import * as Tooltip from '$lib/components/ui/tooltip/index.js';
    import { cn } from '$lib/utils';

    interface AvatarItem {
        src: string;
        alt: string;
        name?: string;
    }

    interface AvatarStackProps {
        avatars: AvatarItem[];
        numExtra?: number;
        maxVisible?: number;
        size?: 'sm' | 'md' | 'lg';
        class?: string;
    }

    let {
        avatars,
        numExtra = 0,
        maxVisible,
        size = 'md',
        class: className = ''
    }: AvatarStackProps = $props();

    const visibleCount = $derived(maxVisible ?? avatars.length);
    const displayedAvatars = $derived(avatars.slice(0, visibleCount));
    const overflowCount = $derived(numExtra > 0 ? numExtra : avatars.length - visibleCount);

    const sizeClasses = {
        sm: 'size-8 text-xs',
        md: 'size-10 text-sm',
        lg: 'size-12 text-base'
    } as const;
</script>

<div
    class={cn(
        'flex -space-x-2 *:data-[slot=avatar]:ring-2 *:data-[slot=avatar]:ring-background',
        className
    )}
>
    {#each displayedAvatars as avatar (avatar.src)}
        <Tooltip.Root delayDuration={100}>
            <Tooltip.Trigger>
                <Avatar.Root
                    class={cn(
                        sizeClasses[size],
                        'transition-transform duration-200 hover:z-10 hover:-translate-y-1 hover:scale-110'
                    )}
                >
                    <Avatar.Image src={avatar.src} alt={avatar.alt} />
                    <Avatar.Fallback>{avatar.alt.slice(0, 2).toUpperCase()}</Avatar.Fallback>
                </Avatar.Root>
            </Tooltip.Trigger>
            <Tooltip.Content>
                {avatar.name ?? avatar.alt}
            </Tooltip.Content>
        </Tooltip.Root>
    {/each}

    {#if overflowCount > 0}
        <Avatar.Root
            class={cn(
                sizeClasses[size],
                'bg-gradient-to-br from-primary/20 to-primary/5 font-semibold text-primary'
            )}
        >
            <Avatar.Fallback>+{overflowCount}</Avatar.Fallback>
        </Avatar.Root>
    {/if}
</div>
