<script lang="ts">
    import type { HTMLAttributes } from 'svelte/elements';
    import { cn, type WithElementRef } from '$lib/utils.js';
    import { Card } from '$lib/components/ui/card';

    interface Props extends WithElementRef<HTMLAttributes<HTMLDivElement>> {
        spotlightClass?: string;
        spotlightOpacity?: number;
    }

    let {
        ref = $bindable(null),
        class: className,
        children,
        spotlightClass = 'text-white dark:text-white',
        spotlightOpacity = 25,
        ...restProps
    }: Props = $props();

    let position = $state({ x: 0, y: 0 });
    let opacity = $state(0);
    let isFocused = $state(false);

    function onMouseMove(e: MouseEvent) {
        if (!ref || isFocused) return;
        const rect = ref.getBoundingClientRect();
        position = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    function onMouseEnter() {
        opacity = 0.6;
    }

    function onMouseLeave() {
        opacity = 0;
    }

    function onFocus() {
        isFocused = true;
        opacity = 0.6;
    }

    function onBlur() {
        isFocused = false;
        opacity = 0;
    }
</script>

<Card
    bind:ref
    data-slot="spotlight-card"
    onmousemove={onMouseMove}
    onmouseenter={onMouseEnter}
    onmouseleave={onMouseLeave}
    onfocus={onFocus}
    onblur={onBlur}
    class={cn('relative overflow-hidden', className)}
    {...restProps}
>
    <div
        data-slot="spotlight-card-overlay"
        class={cn(
            'pointer-events-none absolute inset-0 z-10 transition-opacity duration-500 ease-in-out',
            spotlightClass
        )}
        style:opacity
        style:background="radial-gradient(circle at {position.x}px {position.y}px, color-mix(in
        oklch, currentColor {spotlightOpacity}%, transparent), transparent 80%)"
    ></div>
    {@render children?.()}
</Card>
