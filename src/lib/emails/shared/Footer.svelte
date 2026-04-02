<script lang="ts">
    import { Text, Link } from 'better-svelte-email/components';
    import { siteConfig } from '$lib/config/site';

    let {
        supportEmail = siteConfig.supportEmail,
        year = new Date().getFullYear().toString()
    }: {
        supportEmail?: string;
        year?: string;
    } = $props();
</script>

<Text class="mt-8 text-center text-xs text-gray-400">
    {siteConfig.name} ·
    <Link href="mailto:{supportEmail}" class="text-gray-400 underline">{supportEmail}</Link>
</Text>
<Text class="text-center text-xs text-gray-400">
    &copy; {year}
    {siteConfig.legalEntity}. All rights reserved.
</Text>
