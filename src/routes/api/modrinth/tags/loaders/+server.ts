/**
 * GET /api/modrinth/tags/loaders
 * Returns mod loaders filtered and sanitized for safe display
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createClientFromPlatform } from '$lib/api/client.server';
import type { ModrinthLoader } from '$lib/api/types';
import { getErrorMessage, isModrinthAPIError } from '$lib/api/error';
import { EXCLUDED_LOADERS } from '$lib/config/constants';
import { sanitizeSvg } from '$lib/utils/sanitize';

export const GET: RequestHandler = async ({ platform }) => {
    const client = createClientFromPlatform(platform);

    try {
        // Tags are stable in v2 API
        const loaders = await client.request<ModrinthLoader[]>('tag/loader', {
            preferredVersion: 'v2'
        });

        // Filter and sanitize loaders
        const filtered = loaders
            // Exclude loaders that aren't relevant for mod downloads
            .filter(
                (loader) =>
                    !EXCLUDED_LOADERS.includes(
                        loader.name.toLowerCase() as (typeof EXCLUDED_LOADERS)[number]
                    )
            )
            // Include loaders that support any project type found in collections
            .filter((loader) => {
                const types = loader.supported_project_types;
                return (
                    types.includes('mod') ||
                    types.includes('resourcepack') ||
                    types.includes('shader') ||
                    types.includes('datapack') ||
                    types.includes('plugin')
                );
            })
            // Sanitize SVG icons via allowlist-based parser (works in all runtimes)
            .map((loader) => ({
                ...loader,
                icon: sanitizeSvg(loader.icon)
            }));

        return json(
            { loaders: filtered },
            {
                headers: {
                    'Cache-Control':
                        'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400'
                }
            }
        );
    } catch (error) {
        console.error('Failed to fetch loaders:', error);

        const status = isModrinthAPIError(error) ? error.status : 500;
        const message = getErrorMessage(error);

        return json({ error: message }, { status });
    }
};
