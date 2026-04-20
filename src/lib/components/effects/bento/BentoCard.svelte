<script module lang="ts">
    import type { Snippet, Component } from 'svelte';
    import type { HTMLAttributes } from 'svelte/elements';

    export interface BentoCardProps extends HTMLAttributes<HTMLDivElement> {
        name: string;
        class?: string;
        background?: Snippet;
        icon: Component<{ class?: string }>;
        description: string;
        href?: string;
        cta?: string;
    }
</script>

<script lang="ts">
    import { cn } from '$lib/utils';
    import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
    import { Button } from '$lib/components/ui/button';

    let {
        name,
        class: className,
        background,
        icon: Icon,
        description,
        href,
        cta,
        ...restProps
    }: BentoCardProps = $props();
</script>

<div
    class={cn(
        'group relative col-span-3 flex flex-col justify-between overflow-hidden rounded-xl',
        'bg-background [box-shadow:0_0_0_1px_oklch(0_0_0/0.03),0_1px_2px_oklch(0_0_0/0.03),0_4px_12px_oklch(0_0_0/0.03)]',
        'transform-gpu dark:bg-background dark:[box-shadow:0_-20px_80px_-20px_oklch(1_0_0/0.12)_inset] dark:[border:1px_solid_oklch(1_0_0/0.1)]',
        className
    )}
    {...restProps}
>
    <div class="relative flex-1">
        {#if background}
            {@render background()}
        {/if}
    </div>

    <div class="relative z-10 bg-linear-to-t from-background via-background/80 to-transparent p-4">
        <div
            class={cn(
                'pointer-events-none z-10 flex transform-gpu flex-col gap-1 transition-all duration-300',
                cta && 'lg:group-hover:-translate-y-10'
            )}
        >
            <Icon
                class={cn(
                    'h-12 w-12 origin-left transform-gpu text-foreground/70 transition-all duration-300 ease-in-out',
                    cta && 'group-hover:scale-75'
                )}
            />
            <h3 class="text-xl font-semibold text-foreground">
                {name}
            </h3>
            <p class="max-w-lg text-muted-foreground">{description}</p>
        </div>

        {#if cta && href}
            <div
                class={cn(
                    'pointer-events-none flex w-full translate-y-0 transform-gpu flex-row items-center transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 lg:hidden'
                )}
            >
                <Button variant="link" size="sm" class="pointer-events-auto p-0" {href}>
                    {cta}
                    <ArrowRightIcon class="ms-2 h-4 w-4 rtl:rotate-180" />
                </Button>
            </div>
        {/if}
    </div>

    {#if cta && href}
        <div
            class={cn(
                'pointer-events-none absolute bottom-0 hidden w-full translate-y-10 transform-gpu flex-row items-center p-4 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 lg:flex'
            )}
        >
            <Button variant="link" size="sm" class="pointer-events-auto p-0" {href}>
                {cta}
                <ArrowRightIcon class="ms-2 h-4 w-4 rtl:rotate-180" />
            </Button>
        </div>
    {/if}

    <div
        class="pointer-events-none absolute inset-0 transform-gpu transition-all duration-300 group-hover:bg-foreground/3"
    ></div>
</div>
