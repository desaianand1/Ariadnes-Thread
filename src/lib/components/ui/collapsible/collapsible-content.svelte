<script lang="ts">
    import { Collapsible as CollapsiblePrimitive } from 'bits-ui';
    import { slide } from 'svelte/transition';
    import { safeTransition } from '$lib/utils/motion';
    import { cn } from '$lib/utils';

    let {
        ref = $bindable(null),
        class: className,
        ...restProps
    }: CollapsiblePrimitive.ContentProps = $props();
</script>

<CollapsiblePrimitive.Content bind:ref data-slot="collapsible-content">
    {#snippet child({ props, open })}
        {#if open}
            <div
                transition:slide={safeTransition({ duration: 200 })}
                {...props}
                class={cn(props.class as string, className)}
            >
                {@render restProps.children?.()}
            </div>
        {/if}
    {/snippet}
</CollapsiblePrimitive.Content>
