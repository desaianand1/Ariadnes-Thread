import type { Component } from 'svelte';
import ShareCollection from '$lib/emails/ShareCollection.svelte';
import { siteConfig } from '$lib/config/site';

export interface TemplateDefinition {
    alias: string;
    name: string;
    subject: string;
    from: string;
    component: Component<Record<string, unknown>>;
    placeholders: Record<string, string>;
}

export const TEMPLATE_ALIAS = {
    SHARE_COLLECTION: 'share-collection'
} as const;

export type TemplateId = (typeof TEMPLATE_ALIAS)[keyof typeof TEMPLATE_ALIAS];

export const FROM_NOREPLY = `${siteConfig.name} <noreply@${siteConfig.domain}>`;

export const TEMPLATES: TemplateDefinition[] = [
    {
        alias: TEMPLATE_ALIAS.SHARE_COLLECTION,
        name: 'Share Collection',
        subject: "{{{curatorName}}} shared a mod collection — Ariadne's Thread",
        from: FROM_NOREPLY,
        component: ShareCollection as unknown as Component<Record<string, unknown>>,
        placeholders: {
            curatorName: 'A friend',
            message: '',
            collectionNames: 'Essential Mods',
            shareUrl: 'https://modrinth.download/review?c=abc123&v=1.20.1&l=fabric',
            year: new Date().getFullYear().toString(),
            supportEmail: siteConfig.supportEmail
        }
    }
];
