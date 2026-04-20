<script lang="ts">
    import { onMount } from 'svelte';
    import { Tween } from 'svelte/motion';
    import { mode } from 'mode-watcher';
    import { cn } from '$lib/utils';
    import { prefersReducedMotion } from '$lib/utils/motion';

    interface AnimatedBeamProps {
        class?: string;
        container: HTMLElement;
        from: HTMLElement;
        to: HTMLElement;
        curvature?: number;
        reverse?: boolean;
        pathWidth?: number;
        pathOpacity?: number;
        delay?: number;
        duration?: number;
        repeat?: number;
        repeatDelay?: number;
        startXOffset?: number;
        startYOffset?: number;
        endXOffset?: number;
        endYOffset?: number;
        [key: string]: unknown;
    }

    let {
        class: className = '',
        container,
        from,
        to,
        curvature = 0,
        reverse = false,
        pathWidth = 2,
        pathOpacity = 0.2,
        delay = 0,
        duration = 5,
        repeat = Infinity,
        repeatDelay = 0,
        startXOffset = 0,
        startYOffset = 0,
        endXOffset = 0,
        endYOffset = 0,
        ...restProps
    }: AnimatedBeamProps = $props();

    let isDark = $derived(mode.current === 'dark');

    let resolvedPathColor = $derived(isDark ? 'oklch(0.556 0 0)' : 'oklch(0.556 0 0)');

    /**
     * Derive gradient colors from the theme's primary + gradient-mid tokens.
     */
    function resolveColor(varName: string, fallback: string): string {
        if (typeof document === 'undefined') return fallback;
        const val = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
        return val || fallback;
    }

    let resolvedStartColor = $derived.by(() => {
        void isDark;
        return isDark
            ? resolveColor('--gradient-mid', 'oklch(0.78 0.2 37)')
            : resolveColor('--gradient-mid', 'oklch(0.68 0.2 37)');
    });

    let resolvedStopColor = $derived.by(() => {
        void isDark;
        return isDark
            ? resolveColor('--primary', 'oklch(0.72 0.14 300)')
            : resolveColor('--primary', 'oklch(0.37 0.15 297.5)');
    });

    let pathD = $state('');
    let svgWidth = $state(0);
    let svgHeight = $state(0);
    let gradientId = $state('');
    let mounted = $state(false);

    const progress = new Tween(0);

    let gradX1 = $derived(reverse ? 90 - progress.current * 100 : 10 + progress.current * 100);
    let gradX2 = $derived(reverse ? 100 - progress.current * 100 : progress.current * 100);

    function createCubicBezier(
        x1: number,
        y1: number,
        x2: number,
        y2: number
    ): (t: number) => number {
        const ax = 3 * x1 - 3 * x2 + 1;
        const bx = 3 * x2 - 6 * x1;
        const cx = 3 * x1;
        const ay = 3 * y1 - 3 * y2 + 1;
        const by = 3 * y2 - 6 * y1;
        const cy = 3 * y1;

        function sampleX(t: number) {
            return ((ax * t + bx) * t + cx) * t;
        }
        function sampleY(t: number) {
            return ((ay * t + by) * t + cy) * t;
        }
        function sampleDerivX(t: number) {
            return (3 * ax * t + 2 * bx) * t + cx;
        }

        function solveX(x: number) {
            let t = x;
            for (let i = 0; i < 8; i++) {
                const slope = sampleDerivX(t);
                if (Math.abs(slope) < 1e-6) break;
                t -= (sampleX(t) - x) / slope;
            }
            return t;
        }

        return (t: number) => {
            if (t <= 0) return 0;
            if (t >= 1) return 1;
            return sampleY(solveX(t));
        };
    }

    const easeOutExpo = createCubicBezier(0.16, 1, 0.3, 1);

    onMount(() => {
        gradientId = `beam-${crypto.randomUUID().slice(0, 8)}`;
        mounted = true;

        function updatePath() {
            if (!container || !from || !to) return;

            const containerRect = container.getBoundingClientRect();
            const fromRect = from.getBoundingClientRect();
            const toRect = to.getBoundingClientRect();

            svgWidth = containerRect.width;
            svgHeight = containerRect.height;

            const startX = fromRect.left - containerRect.left + fromRect.width / 2 + startXOffset;
            const startY = fromRect.top - containerRect.top + fromRect.height / 2 + startYOffset;
            const endX = toRect.left - containerRect.left + toRect.width / 2 + endXOffset;
            const endY = toRect.top - containerRect.top + toRect.height / 2 + endYOffset;

            const controlY = startY - curvature;
            pathD = `M ${startX},${startY} Q ${(startX + endX) / 2},${controlY} ${endX},${endY}`;
        }

        const observer = new ResizeObserver(updatePath);
        if (container) observer.observe(container);
        updatePath();

        if (prefersReducedMotion) {
            // Show the beam at midpoint position, no animation
            progress.set(0.5, { duration: 0 });
            return () => observer.disconnect();
        }

        let alive = true;

        async function loop() {
            let iterations = 0;
            while (alive) {
                await progress.set(0, { duration: 0 });
                await progress.set(1, {
                    duration: duration * 1000,
                    delay: delay * 1000,
                    easing: easeOutExpo
                });
                iterations++;
                if (repeat !== Infinity && iterations >= repeat) break;
                if (repeatDelay > 0 && alive) {
                    await new Promise((r) => setTimeout(r, repeatDelay * 1000));
                }
            }
        }
        loop();

        return () => {
            alive = false;
            observer.disconnect();
        };
    });
</script>

{#if mounted && gradientId}
    <svg
        fill="none"
        width={svgWidth}
        height={svgHeight}
        xmlns="http://www.w3.org/2000/svg"
        class={cn('pointer-events-none absolute top-0 left-0 transform-gpu stroke-2', className)}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        {...restProps}
    >
        <path
            d={pathD}
            stroke={resolvedPathColor}
            stroke-width={pathWidth}
            stroke-opacity={pathOpacity}
            stroke-linecap="round"
        />
        <path
            d={pathD}
            stroke-width={pathWidth}
            stroke={`url(#${gradientId})`}
            stroke-opacity="1"
            stroke-linecap="round"
        />
        <defs>
            <linearGradient
                id={gradientId}
                gradientUnits="userSpaceOnUse"
                x1="{gradX1}%"
                x2="{gradX2}%"
                y1="0%"
                y2="0%"
            >
                <stop stop-color={resolvedStartColor} stop-opacity="0" />
                <stop stop-color={resolvedStartColor} />
                <stop offset="32.5%" stop-color={resolvedStopColor} />
                <stop offset="100%" stop-color={resolvedStopColor} stop-opacity="0" />
            </linearGradient>
        </defs>
    </svg>
{/if}
