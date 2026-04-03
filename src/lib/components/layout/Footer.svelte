<script lang="ts">
    import { siteConfig } from '$lib/config/site';
    import { APP_VERSION, MODRINTH_ATTRIBUTION_URL } from '$lib/config/constants';
    import ModrinthWordmark from '$lib/components/icons/ModrinthWordmark.svelte';
    import { SiGithub, SiKofi, SiBuymeacoffee } from '@icons-pack/svelte-simple-icons';
    import MailIcon from '@lucide/svelte/icons/mail';
    import * as Tooltip from '$lib/components/ui/tooltip';
    import logo from '$lib/assets/logo.svg';

    const year = new Date().getFullYear();
</script>

<footer class="border-t">
    <div
        class="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-3"
    >
        <!-- Left: brand + links -->
        <div class="flex flex-wrap items-center gap-1">
            <a href="/" class="flex items-center gap-2" aria-label="{siteConfig.name} home">
                <img src={logo} alt="" class="size-5" />
                <span class="font-semibold">{siteConfig.name}</span>
            </a>

            <span class="mx-1.5 text-muted-foreground/40">&middot;</span>

            <Tooltip.Root>
                <Tooltip.Trigger>
                    {#snippet child({ props })}
                        <a
                            href={siteConfig.links.github}
                            target="_blank"
                            rel="noopener noreferrer external"
                            class="inline-flex items-center rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground"
                            aria-label="GitHub"
                            {...props}
                        >
                            <SiGithub class="size-4" />
                        </a>
                    {/snippet}
                </Tooltip.Trigger>
                <Tooltip.Content>GitHub</Tooltip.Content>
            </Tooltip.Root>

            <Tooltip.Root>
                <Tooltip.Trigger>
                    {#snippet child({ props })}
                        <a
                            href={siteConfig.links.help}
                            rel="external"
                            class="inline-flex items-center rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground"
                            aria-label="Support"
                            {...props}
                        >
                            <MailIcon class="size-4" />
                        </a>
                    {/snippet}
                </Tooltip.Trigger>
                <Tooltip.Content>Support</Tooltip.Content>
            </Tooltip.Root>

            {#if siteConfig.links.kofi}
                <a
                    href={siteConfig.links.kofi}
                    target="_blank"
                    rel="noopener noreferrer external"
                    class="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:text-[#FF5E5B]"
                >
                    <SiKofi class="size-4" />
                    Ko-Fi
                </a>
            {/if}

            {#if siteConfig.links.buymeacoffee}
                <a
                    href={siteConfig.links.buymeacoffee}
                    target="_blank"
                    rel="noopener noreferrer external"
                    class="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:text-[#BD5F00] dark:hover:text-[#FFDD00]"
                >
                    <SiBuymeacoffee class="size-4" />
                    Buy Me a Coffee
                </a>
            {/if}
        </div>

        <!-- Right: attribution + copyright -->
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span class="flex items-center gap-1.5">
                Not affiliated with
                <a
                    href={MODRINTH_ATTRIBUTION_URL}
                    target="_blank"
                    rel="noopener noreferrer external"
                    class="inline-flex items-center underline-offset-4 transition-colors hover:text-foreground hover:underline"
                    aria-label="Modrinth"
                >
                    <ModrinthWordmark class="h-3.5 w-auto" />
                </a>
            </span>
            <span class="text-muted-foreground/50">&middot;</span>
            <span>&copy; {year} {siteConfig.legalEntity} &middot; v{APP_VERSION}</span>
        </div>
    </div>
</footer>
