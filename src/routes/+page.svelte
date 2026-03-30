<script lang="ts">
    import { siteConfig } from '$lib/config/site';
    import { MODRINTH_ATTRIBUTION_URL } from '$lib/config/constants';
    import CollectionForm from '$lib/components/forms/CollectionForm.svelte';
    import MetaTags from '$lib/components/MetaTags.svelte';
    import { Badge } from '$lib/components/ui/badge';
    import { SiModrinth } from '@icons-pack/svelte-simple-icons';
    import logo from '$lib/assets/logo.svg';
    import type { PageData } from './$types';
    import { fade } from 'svelte/transition';

    let { data }: { data: PageData } = $props();
</script>

<MetaTags />

<div class="container mx-auto max-w-2xl p-6 pt-8" in:fade={{ duration: 200 }}>
    <!-- Hero -->
    <div class="mb-12 flex flex-col items-center text-center">
        <img src={logo} alt="{siteConfig.name} logo" class="mb-4 size-20" />
        <h1 class="text-3xl font-bold tracking-tight">{siteConfig.name}</h1>
        <p class="mt-2 max-w-md text-muted-foreground">{siteConfig.description}</p>

        <a
            href={MODRINTH_ATTRIBUTION_URL}
            target="_blank"
            rel="noopener noreferrer external"
            class="mt-3 inline-block"
        >
            <Badge variant="outline" class="gap-1.5">
                <SiModrinth class="size-3.5 text-modrinth" />
                For use with Modrinth
            </Badge>
        </a>

        <ol class="mt-6 flex items-center gap-4 text-sm text-muted-foreground">
            <li class="flex flex-col items-center gap-1">
                <span
                    class="flex size-7 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground transition-transform hover:scale-110"
                    >1</span
                >
                Paste URLs
            </li>
            <span class="text-muted-foreground/50" aria-hidden="true">&rarr;</span>
            <li class="flex flex-col items-center gap-1">
                <span
                    class="flex size-7 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground transition-transform hover:scale-110"
                    >2</span
                >
                Configure
            </li>
            <span class="text-muted-foreground/50" aria-hidden="true">&rarr;</span>
            <li class="flex flex-col items-center gap-1">
                <span
                    class="flex size-7 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground transition-transform hover:scale-110"
                    >3</span
                >
                Download
            </li>
        </ol>
    </div>

    <CollectionForm data={data.form} />
</div>
