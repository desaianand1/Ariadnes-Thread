<script lang="ts">
    import {
        Html,
        Head,
        Body,
        Container,
        Section,
        Heading,
        Text,
        Button,
        Preview,
        Hr
    } from 'better-svelte-email/components';
    import Footer from './shared/Footer.svelte';
    import { siteConfig } from '$lib/config/site';

    let {
        curatorName = 'A friend',
        message = '',
        collectionNames = 'Essential Mods',
        shareUrl = `${siteConfig.url}/review?c=abc123&v=1.20.1&l=fabric`,
        year = new Date().getFullYear().toString(),
        supportEmail = siteConfig.supportEmail
    }: {
        curatorName?: string;
        message?: string;
        collectionNames?: string;
        shareUrl?: string;
        year?: string;
        supportEmail?: string;
    } = $props();
</script>

<Html>
    <Head />
    <Body class="bg-gray-50">
        <Preview preview="{curatorName} shared a mod collection with you" />
        <Container class="mx-auto max-w-lg py-8">
            <Section class="rounded-lg bg-white p-8">
                <Heading as="h1" class="text-xl font-bold text-gray-900">
                    {curatorName} shared some mods with you
                </Heading>

                {#if message}
                    <Section class="my-4 rounded bg-gray-50 p-4">
                        <Text class="text-gray-700 italic">"{message}"</Text>
                    </Section>
                {/if}

                <Text class="text-gray-700">Collections: {collectionNames}</Text>

                <Section class="my-6 text-center">
                    <Button
                        href={shareUrl}
                        class="rounded-md bg-green-600 px-6 py-3 font-semibold text-white"
                    >
                        View & Download Mods
                    </Button>
                </Section>

                <Hr class="border-gray-200" />

                <Text class="text-sm text-gray-500">
                    This link will take you to {siteConfig.name}, where you can review and download
                    the shared mod collection as a ready-to-play ZIP file.
                </Text>
            </Section>
            <Footer {supportEmail} {year} />
        </Container>
    </Body>
</Html>
