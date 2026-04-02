<script lang="ts">
    import { MODRINTH_ATTRIBUTION_URL } from '$lib/config/constants';
    import CollectionForm from '$lib/components/forms/CollectionForm.svelte';
    import MetaTags from '$lib/components/MetaTags.svelte';
    import { Badge } from '$lib/components/ui/badge';
    import { SiModrinth } from '@icons-pack/svelte-simple-icons';
    import GradientText from '$lib/components/effects/GradientText.svelte';
    import ShinyText from '$lib/components/effects/ShinyText.svelte';
    import DotGrid from '$lib/components/effects/DotGrid.svelte';
    import type { PageData } from './$types';
    import { fly } from 'svelte/transition';
    import { browser } from '$app/environment';
    import { prefersReducedMotion, safeTransition } from '$lib/utils/motion';
    import LinkIcon from '@lucide/svelte/icons/link';
    import SettingsIcon from '@lucide/svelte/icons/settings';
    import DownloadIcon from '@lucide/svelte/icons/download';

    let { data }: { data: PageData } = $props();
</script>

<MetaTags />

<!-- Animated dot grid background -->
{#if browser && !prefersReducedMotion}
    <div class="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <DotGrid
            dotSize={4}
            gap={16}
            baseColor="var(--color-ring)"
            baseOpacity={0.05}
            activeColor="var(--color-primary)"
            activeOpacity={0.1}
            vignette={0.7}
            vignetteRadius={50}
            proximity={100}
            shockRadius={180}
            shockStrength={3}
        />
    </div>
{/if}

<div class="container mx-auto max-w-3xl p-6 pt-6">
    <!-- Hero -->
    <div
        class="my-8 flex flex-col items-center text-center"
        in:fly={safeTransition({ y: 20, duration: 400 })}
    >
        <a
            href={MODRINTH_ATTRIBUTION_URL}
            target="_blank"
            rel="noopener noreferrer external"
            class="mb-4 inline-block"
        >
            <Badge variant="outline" class="gap-1.5 py-1">
                <SiModrinth class="size-4 text-modrinth" />
                <ShinyText
                    color="var(--color-muted-foreground)"
                    shineColor="#1bd96a"
                    speed={3}
                    delay={1}
                >
                    Works with Modrinth collections
                </ShinyText>
            </Badge>
        </a>

        <h1 class="text-4xl font-bold tracking-tight sm:text-6xl">
            Get your mods in
            <GradientText
                class="inline"
                colors={['var(--gradient-start)', 'var(--gradient-mid)', 'var(--gradient-end)']}
                animationSpeed={6}
                yoyo
            >
                one click
            </GradientText>
        </h1>

        <p class="my-6 max-w-xl text-muted-foreground">
            No more downloading 50 mods one at a time, hunting for the right versions, or figuring
            out which libraries you're missing. Paste your Modrinth collection, pick your setup, and
            get a ZIP that just works.
        </p>
    </div>

    <CollectionForm data={data.form} />

    <!-- How it works -->
    <div
        class="mt-16 border-t pt-10 pb-8"
        in:fly={safeTransition({ y: 20, duration: 400, delay: 200 })}
    >
        <h2
            class="mb-6 text-center text-sm font-medium tracking-wider text-muted-foreground uppercase"
        >
            How it works
        </h2>
        <div class="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div class="flex flex-col items-center gap-2 text-center">
                <div class="flex size-10 items-center justify-center rounded-full bg-primary/10">
                    <LinkIcon class="size-5 text-primary" />
                </div>
                <p class="text-sm font-medium">Link your collections</p>
                <p class="text-xs text-muted-foreground">
                    Paste one or more Modrinth collection URLs
                </p>
            </div>
            <div class="flex flex-col items-center gap-2 text-center">
                <div class="flex size-10 items-center justify-center rounded-full bg-primary/10">
                    <SettingsIcon class="size-5 text-primary" />
                </div>
                <p class="text-sm font-medium">Choose your target</p>
                <p class="text-xs text-muted-foreground">
                    Set the Minecraft version and mod loader used across your mods
                </p>
            </div>
            <div class="flex flex-col items-center gap-2 text-center">
                <div class="flex size-10 items-center justify-center rounded-full bg-primary/10">
                    <DownloadIcon class="size-5 text-primary" />
                </div>
                <p class="text-sm font-medium">Get your mods</p>
                <p class="text-xs text-muted-foreground">
                    Download a ZIP ready to drop into your launcher or Minecraft instance
                </p>
            </div>
        </div>
    </div>
</div>
