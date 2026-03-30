/**
 * GET /api/modrinth/tags/game-versions
 * Returns all Minecraft game versions sorted by date (newest first)
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createClientFromPlatform } from '$lib/api/client.server';
import type { ModrinthGameVersion } from '$lib/api/types';
import { getErrorMessage, isModrinthAPIError } from '$lib/api/error';

export const GET: RequestHandler = async ({ platform }) => {
    const client = createClientFromPlatform(platform);

    try {
        // Tags are stable in v2 API
        const versions = await client.request<ModrinthGameVersion[]>('tag/game_version', {
            preferredVersion: 'v2'
        });

        // Sort by date descending (newest first)
        const sorted = versions.sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );

        return json(
            { versions: sorted },
            {
                headers: {
                    'Cache-Control':
                        'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400'
                }
            }
        );
    } catch (error) {
        console.error('Failed to fetch game versions:', error);

        const status = isModrinthAPIError(error) ? error.status : 500;
        const message = getErrorMessage(error);

        return json({ error: message }, { status });
    }
};
