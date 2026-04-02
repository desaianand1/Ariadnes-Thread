<script lang="ts">
    import { siteConfig } from '$lib/config/site';

    interface Props {
        title?: string;
        description?: string;
        path?: string;
        image?: string;
        imageWidth?: number;
        imageHeight?: number;
    }

    let {
        title,
        description = siteConfig.description,
        path = '',
        image = siteConfig.ogImage,
        imageWidth = 1200,
        imageHeight = 630
    }: Props = $props();

    let pageTitle = $derived(title ? `${title} | ${siteConfig.name}` : siteConfig.name);
    let canonicalUrl = $derived(`${siteConfig.url}${path}`);
    let imageUrl = $derived(image?.startsWith('http') ? image : `${siteConfig.url}${image}`);
</script>

<svelte:head>
    <title>{pageTitle}</title>
    <meta name="description" content={description} />
    <meta name="keywords" content={siteConfig.keywords.join(', ')} />
    <meta name="author" content={siteConfig.author.name} />
    <link rel="canonical" href={canonicalUrl} />

    <!-- Open Graph -->
    <meta property="og:type" content="website" />
    <meta property="og:title" content={pageTitle} />
    <meta property="og:description" content={description} />
    <meta property="og:url" content={canonicalUrl} />
    <meta property="og:site_name" content={siteConfig.name} />
    <meta property="og:locale" content={siteConfig.locale} />
    {#if image}
        <meta property="og:image" content={imageUrl} />
        <meta property="og:image:width" content={String(imageWidth)} />
        <meta property="og:image:height" content={String(imageHeight)} />
    {/if}

    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content={pageTitle} />
    <meta name="twitter:description" content={description} />
    {#if image}
        <meta name="twitter:image" content={imageUrl} />
    {/if}
</svelte:head>
