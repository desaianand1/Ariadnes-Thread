<script lang="ts">
    import { siteConfig } from '$lib/config/site';
    import { APP_VERSION, MODRINTH_ATTRIBUTION_URL } from '$lib/config/constants';
    import ModrinthWordmark from '$lib/components/icons/ModrinthWordmark.svelte';
    import { Separator } from '$lib/components/ui/separator';
</script>

<footer class="border-t py-6 text-sm text-muted-foreground">
    <div class="container mx-auto max-w-4xl px-4">
        <div class="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <!-- About -->
            <div>
                <p class="font-medium text-foreground">{siteConfig.name}</p>
                <p class="mt-1 text-xs">{siteConfig.description}</p>
            </div>

            <!-- Links -->
            <nav class="flex flex-col gap-2" aria-label="Footer">
                <a
                    href={siteConfig.links.github}
                    target="_blank"
                    rel="noopener noreferrer external"
                    class="underline underline-offset-4 hover:text-foreground">GitHub</a
                >
                <a
                    href={siteConfig.links.help}
                    rel="external"
                    class="underline underline-offset-4 hover:text-foreground">Support</a
                >
            </nav>

            <!-- Copyright -->
            <div class="text-xs">
                <p>&copy; {new Date().getFullYear()} {siteConfig.legalEntity}</p>
                <p class="mt-1">v{APP_VERSION}</p>
            </div>
        </div>

        <Separator class="my-4" />

        <p class="flex items-center justify-center gap-1.5 text-xs">
            Not affiliated with
            <a
                href={MODRINTH_ATTRIBUTION_URL}
                target="_blank"
                rel="noopener noreferrer external"
                class="inline-flex items-center underline underline-offset-4 hover:text-foreground"
            >
                <ModrinthWordmark class="h-3.5 w-auto" />
            </a>
        </p>
    </div>
</footer>
