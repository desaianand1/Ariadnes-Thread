<script lang="ts">
    import { onMount, type Snippet } from 'svelte';
    import { prefersReducedMotion } from 'svelte/motion';
    import { cn } from '$lib/utils';

    const SMOOTH_TAU = 0.25;
    const MIN_COPIES = 2;
    const COPY_HEADROOM = 2;

    interface LogoImageItem {
        src: string;
        alt?: string;
        href?: string;
        title?: string;
        srcSet?: string;
        sizes?: string;
        width?: number;
        height?: number;
    }

    type LogoItem = LogoImageItem | Record<string, unknown>;

    interface LogoMarqueeProps {
        logos: LogoItem[];
        speed?: number;
        direction?: 'left' | 'right' | 'up' | 'down';
        width?: number | string;
        logoHeight?: number;
        gap?: number;
        pauseOnHover?: boolean;
        hoverSpeed?: number;
        fadeOut?: boolean;
        fadeOutColor?: string;
        scaleOnHover?: boolean;
        renderItem?: Snippet<[item: LogoItem, index: number]>;
        ariaLabel?: string;
        class?: string;
        [key: string]: unknown;
    }

    let {
        logos,
        speed = 120,
        direction = 'left',
        width = '100%',
        logoHeight = 28,
        gap = 32,
        pauseOnHover,
        hoverSpeed,
        fadeOut = false,
        fadeOutColor,
        scaleOnHover = false,
        renderItem,
        ariaLabel = 'Partner logos',
        class: className = '',
        ...restProps
    }: LogoMarqueeProps = $props();

    let containerEl: HTMLDivElement;
    let trackEl: HTMLDivElement;
    let seqEl: HTMLUListElement;

    let seqWidth = $state(0);
    let seqHeight = $state(0);
    let copyCount = $state(MIN_COPIES);
    let isHovered = $state(false);

    let isVertical = $derived(direction === 'up' || direction === 'down');

    let targetVelocity = $derived.by(() => {
        const magnitude = Math.abs(speed);
        const dirMul = isVertical ? (direction === 'up' ? 1 : -1) : direction === 'left' ? 1 : -1;
        return magnitude * dirMul * (speed < 0 ? -1 : 1);
    });

    let effectiveHoverSpeed = $derived.by(() => {
        if (hoverSpeed !== undefined) return hoverSpeed;
        if (pauseOnHover === true) return 0;
        if (pauseOnHover === false) return undefined;
        return 0;
    });

    let extraCopies = $derived(Array.from({ length: Math.max(0, copyCount - 1) }, (_, i) => i + 1));

    let containerCssWidth = $derived.by(() => {
        const cssLen = typeof width === 'number' ? `${width}px` : width;
        if (isVertical) return cssLen === '100%' ? undefined : cssLen;
        return cssLen ?? '100%';
    });

    function isImageItem(item: LogoItem): item is LogoImageItem {
        return 'src' in item && typeof (item as LogoImageItem).src === 'string';
    }

    function updateDimensions() {
        if (!containerEl || !seqEl) return;

        const containerWidth = containerEl.clientWidth;
        const rect = seqEl.getBoundingClientRect();

        if (isVertical) {
            const parentHeight = containerEl.parentElement?.clientHeight ?? 0;
            if (parentHeight > 0) {
                containerEl.style.height = `${Math.ceil(parentHeight)}px`;
            }
            if (rect.height > 0) {
                seqHeight = Math.ceil(rect.height);
                const viewport = containerEl.clientHeight || parentHeight || rect.height;
                copyCount = Math.max(MIN_COPIES, Math.ceil(viewport / rect.height) + COPY_HEADROOM);
            }
        } else if (rect.width > 0) {
            seqWidth = Math.ceil(rect.width);
            copyCount = Math.max(
                MIN_COPIES,
                Math.ceil(containerWidth / rect.width) + COPY_HEADROOM
            );
        }
    }

    onMount(() => {
        let rafId: number;
        let lastTs: number | null = null;
        let offset = 0;
        let velocity = 0;

        function animate(ts: number) {
            if (lastTs === null) lastTs = ts;
            const dt = Math.max(0, ts - lastTs) / 1000;
            lastTs = ts;

            if (prefersReducedMotion.current) {
                trackEl.style.transform = 'translate3d(0,0,0)';
                rafId = requestAnimationFrame(animate);
                return;
            }

            const target =
                isHovered && effectiveHoverSpeed !== undefined
                    ? effectiveHoverSpeed
                    : targetVelocity;

            const ease = 1 - Math.exp(-dt / SMOOTH_TAU);
            velocity += (target - velocity) * ease;

            const seqSize = isVertical ? seqHeight : seqWidth;
            if (seqSize > 0) {
                offset = (((offset + velocity * dt) % seqSize) + seqSize) % seqSize;
                trackEl.style.transform = isVertical
                    ? `translate3d(0,${-offset}px,0)`
                    : `translate3d(${-offset}px,0,0)`;
            }

            rafId = requestAnimationFrame(animate);
        }

        rafId = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(rafId);
    });

    $effect(() => {
        void logos;
        void gap;
        void logoHeight;
        void isVertical;

        if (!containerEl || !seqEl) return;

        const observer = new ResizeObserver(updateDimensions);
        observer.observe(containerEl);
        observer.observe(seqEl);
        updateDimensions();

        return () => observer.disconnect();
    });

    $effect(() => {
        void logos;
        if (!seqEl) return;

        const images = seqEl.querySelectorAll<HTMLImageElement>('img');
        if (images.length === 0) {
            updateDimensions();
            return;
        }

        let remaining = images.length;
        const onLoad = () => {
            remaining--;
            if (remaining === 0) updateDimensions();
        };

        images.forEach((img) => {
            if (img.complete) {
                onLoad();
            } else {
                img.addEventListener('load', onLoad, { once: true });
                img.addEventListener('error', onLoad, { once: true });
            }
        });

        return () => {
            images.forEach((img) => {
                img.removeEventListener('load', onLoad);
                img.removeEventListener('error', onLoad);
            });
        };
    });
