<script lang="ts">
    import * as FormPrimitive from 'formsnap';
    import { cn, type WithoutChild } from '$lib/utils.js';
    import { slide } from 'svelte/transition';
    import { safeTransition } from '$lib/utils/motion';

    let {
        ref = $bindable(null),
        class: className,
        errorClasses,
        children: childrenProp,
        ...restProps
    }: WithoutChild<FormPrimitive.FieldErrorsProps> & {
        errorClasses?: string | undefined | null;
    } = $props();
</script>

<FormPrimitive.FieldErrors
    bind:ref
    class={cn('text-sm font-medium text-destructive', className)}
    {...restProps}
>
    {#snippet children({ errors, errorProps })}
        {#if childrenProp}
            {@render childrenProp({ errors, errorProps })}
        {:else}
            {#each errors as error (error)}
                <div transition:slide={safeTransition({ duration: 120 })}>
                    <div {...errorProps} class={cn(errorClasses)}>{error}</div>
                </div>
            {/each}
        {/if}
    {/snippet}
</FormPrimitive.FieldErrors>
