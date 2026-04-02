<script lang="ts">
    /**
     * GradientText.svelte — Svelte 5 animated gradient text component.
     *
     * Colors accept three formats:
     *   • Raw CSS value   — "#5227FF", "oklch(0.7 0.15 250)", "red"
     *   • CSS variable     — "var(--brand-accent)"
     *   • Tailwind v4 token — "blue-500" → resolved to "var(--color-blue-500)"
     *
     * The component uses requestAnimationFrame for a frame-perfect,
     * jank-free gradient animation loop with optional yoyo and pause-on-hover.
     */
    import type { Snippet } from 'svelte';
    import { cn } from '$lib/utils';
    interface Props {
        children: Snippet;
        /** Extra classes forwarded to the wrapper element. */
        class?: string;
        /**
         * Gradient color stops.
         * Accepts raw hex (`#5227FF`), CSS variables (`var(--brand)`),
         * or Tailwind v4 theme tokens (`blue-500` → `var(--color-blue-500)`).
         */
        colors?: string[];
        /** Duration of one full sweep in seconds. */
        animationSpeed?: number;
        /** Show an animated gradient border around the text. */
        showBorder?: boolean;
        /** Gradient sweep direction. */
        direction?: 'horizontal' | 'vertical' | 'diagonal';
        /** Freeze the animation while the pointer is over the element. */
        pauseOnHover?: boolean;
        /** Reverse at each end instead of looping continuously. */
        yoyo?: boolean;
    }

    let {
        children,
        class: className = '',
        colors = ['#5227FF', '#FF9FFC', '#B19EEF'],
        animationSpeed = 8,
        showBorder = false,
        direction = 'horizontal',
        pauseOnHover = false,
        yoyo = true
    }: Props = $props();

    let isInline = $derived(className.includes('inline'));

    // ── Color resolution ────────────────────────────────────────────
    // Tailwind v4 exposes every theme color as `--color-{name}`.
    // We detect bare tokens like "blue-500" and wrap them automatically.
    const TAILWIND_TOKEN = /^[a-z]+-\d{1,3}$/; // e.g. "sky-400", "rose-50"

    function resolveColor(raw: string): string {
        if (
            raw.startsWith('#') ||
            raw.startsWith('var(') ||
            raw.startsWith('rgb') ||
            raw.startsWith('hsl') ||
            raw.startsWith('oklch') ||
            raw.startsWith('oklab')
        ) {
            return raw; // already a valid CSS value
        }
        if (TAILWIND_TOKEN.test(raw)) {
            return `var(--color-${raw})`;
        }
        // Named CSS color ("red", "rebeccapurple") or other valid value
        return raw;
    }

    // ── Derived styles ──────────────────────────────────────────────
    let progress = $state(0);
    let isPaused = $state(false);

    // Non-reactive bookkeeping — no need to trigger re-renders
    let elapsed = 0;
    let lastTime: number | null = null;

    const duration = $derived(animationSpeed * 1000);

    const resolvedColors = $derived(colors.map(resolveColor));
    // Append first stop for seamless wrap-around
    const colorString = $derived([...resolvedColors, resolvedColors[0]].join(', '));

    const angle = $derived(
        direction === 'horizontal'
            ? 'to right'
            : direction === 'vertical'
              ? 'to bottom'
              : 'to bottom right'
    );

    const bgImage = $derived(`linear-gradient(${angle}, ${colorString})`);

    const bgSize = $derived(
        direction === 'horizontal'
            ? '300% 100%'
            : direction === 'vertical'
              ? '100% 300%'
              : '300% 300%'
    );

    const bgPosition = $derived(direction === 'vertical' ? `50% ${progress}%` : `${progress}% 50%`);

    // ── Animation loop ──────────────────────────────────────────────
    function tick(time: number) {
        if (isPaused) {
            lastTime = null;
            return;
        }

        if (lastTime === null) {
            lastTime = time;
            return;
        }

        const dt = time - lastTime;
        lastTime = time;
        elapsed += dt;

        if (yoyo) {
            const cycle = elapsed % (duration * 2);
            progress =
                cycle < duration
                    ? (cycle / duration) * 100
                    : 100 - ((cycle - duration) / duration) * 100;
        } else {
            progress = (elapsed / duration) * 100;
        }
    }

    // Start / teardown the rAF loop
    $effect(() => {
        let running = true;
        let id: number;

        function loop(time: number) {
            if (!running) return;
            tick(time);
            id = requestAnimationFrame(loop);
        }

        id = requestAnimationFrame(loop);

        return () => {
            running = false;
            cancelAnimationFrame(id);
        };
    });

    // Reset on config change
    $effect(() => {
        // Read deps so Svelte tracks them
        void animationSpeed;
        void yoyo;

        elapsed = 0;
        progress = 0;
        lastTime = null;
    });

    // ── Interaction ─────────────────────────────────────────────────
    function onpointerenter() {
        if (pauseOnHover) isPaused = true;
    }

    function onpointerleave() {
        if (pauseOnHover) isPaused = false;
    }
</script>

<!--
  role="presentation" silences the a11y lint for non-interactive handlers.
  The pointer events are purely decorative (pause animation), not functional.
-->
<span
    class={cn(
        'gradient-text-root relative cursor-pointer overflow-hidden transition-shadow duration-500',
        isInline ? '' : 'mx-auto flex max-w-fit items-center justify-center font-medium',
        showBorder ? 'rounded-[1.25rem] px-2 py-1 backdrop-blur' : '',
        className
    )}
    {onpointerenter}
    {onpointerleave}
    role="presentation"
>
    {#if showBorder}
        <span
            class="pointer-events-none absolute inset-0 z-0 rounded-[1.25rem]"
            style:background-image={bgImage}
            style:background-size={bgSize}
            style:background-position={bgPosition}
            style:background-repeat="repeat"
            aria-hidden="true"
        >
            <span
                class="absolute -z-1 rounded-[1.25rem] bg-(--gradient-text-bg,#000)"
                style="inset:1px"
            ></span>
        </span>
    {/if}

    <span
        class="relative z-[2] inline-block bg-clip-text text-transparent"
        style:background-image={bgImage}
        style:background-size={bgSize}
        style:background-position={bgPosition}
        style:background-repeat="repeat"
        style:-webkit-background-clip="text"
    >
        {@render children()}
    </span>
</span>
