import { getCanonicalUrl } from '$lib/config/site';
import type { RequestHandler } from './$types';

const routes = ['/', '/review'];

export const GET: RequestHandler = () => {
    const baseUrl = getCanonicalUrl();
    const today = new Date().toISOString().split('T')[0];

    const urls = routes
        .map(
            (route) => `
  <url>
    <loc>${baseUrl}${route}</loc>
    <lastmod>${today}</lastmod>
  </url>`
        )
        .join('');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}
</urlset>`;

    return new Response(xml.trim(), {
        headers: {
            'Content-Type': 'application/xml',
            'Cache-Control': 'max-age=3600'
        }
    });
};
