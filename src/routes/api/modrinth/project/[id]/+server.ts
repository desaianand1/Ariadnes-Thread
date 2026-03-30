/**
 * GET /api/modrinth/project/[id]
 * Returns project details with versions, optionally filtered by game version and loader
 *
 * Query parameters:
 * - game_version: Filter versions by Minecraft version (e.g., "1.20.1")
 * - loader: Filter versions by mod loader (e.g., "fabric")
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createClientFromPlatform } from '$lib/api/client.server';
import type { ModrinthProject, ModrinthVersion } from '$lib/api/types';
import {
	ProjectNotFoundError,
	ClientError,
	getErrorMessage,
	isModrinthAPIError
} from '$lib/api/error';

export const GET: RequestHandler = async ({ params, url, platform }) => {
	const { id } = params;
	const gameVersion = url.searchParams.get('game_version');
	const loader = url.searchParams.get('loader');

	// Basic ID validation (alphanumeric or slug)
	if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
		throw error(400, 'Invalid project ID or slug format');
	}

	const client = createClientFromPlatform(platform);

	try {
		// Fetch project details (works with both ID and slug)
		const project = await client.request<ModrinthProject>('project', {
			pathParams: [id],
			preferredVersion: 'v2'
		});

		// Build query params for version filtering
		const queryParams: Record<string, string> = {};

		if (gameVersion) {
			queryParams.game_versions = JSON.stringify([gameVersion]);
		}
		if (loader) {
			queryParams.loaders = JSON.stringify([loader]);
		}

		// Fetch versions with optional filters
		const versions = await client.request<ModrinthVersion[]>('project', {
			pathParams: [id, 'version'],
			queryParams,
			preferredVersion: 'v2'
		});

		// Find the most recent compatible version (first in array since API returns sorted)
		const compatibleVersion = versions.length > 0 ? versions[0] : null;

		return json(
			{
				project,
				versions,
				compatibleVersion,
				isCompatible: compatibleVersion !== null
			},
			{
				headers: {
					// Cache for 15 minutes if filtered, 30 minutes if unfiltered
					'Cache-Control':
						gameVersion || loader
							? 'public, max-age=900, s-maxage=900, stale-while-revalidate=1800'
							: 'public, max-age=1800, s-maxage=1800, stale-while-revalidate=3600'
				}
			}
		);
	} catch (err) {
		// Handle 404 specifically for project not found
		if (err instanceof ClientError && err.status === 404) {
			throw error(404, `Project not found: ${id}`);
		}

		if (err instanceof ProjectNotFoundError) {
			throw error(404, err.message);
		}

		console.error('Failed to fetch project:', err);

		const status = isModrinthAPIError(err) ? err.status : 500;
		const message = getErrorMessage(err);

		return json({ error: message }, { status });
	}
};