</script>

{#snippet logoItem(item: LogoItem, itemIndex: number)}
    <li
        class={cn(
            'flex-none text-(length:--logoloop-logoHeight) leading-none',
            isVertical ? 'mb-(--logoloop-gap)' : 'mr-(--logoloop-gap)',
            scaleOnHover && 'group/item overflow-visible'
        )}
        role="listitem"
    >
        {#if renderItem}
            {@render renderItem(item, itemIndex)}
        {:else if isImageItem(item)}
            {@const imgClass = cn(
                'pointer-events-none block h-[var(--logoloop-logoHeight)] w-auto object-contain',
                '[-webkit-user-drag:none] [image-rendering:-webkit-optimize-contrast]',
                'motion-reduce:transition-none',
                scaleOnHover &&
                    'transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] group-hover/item:scale-120'
            )}
            {#if item.href}
                <a
                    class="inline-flex items-center rounded no-underline transition-opacity duration-200 ease-linear hover:opacity-80 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-current"
                    href={item.href}
                    aria-label={item.alt ?? item.title ?? 'logo link'}
                    target="_blank"
                    rel="noreferrer noopener"
                >
                    <img
                        class={imgClass}
                        src={item.src}
                        srcset={item.srcSet}
                        sizes={item.sizes}
                        width={item.width}
                        height={item.height}
                        alt={item.alt ?? ''}
                        title={item.title}
                        loading="lazy"
                        decoding="async"
                        draggable="false"
                    />
                </a>
            {:else}
                <img
                    class={imgClass}
                    src={item.src}
                    srcset={item.srcSet}
                    sizes={item.sizes}
                    width={item.width}
                    height={item.height}
                    alt={item.alt ?? ''}
                    title={item.title}
                    loading="lazy"
                    decoding="async"
                    draggable="false"
                />
            {/if}
        {/if}
    </li>
{/snippet}

<div
    bind:this={containerEl}
    class={cn(
        'group relative',
        isVertical ? 'inline-block h-full overflow-hidden' : 'overflow-x-hidden',
        scaleOnHover && 'py-[calc(var(--logoloop-logoHeight)*0.1)]',
        className
    )}
    style:--logoloop-gap="{gap}px"
    style:--logoloop-logoHeight="{logoHeight}px"
    style:--logoloop-fadeColor={fadeOutColor || undefined}
    style:width={containerCssWidth}
    role="region"
    aria-label={ariaLabel}
    {...restProps}
>
    {#if fadeOut}
        {#if isVertical}
            <div
                aria-hidden="true"
                class="pointer-events-none absolute inset-x-0 top-0 z-10 h-[clamp(24px,8%,120px)]
					bg-linear-to-b from-(--logoloop-fadeColor,var(--color-background)) to-transparent"
            ></div>
            <div
                aria-hidden="true"
                class="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[clamp(24px,8%,120px)]
					bg-linear-to-t from-(--logoloop-fadeColor,var(--color-background)) to-transparent"
            ></div>
        {:else}
            <div
                aria-hidden="true"
                class="pointer-events-none absolute inset-y-0 left-0 z-10 w-[clamp(24px,8%,120px)]
					bg-linear-to-r from-(--logoloop-fadeColor,var(--color-background)) to-transparent"
            ></div>
            <div
                aria-hidden="true"
                class="pointer-events-none absolute inset-y-0 right-0 z-10 w-[clamp(24px,8%,120px)]
					bg-linear-to-l from-(--logoloop-fadeColor,var(--color-background)) to-transparent"
            ></div>
        {/if}
    {/if}

    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        bind:this={trackEl}
        class={cn(
            'relative z-0 flex will-change-transform select-none',
            'motion-reduce:transform-none',
            isVertical ? 'h-max w-full flex-col' : 'w-max flex-row'
        )}
        onmouseenter={() => {
            if (effectiveHoverSpeed !== undefined) isHovered = true;
        }}
        onmouseleave={() => {
            if (effectiveHoverSpeed !== undefined) isHovered = false;
        }}
    >
        <ul bind:this={seqEl} class={cn('flex items-center', isVertical && 'flex-col')} role="list">
            {#each logos as item, i (i)}
                {@render logoItem(item, i)}
            {/each}
        </ul>

        {#each extraCopies as copy (copy)}
            <ul
                class={cn('flex items-center', isVertical && 'flex-col')}
                role="list"
                aria-hidden="true"
            >
                {#each logos as item, i (i)}
                    {@render logoItem(item, i)}
                {/each}
            </ul>
        {/each}
    </div>
</div>
