<script lang="ts">
    /**
     * ShinyText.svelte — Svelte 5 animated shine-across-text component.
     *
     * A linear highlight sweeps over the text on a loop.
     * Supports yoyo, directional sweep, inter-cycle delay,
     * pause-on-hover, and disabled state.
     *
     * `color` and `shineColor` accept the same three formats as GradientText:
     *   • Raw CSS value   — "#b5b5b5", "oklch(0.75 0 0)", "gray"
     *   • CSS variable     — "var(--muted)"
     *   • Tailwind v4 token — "zinc-400" → "var(--color-zinc-400)"
     */
    import type { Snippet } from 'svelte';

    interface Props {
        children: Snippet;
        /** Disable the animation entirely (text stays base color). */
        disabled?: boolean;
        /** Duration of one sweep in seconds. */
        speed?: number;
        /** Extra classes forwarded to the wrapper `<span>`. */
        class?: string;
        /** Base text color. Hex, CSS var, or Tailwind v4 token. */
        color?: string;
        /** Highlight color at the shine peak. Same formats as `color`. */
        shineColor?: string;
        /** Angle width of the shine band in degrees. */
        spread?: number;
        /** Reverse at each end instead of looping in one direction. */
        yoyo?: boolean;
        /** Freeze the animation while the pointer is over the element. */
        pauseOnHover?: boolean;
        /** Sweep direction. */
        direction?: 'left' | 'right';
        /** Pause between cycles in seconds. */
        delay?: number;
    }

    let {
        children,
        disabled = false,
        speed = 2,
        class: className = '',
        color = '#b5b5b5',
        shineColor = '#ffffff',
        spread = 120,
        yoyo = false,
        pauseOnHover = false,
        direction = 'left',
        delay = 0
    }: Props = $props();

    // ── Color resolution ────────────────────────────────────────────
    const TAILWIND_TOKEN = /^[a-z]+-\d{1,3}$/;

    function resolveColor(raw: string): string {
        if (
            raw.startsWith('#') ||
            raw.startsWith('var(') ||
            raw.startsWith('rgb') ||
            raw.startsWith('hsl') ||
            raw.startsWith('oklch') ||
            raw.startsWith('oklab')
        ) {
            return raw;
        }
        if (TAILWIND_TOKEN.test(raw)) {
            return `var(--color-${raw})`;
        }
        return raw;
    }

    // ── Reactive state ──────────────────────────────────────────────
    let progress = $state(0);
    let isPaused = $state(false);

    // Non-reactive bookkeeping
    let elapsed = 0;
    let lastTime: number | null = null;

    const animDuration = $derived(speed * 1000);
    const delayDuration = $derived(delay * 1000);
    const dirSign = $derived(direction === 'left' ? 1 : -1);

    const resolvedColor = $derived(resolveColor(color));
    const resolvedShine = $derived(resolveColor(shineColor));

    const bgImage = $derived(
        `linear-gradient(${spread}deg, ${resolvedColor} 0%, ${resolvedColor} 35%, ${resolvedShine} 50%, ${resolvedColor} 65%, ${resolvedColor} 100%)`
    );

    // p = 0 → 150% (shine off-screen right), p = 100 → -50% (off-screen left)
    const bgPosition = $derived(`${150 - progress * 2}% center`);

    // ── Animation loop ──────────────────────────────────────────────
    function tick(time: number) {
        if (disabled || isPaused) {
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
            const cycleDuration = animDuration + delayDuration;
            const fullCycle = cycleDuration * 2;
            const t = elapsed % fullCycle;

            let p: number;
            if (t < animDuration) {
                // Forward sweep: 0 → 100
                p = (t / animDuration) * 100;
            } else if (t < cycleDuration) {
                // Delay at far end
                p = 100;
            } else if (t < cycleDuration + animDuration) {
                // Reverse sweep: 100 → 0
                p = 100 - ((t - cycleDuration) / animDuration) * 100;
            } else {
                // Delay at start
                p = 0;
            }

            progress = dirSign === 1 ? p : 100 - p;
        } else {
            const cycleDuration = animDuration + delayDuration;
            const t = elapsed % cycleDuration;

            const p = t < animDuration ? (t / animDuration) * 100 : 100;
            progress = dirSign === 1 ? p : 100 - p;
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

    // Reset when direction changes
    $effect(() => {
        void direction;
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

<span
    class="inline-block {className}"
    style:background-image={bgImage}
    style:background-size="200% auto"
    style:background-position={bgPosition}
    style:background-clip="text"
    style:-webkit-background-clip="text"
    style:-webkit-text-fill-color="transparent"
    role="presentation"
    {onpointerenter}
    {onpointerleave}
>
    {@render children()}
</span>
