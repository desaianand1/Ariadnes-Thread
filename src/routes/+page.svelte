<script lang="ts">
    import { MODRINTH_ATTRIBUTION_URL } from '$lib/config/constants';
    import CollectionForm from '$lib/components/forms/CollectionForm.svelte';
    import MetaTags from '$lib/components/MetaTags.svelte';
    import StructuredData from '$lib/components/StructuredData.svelte';
    import { Badge } from '$lib/components/ui/badge';
    import { SiModrinth } from '@icons-pack/svelte-simple-icons';
    import GradientText from '$lib/components/effects/GradientText.svelte';
    import ShinyText from '$lib/components/effects/ShinyText.svelte';
    import DotField from '$lib/components/effects/DotField.svelte';
    import DependencyFlow from '$lib/components/effects/DependencyFlow.svelte';
    import LogoMarquee from '$lib/components/effects/LogoMarquee.svelte';
    import AvatarStack from '$lib/components/effects/AvatarStack.svelte';
    import { AnimatedFolder } from '$lib/components/effects/animated-folder';
    import { BentoGrid, BentoCard } from '$lib/components/effects/bento';
    import { cn } from '$lib/utils';
    import { getTextColorByModLoader } from '$lib/utils/colors';
    import { prefersReducedMotion } from '$lib/utils/motion';
    import { browser } from '$app/environment';
    import { mode } from 'mode-watcher';
    import { onMount } from 'svelte';
    import type { PageData } from './$types';

    import GitBranchIcon from '@lucide/svelte/icons/git-branch';
    import LayersIcon from '@lucide/svelte/icons/layers';
    import UsersIcon from '@lucide/svelte/icons/users';
    import PackageIcon from '@lucide/svelte/icons/package';

    let { data }: { data: PageData } = $props();

    const folderColor = $derived(mode.current === 'dark' ? 'blue-400' : 'blue-500');

    const loaderLogos = [
        {
            src: '/images/loaders/fabric.png',
            alt: 'Fabric',
            name: 'Fabric',
            slug: 'fabric',
            showName: true
        },
        {
            src: '/images/loaders/forge.svg',
            alt: 'Forge',
            name: 'Forge',
            slug: 'forge',
            showName: false
        },
        {
            src: '/images/loaders/neoforge.png',
            alt: 'NeoForge',
            name: 'NeoForge',
            slug: 'neoforge',
            showName: false
        },
        {
            src: '/images/loaders/quilt.svg',
            alt: 'Quilt',
            name: 'Quilt',
            slug: 'quilt',
            showName: true
        },
        {
            src: '/images/loaders/liteloader.png',
            alt: 'LiteLoader',
            name: 'LiteLoader',
            slug: 'liteloader',
            showName: true
        }
    ];

    const playerAvatars = [
        { src: '/images/players/Steve.png', alt: 'Steve', name: 'Steve' },
        { src: '/images/players/Alex.png', alt: 'Alex', name: 'Alex' },
        { src: '/images/players/Notch.png', alt: 'Notch', name: 'Notch' },
        {
            src: '/images/players/CaptainSparklez.png',
            alt: 'Captain Sparklez',
            name: 'Captain Sparklez'
        },
        { src: '/images/players/MumboJumbo.png', alt: 'MumboJumbo', name: 'MumboJumbo' },
        { src: '/images/players/Keralis1.png', alt: 'Keralis', name: 'Keralis' },
        { src: '/images/players/SethBling.png', alt: 'Seth Bling', name: 'Seth Bling' },
        { src: '/images/players/Enderman.png', alt: 'Enderman ?!', name: 'Enderman ?!' }
    ];

    // Hero entrance animation via GSAP
    let heroEl: HTMLDivElement;
    let badgeEl: HTMLElement;
    let headlineEl: HTMLElement;
    let subtitleEl: HTMLElement;
    let formEl: HTMLDivElement;
    let dotFieldReady = $state(false);

    // Responsive avatar count
    let isDesktop = $state(true);

    onMount(async () => {
        dotFieldReady = true;

        const mql = window.matchMedia('(min-width: 1024px)');
        isDesktop = mql.matches;
        const onMediaChange = (e: MediaQueryListEvent) => {
            isDesktop = e.matches;
        };
        mql.addEventListener('change', onMediaChange);

        if (!prefersReducedMotion) {
            const { gsap } = await import('gsap');

            const tl = gsap.timeline();
            tl.fromTo(heroEl, { opacity: 0 }, { opacity: 1, duration: 0.6 }, 0);
            tl.fromTo(badgeEl, { y: -10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3 }, 0.15);
            tl.fromTo(headlineEl, { y: 15, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4 }, 0.3);
            tl.fromTo(subtitleEl, { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3 }, 0.45);
            tl.fromTo(formEl, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4 }, 0.6);
        }

        return () => mql.removeEventListener('change', onMediaChange);
    });

    // IntersectionObserver for bento card fade-in
    let bentoSectionEl: HTMLElement;
    let bentoVisible = $state(false);

    $effect(() => {
        if (!browser || !bentoSectionEl) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    bentoVisible = true;
                    observer.disconnect();
                }
            },
            { threshold: 0.1 }
        );
        observer.observe(bentoSectionEl);

        return () => observer.disconnect();
    });
