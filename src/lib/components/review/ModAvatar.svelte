<script lang="ts">
    import * as Avatar from '$lib/components/ui/avatar';
    import { cn } from '$lib/utils';

    interface Props {
        iconUrl?: string;
        title: string;
        size?: 'xs' | 'sm' | 'md' | 'lg';
        rounding?: 'rounded' | 'rounded-md' | 'rounded-lg' | 'rounded-xl';
        class?: string;
    }

    const SIZE_MAP = {
        xs: { container: 'size-5', text: 'text-[8px]' },
        sm: { container: 'size-6', text: 'text-[10px]' },
        md: { container: 'size-8', text: 'text-xs' },
        lg: { container: 'size-16', text: 'text-lg' }
    } as const;

    let {
        iconUrl,
        title,
        size = 'md',
        rounding = 'rounded-lg',
        class: className
    }: Props = $props();

    let sizeClasses = $derived(SIZE_MAP[size]);
</script>

<Avatar.Root class={cn(sizeClasses.container, rounding, className)}>
    {#if iconUrl}
        <Avatar.Image src={iconUrl} alt={title} />
    {/if}
    <Avatar.Fallback class={cn(rounding, sizeClasses.text)}>
        {title.charAt(0)}
    </Avatar.Fallback>
</Avatar.Root>
