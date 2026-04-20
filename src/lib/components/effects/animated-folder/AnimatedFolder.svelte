<script module lang="ts">
    import type { Snippet } from 'svelte';

    export interface FolderProps {
        color?: string;
        size?: number;
        items?: Snippet[];
        class?: string;
    }
</script>

<script lang="ts">
    import { cn } from '$lib/utils';
    import FileTextIcon from '@lucide/svelte/icons/file-text';

    const MAX_ITEMS = 3;
    const TAILWIND_TOKEN = /^[a-z]+-\d{1,3}$/;

    let { color = '#7c3aed', size = 1, items = [], class: className = '' }: FolderProps = $props();

    const defaultFiles = [
        { name: 'botania.jar', color: '#4ade80' },
        { name: 'fabric-api.jar', color: '#60a5fa' },
        { name: 'patchouli.jar', color: '#c084fc' }
    ];

    let open = $state(false);
    let paperOffsets = $state<{ x: number; y: number }[]>(
        Array.from({ length: MAX_ITEMS }, () => ({ x: 0, y: 0 }))
    );

    function resolveColor(raw: string): string {
        if (TAILWIND_TOKEN.test(raw)) return `var(--color-${raw})`;
        return raw;
    }

    let resolvedColor = $derived(resolveColor(color));
    let folderBackColor = $derived(`color-mix(in oklch, ${resolvedColor} 92%, black)`);

    const paperColors = ['#e6e6e6', '#f2f2f2', '#ffffff'];

    const papers = $derived.by(() => {
        const p: (Snippet | undefined)[] = items.slice(0, MAX_ITEMS);
        while (p.length < MAX_ITEMS) p.push(undefined);
        return p;
    });

    function handleClick() {
        if (open) {
            paperOffsets = Array.from({ length: MAX_ITEMS }, () => ({ x: 0, y: 0 }));
        }
        open = !open;
    }

    function handlePaperMouseMove(e: MouseEvent, index: number) {
        if (!open) return;
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        paperOffsets[index] = {
            x: (e.clientX - centerX) * 0.15,
            y: (e.clientY - centerY) * 0.15
        };
    }

    function handlePaperMouseLeave(index: number) {
        paperOffsets[index] = { x: 0, y: 0 };
    }

    function getOpenTransform(index: number): string {
        if (index === 0) return 'translate(-120%, -70%) rotate(-15deg)';
        if (index === 1) return 'translate(10%, -70%) rotate(15deg)';
        if (index === 2) return 'translate(-50%, -100%) rotate(5deg)';
        return '';
    }

    const paperSizes: Record<number, { open: string; closed: string }> = {
        0: { open: 'w-[70%] h-[80%]', closed: 'w-[70%] h-[80%]' },
        1: { open: 'w-[80%] h-[80%]', closed: 'w-[80%] h-[70%]' },
        2: { open: 'w-[90%] h-[80%]', closed: 'w-[90%] h-[60%]' }
    };
</script>

<div style:transform="scale({size})" class={className}>
    <div
        class={cn(
            'group relative cursor-pointer transition-all duration-200 ease-in',
            !open && 'hover:-translate-y-2'
        )}
        style:transform={open ? 'translateY(-8px)' : undefined}
        onclick={handleClick}
        onkeydown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') handleClick();
        }}
        role="button"
        tabindex="0"
    >
        <div
            class="relative h-[80px] w-[100px] rounded-tl-none rounded-tr-[10px] rounded-br-[10px] rounded-bl-[10px]"
            style:background-color={folderBackColor}
        >
            <!-- Folder tab -->
            <span
                class="absolute bottom-[98%] left-0 z-0 h-[10px] w-[30px] rounded-tl-[5px] rounded-tr-[5px] rounded-br-none rounded-bl-none"
                style:background-color={folderBackColor}
            ></span>

            {#each papers as paper, i (i)}
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                    onmousemove={(e) => handlePaperMouseMove(e, i)}
                    onmouseleave={() => handlePaperMouseLeave(i)}
                    class={cn(
                        'absolute bottom-[10%] left-1/2 z-20 rounded-[10px] transition-all duration-300 ease-in-out',
                        !open && '-translate-x-1/2 translate-y-[10%] group-hover:translate-y-0',
                        open && 'hover:scale-110',
                        open ? paperSizes[i]?.open : paperSizes[i]?.closed
                    )}
                    style:background-color={paperColors[i]}
                    style:transform={open
                        ? `${getOpenTransform(i)} translate(${paperOffsets[i].x}px, ${paperOffsets[i].y}px)`
                        : undefined}
                >
                    {#if paper}
                        {@render paper()}
                    {:else}
                        <div class="flex h-full flex-col items-center justify-center gap-1 p-1.5">
                            <FileTextIcon class="size-4 shrink-0" color={defaultFiles[i].color} />
                            <span
                                class="w-full truncate text-center text-[6px] leading-tight font-medium text-neutral-500"
                            >
                                {defaultFiles[i].name}
                            </span>
                        </div>
                    {/if}
                </div>
            {/each}

            <div
                class={cn(
                    'absolute z-30 h-full w-full origin-bottom rounded-[5px_10px_10px_10px] transition-all duration-300 ease-in-out',
                    !open && 'group-hover:[transform:skew(15deg)_scaleY(0.6)]'
                )}
                style:background-color={resolvedColor}
                style:transform={open ? 'skew(15deg) scaleY(0.6)' : undefined}
            ></div>

            <div
                class={cn(
                    'absolute z-30 h-full w-full origin-bottom rounded-[5px_10px_10px_10px] transition-all duration-300 ease-in-out',
                    !open && 'group-hover:[transform:skew(-15deg)_scaleY(0.6)]'
                )}
                style:background-color={resolvedColor}
                style:transform={open ? 'skew(-15deg) scaleY(0.6)' : undefined}
            ></div>
        </div>
    </div>
</div>
