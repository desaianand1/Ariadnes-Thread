<script lang="ts">
    import { siteConfig } from '$lib/config/site';
    import { Button } from '$lib/components/ui/button';
    import * as Tooltip from '$lib/components/ui/tooltip';
    import ThemeToggle from './ThemeToggle.svelte';
    import { SiGithub, SiKofi, SiBuymeacoffee } from '@icons-pack/svelte-simple-icons';
    import logo from '$lib/assets/logo.svg';
    import { resolve } from '$app/paths';

    let scrolled = $state(false);
</script>

<svelte:window onscroll={() => (scrolled = window.scrollY > 0)} />

<header
    class="sticky top-0 z-45 border-b bg-background/80 backdrop-blur transition-shadow supports-backdrop-filter:bg-background/60"
    class:shadow-sm={scrolled}
>
    <nav
        class="container mx-auto flex h-14 max-w-7xl items-center justify-between px-4"
        aria-label="Main"
    >
        <a href={resolve('/')} class="flex items-center gap-2">
            <img src={logo} alt="" class="size-8" />
            <span class="hidden font-semibold sm:inline">{siteConfig.name}</span>
        </a>

        <div class="flex items-center gap-1">
            <Tooltip.Root>
                <Tooltip.Trigger>
                    {#snippet child({ props })}
                        <Button
                            variant="ghost"
                            size="icon"
                            href={siteConfig.links.github}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="GitHub"
                            {...props}
                        >
                            <SiGithub class="size-4" />
                        </Button>
                    {/snippet}
                </Tooltip.Trigger>
                <Tooltip.Content>GitHub</Tooltip.Content>
            </Tooltip.Root>

            {#if siteConfig.links.kofi}
                <Tooltip.Root>
                    <Tooltip.Trigger>
                        {#snippet child({ props })}
                            <Button
                                variant="ghost"
                                size="icon"
                                class="hover:bg-[#FF5E5B]/10 hover:text-[#FF5E5B]"
                                href={siteConfig.links.kofi}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label="Ko-Fi"
                                {...props}
                            >
                                <SiKofi class="size-4" />
                            </Button>
                        {/snippet}
                    </Tooltip.Trigger>
                    <Tooltip.Content>Ko-Fi</Tooltip.Content>
                </Tooltip.Root>
            {/if}

            {#if siteConfig.links.buymeacoffee}
                <Tooltip.Root>
                    <Tooltip.Trigger>
                        {#snippet child({ props })}
                            <Button
                                variant="ghost"
                                size="icon"
                                class="hover:bg-[#FFDD00]/10 hover:text-[#BD5F00] dark:hover:text-[#FFDD00]"
                                href={siteConfig.links.buymeacoffee}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label="Buy Me a Coffee"
                                {...props}
                            >
                                <SiBuymeacoffee class="size-4" />
                            </Button>
                        {/snippet}
                    </Tooltip.Trigger>
                    <Tooltip.Content>Buy Me a Coffee</Tooltip.Content>
                </Tooltip.Root>
            {/if}

            <ThemeToggle />
        </div>
    </nav>
</header>
