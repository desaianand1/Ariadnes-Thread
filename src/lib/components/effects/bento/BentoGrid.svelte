<script module lang="ts">
    import type { Snippet } from 'svelte';
    import type { HTMLAttributes } from 'svelte/elements';

    export interface BentoGridProps extends HTMLAttributes<HTMLDivElement> {
        children: Snippet;
        class?: string;
    }
</script>

<script lang="ts">
    import { cn } from '$lib/utils';

    let { children, class: className, ...restProps }: BentoGridProps = $props();
</script>

<div class={cn('grid w-full grid-cols-3 gap-4', className)} {...restProps}>
    {@render children()}
</div>