</script>

<MetaTags />
<StructuredData />

<!-- Hero with DotField background -->
<section class="relative min-h-svh" aria-label="Create modpacks from Modrinth collections">
    {#if browser && dotFieldReady}
        <DotField
            class="pointer-events-none absolute inset-x-0 top-0 -bottom-48 -z-10"
            dotRadius={1.5}
            dotSpacing={18}
            cursorRadius={400}
            bulgeStrength={50}
        >
            <div
                class="pointer-events-none absolute inset-0
                    bg-[radial-gradient(ellipse_75%_75%_at_50%_40%,var(--color-background)_35%,transparent_70%)]"
            ></div>
            <!-- Bottom fade so dots dissolve smoothly into the next section -->
            <div
                class="pointer-events-none absolute inset-x-0 bottom-0 h-64 bg-linear-to-t from-background to-transparent"
            ></div>
        </DotField>
    {/if}

    <div class="relative z-10 container mx-auto max-w-3xl p-6 pt-6">
        <div
            bind:this={heroEl}
            class="my-8 flex flex-col items-center text-center"
            style:opacity={prefersReducedMotion ? '1' : '0'}
        >
            <a
                bind:this={badgeEl}
                href={MODRINTH_ATTRIBUTION_URL}
                target="_blank"
                rel="noopener noreferrer external"
                class="mb-4 inline-block"
                style:opacity={prefersReducedMotion ? '1' : '0'}
            >
                <Badge variant="outline" class="gap-1.5 py-1">
                    <SiModrinth class="size-4 text-modrinth" />
                    <ShinyText
                        color="var(--color-muted-foreground)"
                        shineColor="var(--color-modrinth)"
                        speed={3}
                        delay={1}
                    >
                        For Modrinth collections
                    </ShinyText>
                </Badge>
            </a>

            <h1
                bind:this={headlineEl}
                class="text-4xl font-bold tracking-tight sm:text-6xl"
                style:opacity={prefersReducedMotion ? '1' : '0'}
            >
                From collection to modpack
                <GradientText
                    class="inline"
                    colors={['var(--gradient-start)', 'var(--gradient-mid)', 'var(--gradient-end)']}
                    animationSpeed={6}
                    yoyo
                >
                    in seconds
                </GradientText>
            </h1>

            <p
                bind:this={subtitleEl}
                class="my-6 max-w-xl text-muted-foreground"
                style:opacity={prefersReducedMotion ? '1' : '0'}
            >
                Paste your Modrinth collection URL, pick your setup and download a ready-to-play
                mods folder.
            </p>
        </div>

        <div bind:this={formEl} style:opacity={prefersReducedMotion ? '1' : '0'}>
            <CollectionForm data={data.form} />
        </div>
    </div>
</section>

<section
    bind:this={bentoSectionEl}
    class="relative container mx-auto max-w-5xl px-6 py-12"
    aria-label="How it works"
>
    <h2
        class={cn(
            'mb-12 text-center text-sm font-medium tracking-widest text-muted-foreground uppercase sm:text-base',
            'transition-[transform,opacity] duration-700 motion-reduce:translate-y-0 motion-reduce:duration-0',
            bentoVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
        )}
    >
        How it works
    </h2>

    <BentoGrid
        class="mb-16 auto-rows-[20rem] grid-cols-1 lg:grid-cols-3 lg:grid-rows-[22rem_20rem]"
    >
        <!-- Row 1: Dependencies (2 col) + Share (1 col) -->
        <BentoCard
            name="Sorts out your dependencies"
            description="e.g. Botanic Additions needs Botania, Patchouli & more — we handle it."
            icon={GitBranchIcon}
            class={cn(
                'transition-[transform,opacity] duration-700 motion-reduce:translate-y-0 motion-reduce:duration-0 lg:col-span-2',
                bentoVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
            )}
        >
            {#snippet background()}
                <div class="absolute inset-0 flex items-center justify-center opacity-80">
                    <DependencyFlow />
                </div>
            {/snippet}
        </BentoCard>

        <BentoCard
            name="Share with friends"
            description="Send a link to your friends. Everyone gets their mods, ready to play!"
            icon={UsersIcon}
            class={cn(
                'transition-[transform,opacity] delay-100 duration-700 motion-reduce:translate-y-0 motion-reduce:duration-0 lg:col-span-1',
                bentoVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
            )}
        >
            {#snippet background()}
                <div class="absolute inset-0 flex items-center justify-center">
                    <AvatarStack
                        avatars={playerAvatars}
                        maxVisible={isDesktop ? playerAvatars.length : 4}
                        size="md"
                    />
                </div>
            {/snippet}
        </BentoCard>

        <!-- Row 2: Packaged (1 col) + Loaders (2 col) — zigzag stagger -->
        <BentoCard
            name="Neatly packaged"
            description="Download a ZIP ready for your Minecraft launcher."
            icon={PackageIcon}
            class={cn(
                'transition-[transform,opacity] delay-200 duration-700 motion-reduce:translate-y-0 motion-reduce:duration-0 lg:col-span-1',
                bentoVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
            )}
        >
            {#snippet background()}
                <div class="absolute inset-0 flex items-end justify-center">
                    <AnimatedFolder color={folderColor} size={1.1} />
                </div>
            {/snippet}
        </BentoCard>

        <BentoCard
            name="Works with every mod loader"
            description="Fabric, Forge, Quilt, NeoForge — pick yours."
            icon={LayersIcon}
            class={cn(
                'transition-[transform,opacity] delay-300 duration-700 motion-reduce:translate-y-0 motion-reduce:duration-0 lg:col-span-2',
                bentoVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
            )}
        >
            {#snippet background()}
                <div class="absolute inset-0 flex items-end overflow-hidden px-4 pb-4">
                    <LogoMarquee
                        logos={loaderLogos}
                        speed={40}
                        logoHeight={48}
                        gap={48}
                        fadeOut
                        pauseOnHover
                        scaleOnHover
                        ariaLabel="Supported mod loaders"
                    >
                        {#snippet renderItem(item, _index)}
                            {@const logo = item as (typeof loaderLogos)[number]}
                            <div class="flex items-center gap-2">
                                <img
                                    src={logo.src}
                                    alt={logo.alt}
                                    class={cn('object-contain', logo.showName ? 'size-12' : 'h-8')}
                                    loading="lazy"
                                    decoding="async"
                                />
                                {#if logo.showName}
                                    <span
                                        class={cn(
                                            'text-lg font-extrabold sm:text-2xl',
                                            getTextColorByModLoader(logo.slug)
                                        )}>{logo.name}</span
                                    >
                                {/if}
                            </div>
                        {/snippet}
                    </LogoMarquee>
                </div>
            {/snippet}
        </BentoCard>
    </BentoGrid>
</section>
