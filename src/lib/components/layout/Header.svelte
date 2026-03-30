<script lang="ts">
    import { siteConfig } from '$lib/config/site';
    import { Button } from '$lib/components/ui/button';
    import ThemeToggle from './ThemeToggle.svelte';
    import { SiGithub } from '@icons-pack/svelte-simple-icons';
    import logo from '$lib/assets/logo.svg';
    import { resolve } from '$app/paths';

    let scrolled = $state(false);
</script>

<svelte:window onscroll={() => (scrolled = window.scrollY > 0)} />

<header
    class="sticky top-0 z-50 border-b bg-background/80 backdrop-blur transition-shadow supports-backdrop-filter:bg-background/60"
    class:shadow-sm={scrolled}
>
    <nav
        class="container mx-auto flex h-14 max-w-4xl items-center justify-between px-4"
        aria-label="Main"
    >
        <a href={resolve('/')} class="flex items-center gap-2">
            <img src={logo} alt="" class="size-8" />
            <span class="hidden font-semibold sm:inline">{siteConfig.name}</span>
        </a>

        <div class="flex items-center gap-1">
            <Button
                variant="ghost"
                size="icon"
                href={siteConfig.links.github}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub"
            >
                <SiGithub class="size-4" />
            </Button>
            <ThemeToggle />
        </div>
    </nav>
</header>
