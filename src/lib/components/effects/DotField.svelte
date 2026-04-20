<script lang="ts">
    import { onMount } from 'svelte';
    import { mode } from 'mode-watcher';
    import { cn } from '$lib/utils';
    import { prefersReducedMotion } from '$lib/utils/motion';
    import type { Snippet } from 'svelte';

    const TWO_PI = Math.PI * 2;

    interface Dot {
        ax: number;
        ay: number;
        sx: number;
        sy: number;
        vx: number;
        vy: number;
        x: number;
        y: number;
    }

    interface DotFieldProps {
        dotRadius?: number;
        dotSpacing?: number;
        cursorRadius?: number;
        cursorForce?: number;
        bulgeOnly?: boolean;
        bulgeStrength?: number;
        sparkle?: boolean;
        waveAmplitude?: number;
        class?: string;
        children?: Snippet;
        [key: string]: unknown;
    }

    let {
        dotRadius = 1.5,
        dotSpacing = 14,
        cursorRadius = 500,
        cursorForce = 0.1,
        bulgeOnly = true,
        bulgeStrength = 67,
        sparkle = false,
        waveAmplitude = 0,
        class: className = '',
        children,
        ...restProps
    }: DotFieldProps = $props();

    let isDark = $derived(mode.current === 'dark');

    function resolveColor(varName: string, fallback: string): string {
        if (typeof document === 'undefined') return fallback;
        const val = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
        return val || fallback;
    }

    let resolvedGradientFrom = $derived.by(() => {
        void isDark;
        return isDark
            ? resolveColor('--ring', 'oklch(0.6 0.12 300 / 0.35)')
            : resolveColor('--ring', 'oklch(0.5 0.16 300 / 0.25)');
    });

    let resolvedGradientTo = $derived.by(() => {
        void isDark;
        return isDark
            ? resolveColor('--primary', 'oklch(0.72 0.14 300 / 0.25)')
            : resolveColor('--primary', 'oklch(0.37 0.15 297.5 / 0.15)');
    });

    let canvasEl: HTMLCanvasElement;
    let rebuildDots: (() => void) | null = null;

    onMount(() => {
        if (prefersReducedMotion) {
            // Render a single static frame
            const ctx = canvasEl.getContext('2d', { alpha: true });
            if (!ctx) return;
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const parent = canvasEl.parentElement;
            if (!parent) return;
            const rect = parent.getBoundingClientRect();
            canvasEl.width = rect.width * dpr;
            canvasEl.height = rect.height * dpr;
            canvasEl.style.width = `${rect.width}px`;
            canvasEl.style.height = `${rect.height}px`;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            const step = dotRadius + dotSpacing;
            const cols = Math.floor(rect.width / step);
            const rows = Math.floor(rect.height / step);
            const padX = (rect.width % step) / 2;
            const padY = (rect.height % step) / 2;
            const rad = dotRadius / 2;

            const grad = ctx.createLinearGradient(0, 0, rect.width, rect.height);
            grad.addColorStop(0, resolvedGradientFrom);
            grad.addColorStop(1, resolvedGradientTo);
            ctx.fillStyle = grad;
            ctx.beginPath();

            for (let row = 0; row < rows; row++) {
                for (let col = 0; col < cols; col++) {
                    const x = padX + col * step + step / 2;
                    const y = padY + row * step + step / 2;
                    ctx.moveTo(x + rad, y);
                    ctx.arc(x, y, rad, 0, TWO_PI);
                }
            }
            ctx.fill();
            return;
        }

        const ctx = canvasEl.getContext('2d', { alpha: true })!;

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        let dots: Dot[] = [];
        const mouse = { x: -9999, y: -9999, prevX: -9999, prevY: -9999, speed: 0 };
        const size = { w: 0, h: 0, offsetX: 0, offsetY: 0 };
        let engagement = 0;
        let frameCount = 0;
        let rafId: number;
        let resizeTimer: ReturnType<typeof setTimeout>;

        function buildDots(w: number, h: number) {
            const step = dotRadius + dotSpacing;
            const cols = Math.floor(w / step);
            const rows = Math.floor(h / step);
            const padX = (w % step) / 2;
            const padY = (h % step) / 2;
            dots = new Array(rows * cols);
            let idx = 0;

            for (let row = 0; row < rows; row++) {
                for (let col = 0; col < cols; col++) {
                    const ax = padX + col * step + step / 2;
                    const ay = padY + row * step + step / 2;
                    dots[idx++] = { ax, ay, sx: ax, sy: ay, vx: 0, vy: 0, x: ax, y: ay };
                }
            }
        }

        function doResize() {
            const parent = canvasEl.parentElement;
            if (!parent) return;
            const rect = parent.getBoundingClientRect();
            const w = rect.width;
            const h = rect.height;

            canvasEl.width = w * dpr;
            canvasEl.height = h * dpr;
            canvasEl.style.width = `${w}px`;
            canvasEl.style.height = `${h}px`;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            size.w = w;
            size.h = h;
            size.offsetX = rect.left + window.scrollX;
            size.offsetY = rect.top + window.scrollY;

            buildDots(w, h);
        }

        function onResize() {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(doResize, 100);
        }

        function onMouseMove(e: MouseEvent) {
            mouse.x = e.pageX - size.offsetX;
            mouse.y = e.pageY - size.offsetY;
        }

        function updateMouseSpeed() {
            const dx = mouse.prevX - mouse.x;
            const dy = mouse.prevY - mouse.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            mouse.speed += (dist - mouse.speed) * 0.5;
            if (mouse.speed < 0.001) mouse.speed = 0;
            mouse.prevX = mouse.x;
            mouse.prevY = mouse.y;
        }

        const speedInterval = setInterval(updateMouseSpeed, 20);

        function tick() {
            frameCount++;
            const len = dots.length;
            const t = frameCount * 0.02;
            const { w, h } = size;

            const targetEngagement = Math.min(mouse.speed / 5, 1);
            engagement += (targetEngagement - engagement) * 0.06;
            if (engagement < 0.001) engagement = 0;

            ctx.clearRect(0, 0, w, h);

            const grad = ctx.createLinearGradient(0, 0, w, h);
            grad.addColorStop(0, resolvedGradientFrom);
            grad.addColorStop(1, resolvedGradientTo);
            ctx.fillStyle = grad;

            const crSq = cursorRadius * cursorRadius;
            const rad = dotRadius / 2;

            ctx.beginPath();

            for (let i = 0; i < len; i++) {
                const d = dots[i];
                const dx = mouse.x - d.ax;
                const dy = mouse.y - d.ay;
                const distSq = dx * dx + dy * dy;

                if (distSq < crSq && engagement > 0.01) {
                    const dist = Math.sqrt(distSq);
                    if (bulgeOnly) {
                        const falloff = 1 - dist / cursorRadius;
                        const push = falloff * falloff * bulgeStrength * engagement;
                        const angle = Math.atan2(dy, dx);
                        d.sx += (d.ax - Math.cos(angle) * push - d.sx) * 0.15;
                        d.sy += (d.ay - Math.sin(angle) * push - d.sy) * 0.15;
                    } else {
                        const angle = Math.atan2(dy, dx);
                        const move = (500 / dist) * (mouse.speed * cursorForce);
                        d.vx += Math.cos(angle) * -move;
                        d.vy += Math.sin(angle) * -move;
                    }
                } else if (bulgeOnly) {
                    d.sx += (d.ax - d.sx) * 0.1;
                    d.sy += (d.ay - d.sy) * 0.1;
                }

                if (!bulgeOnly) {
                    d.vx *= 0.9;
                    d.vy *= 0.9;
                    d.x = d.ax + d.vx;
                    d.y = d.ay + d.vy;
                    d.sx += (d.x - d.sx) * 0.1;
                    d.sy += (d.y - d.sy) * 0.1;
                }

                let drawX = d.sx;
                let drawY = d.sy;
                if (waveAmplitude > 0) {
                    drawY += Math.sin(d.ax * 0.03 + t) * waveAmplitude;
                    drawX += Math.cos(d.ay * 0.03 + t * 0.7) * waveAmplitude * 0.5;
                }

                if (sparkle) {
                    const hash = ((i * 2654435761) ^ (frameCount >> 3)) >>> 0;
                    if (hash % 100 < 3) {
                        ctx.moveTo(drawX + rad * 1.8, drawY);
                        ctx.arc(drawX, drawY, rad * 1.8, 0, TWO_PI);
                    } else {
                        ctx.moveTo(drawX + rad, drawY);
                        ctx.arc(drawX, drawY, rad, 0, TWO_PI);
                    }
                } else {
                    ctx.moveTo(drawX + rad, drawY);
                    ctx.arc(drawX, drawY, rad, 0, TWO_PI);
                }
            }

            ctx.fill();
            rafId = requestAnimationFrame(tick);
        }

        doResize();
        window.addEventListener('resize', onResize);
        window.addEventListener('mousemove', onMouseMove, { passive: true });
        rafId = requestAnimationFrame(tick);

        rebuildDots = () => {
            if (size.w > 0 && size.h > 0) buildDots(size.w, size.h);
        };

        return () => {
            cancelAnimationFrame(rafId);
            clearInterval(speedInterval);
            clearTimeout(resizeTimer);
            window.removeEventListener('resize', onResize);
            window.removeEventListener('mousemove', onMouseMove);
        };
    });

    $effect(() => {
        void dotRadius;
        void dotSpacing;
        rebuildDots?.();
    });
</script>

<div class={cn('relative h-full w-full', className)} {...restProps}>
    <canvas bind:this={canvasEl} class="absolute inset-0 h-full w-full"></canvas>

    {#if children}
        {@render children()}
    {/if}
</div>
