<script lang="ts">
    import AnimatedBeam from './AnimatedBeam.svelte';
    import FileArchiveIcon from '@lucide/svelte/icons/file-archive';
    import { cn } from '$lib/utils';

    interface DependencyFlowProps {
        class?: string;
    }

    let { class: className = '' }: DependencyFlowProps = $props();

    const dependencies = [
        { name: 'HammerLib', icon: '/images/mods/hammerlib.png' },
        { name: 'Botania', icon: '/images/mods/botania.png' },
        { name: 'Fabric API', icon: '/images/mods/fabric-api.png' },
        { name: 'Patchouli', icon: '/images/mods/patchouli.png' },
        { name: 'Trinkets', icon: '/images/mods/trinkets.png' }
    ];

    const target = { name: 'Botanic Additions', icon: '/images/mods/botanic-additions.png' };

    let containerEl = $state<HTMLDivElement>();
    let depRefs = $state<HTMLDivElement[]>([]);
    let targetRef = $state<HTMLDivElement>();
    let outputRef = $state<HTMLDivElement>();

    let ready = $derived(
        !!containerEl &&
            !!targetRef &&
            !!outputRef &&
            depRefs.filter(Boolean).length === dependencies.length
    );
</script>

<div
    bind:this={containerEl}
    class={cn(
        'relative flex h-full w-full items-center justify-between gap-6 px-6 py-8',
        className
    )}
>
    <!-- Left: Dependencies -->
    <div class="z-1 flex flex-col items-center gap-3">
        {#each dependencies as dep, i (dep.name)}
            <div
                bind:this={depRefs[i]}
                class="z-1 flex size-9 items-center justify-center rounded-full border border-border bg-background shadow-sm"
            >
                <img src={dep.icon} alt={dep.name} class="size-6 rounded-sm" loading="lazy" />
            </div>
        {/each}
    </div>

    <!-- Center: Target mod -->
    <div
        bind:this={targetRef}
        class="z-1 flex size-14 shrink-0 items-center justify-center rounded-full border-2 border-primary/30 bg-background shadow-md"
    >
        <img src={target.icon} alt={target.name} class="size-10 rounded-sm" loading="lazy" />
    </div>

    <!-- Right: Output ZIP -->
    <div
        bind:this={outputRef}
        class="z-1 flex size-14 shrink-0 items-center justify-center rounded-full border-2 border-blue-500/30 bg-background shadow-md"
    >
        <FileArchiveIcon class="size-7 text-blue-500 dark:text-blue-400" />
    </div>

    <!-- Beams: each dependency → target -->
    {#if ready}
        {#each depRefs as depRef, i (i)}
            {#if depRef}
                <AnimatedBeam
                    container={containerEl}
                    from={depRef}
                    to={targetRef}
                    curvature={0}
                    duration={6}
                    delay={i * 0.6}
                    repeatDelay={1}
                    pathWidth={1.5}
                    pathOpacity={0.15}
                />
            {/if}
        {/each}

        <!-- Beam: target → output -->
        <AnimatedBeam
            container={containerEl}
            from={targetRef}
            to={outputRef}
            curvature={0}
            duration={6}
            delay={1}
            repeatDelay={1}
            pathWidth={2}
            pathOpacity={0.2}
        />
    {/if}
</div>
