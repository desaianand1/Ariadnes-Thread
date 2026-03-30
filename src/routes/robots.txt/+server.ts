import { getCanonicalUrl } from '$lib/config/site';
import { env } from '$env/dynamic/public';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => {
	const baseUrl = getCanonicalUrl(env);

	const body = `User-agent: *
Allow: /

Sitemap: ${baseUrl}/sitemap.xml`;

	return new Response(body, {
		headers: {
			'Content-Type': 'text/plain',
			'Cache-Control': 'max-age=3600'
		}
	});
};
