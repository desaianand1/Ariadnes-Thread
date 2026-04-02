<script lang="ts">
    import { siteConfig } from '$lib/config/site';
    import { APP_VERSION } from '$lib/config/constants';

    const structuredData = {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: siteConfig.name,
        description: siteConfig.description,
        url: siteConfig.url,
        applicationCategory: 'GameApplication',
        operatingSystem: 'Any',
        browserRequirements: 'Requires JavaScript',
        softwareVersion: APP_VERSION,
        author: {
            '@type': 'Organization',
            name: siteConfig.author.name,
            url: siteConfig.author.url
        },
        offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'USD'
        }
    };

    const jsonLd = JSON.stringify(structuredData);
</script>

<svelte:head>
    <!-- eslint-disable-next-line svelte/no-at-html-tags -- all data is from trusted siteConfig constants -->
    {@html `<script type="application/ld+json">${jsonLd}${'<'}/script>`}
</svelte:head>
