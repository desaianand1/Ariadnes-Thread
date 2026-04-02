import { siteConfig } from '$lib/config/site';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => {
    const manifest = {
        name: siteConfig.name,
        short_name: siteConfig.shortName,
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: siteConfig.themeColor.light,
        icons: [
            {
                src: siteConfig.icons.favicon,
                sizes: 'any',
                type: 'image/svg+xml'
            },
            {
                src: '/icon-192.png',
                sizes: '192x192',
                type: 'image/png'
            },
            {
                src: '/icon-512.png',
                sizes: '512x512',
                type: 'image/png'
            },
            {
                src: siteConfig.icons.appleTouchIcon,
                sizes: '180x180',
                type: 'image/png'
            }
        ]
    };

    return new Response(JSON.stringify(manifest), {
        headers: {
            'Content-Type': 'application/manifest+json',
            'Cache-Control': 'public, max-age=86400'
        }
    });
};
