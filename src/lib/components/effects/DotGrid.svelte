<script lang="ts">
    /**
     * DotGrid.svelte — Svelte 5 canvas dot grid with physics.
     *
     * Requires `gsap` and `gsap/InertiaPlugin` (GSAP Club / Business license).
     *
     * `baseColor` and `activeColor` accept these formats:
     *   • Raw CSS value    — "#5227FF", "rgb(82,39,255)", "rebeccapurple"
     *   • CSS variable      — "var(--brand-primary)"
     *   • Tailwind v4 token — "indigo-600" → resolved via var(--color-indigo-600)
     *   • color-mix()       — "color-mix(in oklch, var(--color-primary) 50%, transparent)"
     *
     * Colors are resolved at runtime through the DOM so that CSS variables
     * and Tailwind theme tokens work correctly with canvas RGB interpolation.
     */
    import { gsap } from 'gsap';
    import { InertiaPlugin } from 'gsap/InertiaPlugin';

    gsap.registerPlugin(InertiaPlugin);

    // ── Types ───────────────────────────────────────────────────────
    interface Dot {
        cx: number;
        cy: number;
        xOffset: number;
        yOffset: number;
        _inertiaApplied: boolean;
    }

    interface Rgba {
        r: number;
        g: number;
        b: number;
        a: number;
    }

    interface Props {
        dotSize?: number;
        gap?: number;
        /** Base dot color. Hex, CSS var, or Tailwind v4 token. */
        baseColor?: string;
        /** Dot color when close to the pointer. Same formats as baseColor. */
        activeColor?: string;
        /** Base dot opacity (0–1). Applied on top of the resolved color. */
        baseOpacity?: number;
        /** Active dot opacity (0–1). Applied on top of the resolved color. */
        activeOpacity?: number;
        /** Radial vignette that fades dots toward the edges. 0 = no vignette, 1 = full fade. */
        vignette?: number;
        /** Size of the vignette ellipse as a percentage of the container. Default 100. */
        vignetteRadius?: number;
        proximity?: number;
        speedTrigger?: number;
        shockRadius?: number;
        shockStrength?: number;
        maxSpeed?: number;
        resistance?: number;
        returnDuration?: number;
        class?: string;
    }

    let {
        dotSize = 16,
        gap = 32,
        baseColor = '#5227FF',
        activeColor = '#5227FF',
        baseOpacity = 1,
        activeOpacity = 1,
        vignette = 0,
        vignetteRadius = 100,
        proximity = 150,
        speedTrigger = 100,
        shockRadius = 250,
        shockStrength = 5,
        maxSpeed = 5000,
        resistance = 750,
        returnDuration = 1.5,
        class: className = ''
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

    /**
     * Resolves any CSS color (including variables, Tailwind tokens,
     * and hsla(var(...), alpha) patterns) to an { r, g, b, a } object.
     *
     * Uses a hidden DOM element with `background-color` which preserves
     * alpha in the computed value (unlike `color` which can strip it).
     */
    function resolveToRgba(cssColor: string, container: HTMLElement): Rgba {
        const el = document.createElement('span');
        el.style.display = 'none';
        el.style.backgroundColor = cssColor;
        container.appendChild(el);
        const computed = getComputedStyle(el).backgroundColor;
        el.remove();
        const m = computed.match(
            /rgba?\(\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\s*\)/
        );
        if (!m) return { r: 0, g: 0, b: 0, a: 1 };
        return { r: +m[1], g: +m[2], b: +m[3], a: m[4] !== undefined ? +m[4] : 1 };
    }

    // ── Throttle utility ────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function throttle<T extends (...args: any[]) => void>(fn: T, limit: number): T {
        let lastCall = 0;
        return function (this: unknown, ...args: Parameters<T>) {
            const now = performance.now();
            if (now - lastCall >= limit) {
                lastCall = now;
                fn.apply(this, args);
            }
        } as T;
    }

    // ── DOM refs ────────────────────────────────────────────────────
    let wrapper = $state<HTMLDivElement | undefined>();
    let canvas = $state<HTMLCanvasElement | undefined>();

    // ── Imperative state (not reactive — mutated by rAF / GSAP) ───
    let dots: Dot[] = [];
    const pointer = {
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        speed: 0,
        lastTime: 0,
        lastX: 0,
        lastY: 0
    };

    let baseRgba: Rgba = { r: 0, g: 0, b: 0, a: 1 };
    let activeRgba: Rgba = { r: 0, g: 0, b: 0, a: 1 };
    let baseColorStr = '';

    // ── Pre-computed circle path ────────────────────────────────────
    const circlePath = $derived.by(() => {
        if (typeof window === 'undefined' || !window.Path2D) return null;
        const p = new Path2D();
        p.arc(0, 0, dotSize / 2, 0, Math.PI * 2);
        return p;
    });

    // ── Grid builder ────────────────────────────────────────────────
    function buildGrid() {
        if (!wrapper || !canvas) return;

        const { width, height } = wrapper.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;

        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        const ctx = canvas.getContext('2d');
        if (ctx) ctx.scale(dpr, dpr);

        const cell = dotSize + gap;
        const cols = Math.floor((width + gap) / cell);
        const rows = Math.floor((height + gap) / cell);

        const gridW = cell * cols - gap;
        const gridH = cell * rows - gap;
        const startX = (width - gridW) / 2 + dotSize / 2;
        const startY = (height - gridH) / 2 + dotSize / 2;

        const next: Dot[] = [];
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                next.push({
                    cx: startX + x * cell,
                    cy: startY + y * cell,
                    xOffset: 0,
                    yOffset: 0,
                    _inertiaApplied: false
                });
            }
        }
        dots = next;
    }

    // ── Theme change detection ─────────────────────────────────────
    // CSS variables resolve differently in light/dark mode but the prop
    // strings don't change, so we watch for class mutations on <html>
    // (mode-watcher toggles the `dark` class) and bump a counter to
    // force re-resolution.
    let themeVersion = $state(0);

    $effect(() => {
        const mo = new MutationObserver(() => {
            themeVersion++;
        });
        mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => mo.disconnect();
    });

    // ── Effect: resolve colors to RGB for canvas interpolation ─────
    $effect(() => {
        if (!wrapper) return;
        void themeVersion;
        const base = resolveColor(baseColor);
        const active = resolveColor(activeColor);
        baseRgba = resolveToRgba(base, wrapper);
        activeRgba = resolveToRgba(active, wrapper);
        baseColorStr = `rgba(${baseRgba.r},${baseRgba.g},${baseRgba.b},${baseOpacity})`;
    });

    // ── Effect: build grid + observe resize ─────────────────────────
    $effect(() => {
        if (!wrapper || !canvas) return;

        // Read reactive deps so the effect re-runs on prop change
        void dotSize;
        void gap;

        buildGrid();

        const ro = new ResizeObserver(buildGrid);
        ro.observe(wrapper);

        return () => ro.disconnect();
    });

    // ── Effect: canvas render loop ──────────────────────────────────
    $effect(() => {
        if (!canvas || !circlePath) return;

        // Capture reactive values for the closure
        const proxSq = proximity * proximity;
        const prox = proximity;
        const baseOp = baseOpacity;
        const activeOp = activeOpacity;

        let id: number;
        let running = true;

        function draw() {
            if (!running || !canvas) return;

            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const { x: px, y: py } = pointer;

            for (const dot of dots) {
                const ox = dot.cx + dot.xOffset;
                const oy = dot.cy + dot.yOffset;
                const dx = dot.cx - px;
                const dy = dot.cy - py;
                const dsq = dx * dx + dy * dy;

                let fill = baseColorStr;
                if (dsq <= proxSq) {
                    const dist = Math.sqrt(dsq);
                    const t = 1 - dist / prox;
                    const r = Math.round(baseRgba.r + (activeRgba.r - baseRgba.r) * t);
                    const g = Math.round(baseRgba.g + (activeRgba.g - baseRgba.g) * t);
                    const b = Math.round(baseRgba.b + (activeRgba.b - baseRgba.b) * t);
                    const a = +(baseOp + (activeOp - baseOp) * t).toFixed(3);
                    fill = `rgba(${r},${g},${b},${a})`;
                }

                ctx.save();
                ctx.translate(ox, oy);
                ctx.fillStyle = fill;
                ctx.fill(circlePath!);
                ctx.restore();
            }

            id = requestAnimationFrame(draw);
        }

        id = requestAnimationFrame(draw);

        return () => {
            running = false;
            cancelAnimationFrame(id);
        };
    });

    // ── Effect: pointer tracking + GSAP inertia ─────────────────────
    $effect(() => {
        if (!canvas) return;

        // Capture reactive values for event handlers
        const maxSpd = maxSpeed;
        const spdTrigger = speedTrigger;
        const prox = proximity;
        const res = resistance;
        const retDur = returnDuration;
        const shockR = shockRadius;
        const shockS = shockStrength;

        function applyInertia(dot: Dot, pushX: number, pushY: number) {
            dot._inertiaApplied = true;
            gsap.killTweensOf(dot);
            gsap.to(dot, {
                inertia: { xOffset: pushX, yOffset: pushY, resistance: res },
                onComplete() {
                    gsap.to(dot, {
                        xOffset: 0,
                        yOffset: 0,
                        duration: retDur,
                        ease: 'elastic.out(1,0.75)'
                    });
                    dot._inertiaApplied = false;
                }
            });
        }

        function onMove(e: MouseEvent) {
            const now = performance.now();
            const dt = pointer.lastTime ? now - pointer.lastTime : 16;
            const dx = e.clientX - pointer.lastX;
            const dy = e.clientY - pointer.lastY;

            let vx = (dx / dt) * 1000;
            let vy = (dy / dt) * 1000;
            let speed = Math.hypot(vx, vy);

            if (speed > maxSpd) {
                const scale = maxSpd / speed;
                vx *= scale;
                vy *= scale;
                speed = maxSpd;
            }

            pointer.lastTime = now;
            pointer.lastX = e.clientX;
            pointer.lastY = e.clientY;
            pointer.vx = vx;
            pointer.vy = vy;
            pointer.speed = speed;

            const rect = canvas!.getBoundingClientRect();
            pointer.x = e.clientX - rect.left;
            pointer.y = e.clientY - rect.top;

            for (const dot of dots) {
                const dist = Math.hypot(dot.cx - pointer.x, dot.cy - pointer.y);
                if (speed > spdTrigger && dist < prox && !dot._inertiaApplied) {
                    const pushX = dot.cx - pointer.x + vx * 0.005;
                    const pushY = dot.cy - pointer.y + vy * 0.005;
                    applyInertia(dot, pushX, pushY);
                }
            }
        }

        function onClick(e: MouseEvent) {
            const rect = canvas!.getBoundingClientRect();
            const cx = e.clientX - rect.left;
            const cy = e.clientY - rect.top;

            for (const dot of dots) {
                const dist = Math.hypot(dot.cx - cx, dot.cy - cy);
                if (dist < shockR && !dot._inertiaApplied) {
                    const falloff = Math.max(0, 1 - dist / shockR);
                    const pushX = (dot.cx - cx) * shockS * falloff;
                    const pushY = (dot.cy - cy) * shockS * falloff;
                    applyInertia(dot, pushX, pushY);
                }
            }
        }

        const throttledMove = throttle(onMove, 50);

        window.addEventListener('mousemove', throttledMove, { passive: true });
        window.addEventListener('click', onClick);

        return () => {
            window.removeEventListener('mousemove', throttledMove);
            window.removeEventListener('click', onClick);
        };
    });
</script>

<section class="relative flex h-full w-full items-center justify-center p-4 {className}">
    <div
        bind:this={wrapper}
        class="relative h-full w-full"
        style:mask-image={vignette > 0
            ? `radial-gradient(${vignetteRadius}% ${vignetteRadius}% at center, black ${Math.round((1 - vignette) * 70)}%, transparent ${Math.round(70 + vignette * 30)}%)`
            : undefined}
        style:-webkit-mask-image={vignette > 0
            ? `radial-gradient(${vignetteRadius}% ${vignetteRadius}% at center, black ${Math.round((1 - vignette) * 70)}%, transparent ${Math.round(70 + vignette * 30)}%)`
            : undefined}
    >
        <canvas
            bind:this={canvas}
            class="pointer-events-none absolute inset-0 h-full w-full"
            aria-hidden="true"
        ></canvas>
    </div>
</section>
