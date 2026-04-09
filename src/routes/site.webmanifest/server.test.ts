import { describe, it, expect } from 'vitest';
import { GET } from './+server';
import { siteConfig } from '$lib/config/site';

interface WebManifest {
    name: string;
    short_name: string;
    theme_color: string;
    display: string;
    icons: Array<{ src: string; sizes: string; type: string }>;
}

function makeEvent() {
    return {} as Parameters<typeof GET>[0];
}

async function getResponse() {
    return await GET(makeEvent());
}

async function getManifest(): Promise<WebManifest> {
    const response = await getResponse();
    return (await response.json()) as WebManifest;
}

describe('GET /site.webmanifest', () => {
    it('returns valid JSON with correct content-type', async () => {
        const response = await getResponse();
        expect(response.headers.get('Content-Type')).toBe('application/manifest+json');
    });

    it('sets cache-control to one day', async () => {
        const response = await getResponse();
        expect(response.headers.get('Cache-Control')).toBe('public, max-age=86400');
    });

    it('includes siteConfig name and shortName', async () => {
        const body = await getManifest();
        expect(body.name).toBe(siteConfig.name);
        expect(body.short_name).toBe(siteConfig.shortName);
    });

    it('includes theme color from siteConfig', async () => {
        const body = await getManifest();
        expect(body.theme_color).toBe(siteConfig.themeColor.light);
    });

    it('includes favicon and PNG icon entries', async () => {
        const body = await getManifest();
        expect(body.icons).toEqual([
            { src: siteConfig.icons.favicon, sizes: 'any', type: 'image/svg+xml' },
            { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: siteConfig.icons.appleTouchIcon, sizes: '180x180', type: 'image/png' }
        ]);
    });

    it('sets display to standalone', async () => {
        const body = await getManifest();
        expect(body.display).toBe('standalone');
    });
});
