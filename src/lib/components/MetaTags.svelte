<script lang="ts">
    import { siteConfig } from '$lib/config/site';

    interface Props {
        title?: string;
        description?: string;
        path?: string;
    }

    let { title, description = siteConfig.description, path = '' }: Props = $props();

    let pageTitle = $derived(title ? `${title} | ${siteConfig.name}` : siteConfig.name);
    let canonicalUrl = $derived(`${siteConfig.url}${path}`);
</script>

<svelte:head>
    <title>{pageTitle}</title>
    <meta name="description" content={description} />
    <link rel="canonical" href={canonicalUrl} />

    <!-- Open Graph -->
    <meta property="og:type" content="website" />
    <meta property="og:title" content={pageTitle} />
    <meta property="og:description" content={description} />
    <meta property="og:url" content={canonicalUrl} />
    <meta property="og:site_name" content={siteConfig.name} />
    <meta property="og:locale" content={siteConfig.locale} />
    {#if siteConfig.ogImage}
        <meta property="og:image" content="{siteConfig.url}{siteConfig.ogImage}" />
    {/if}

    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content={pageTitle} />
    <meta name="twitter:description" content={description} />
</svelte:head>
