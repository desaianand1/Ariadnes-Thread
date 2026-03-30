import { getCanonicalUrl } from '$lib/config/site';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => {
	const baseUrl = getCanonicalUrl();

	const body = `User-agent: *
Allow: /
Disallow: /api/

Sitemap: ${baseUrl}/sitemap.xml`;

	return new Response(body, {
		headers: {
			'Content-Type': 'text/plain',
			'Cache-Control': 'max-age=3600'
		}
	});
};
