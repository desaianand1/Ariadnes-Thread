/**
 * GET /api/modrinth/collection/[id]
 * Returns collection details with all projects
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createClientFromPlatform } from '$lib/api/client.server';
import type { ModrinthCollection, ModrinthProject } from '$lib/api/types';
import {
	CollectionNotFoundError,
	ClientError,
	getErrorMessage,
	isModrinthAPIError
} from '$lib/api/error';
import { COLLECTION_ID_PATTERN } from '$lib/config/constants';

export const GET: RequestHandler = async ({ params, platform }) => {
	const { id } = params;

	// Validate collection ID format
	if (!COLLECTION_ID_PATTERN.test(id)) {
		throw error(400, 'Invalid collection ID format');
	}

	const client = createClientFromPlatform(platform);

	try {
		// Collections are v3 API only
		const collection = await client.request<ModrinthCollection>('collection', {
			pathParams: [id],
			preferredVersion: 'v3'
		});

		// Fetch basic info for all projects in the collection
		const projectIds = collection.projects;
		const projects: ModrinthProject[] = [];

		if (projectIds.length > 0) {
			// Batch fetch projects (Modrinth supports up to 100 per request)
			// Split into chunks if needed
			const chunks: string[][] = [];
			for (let i = 0; i < projectIds.length; i += 100) {
				chunks.push(projectIds.slice(i, i + 100));
			}

			// Use allSettled to handle partial failures gracefully
			const projectResults = await Promise.allSettled(
				chunks.map((chunk) =>
					client.request<ModrinthProject[]>('projects', {
						queryParams: { ids: JSON.stringify(chunk) },
						preferredVersion: 'v2'
					})
				)
			);

			// Collect successful results and log any failures
			for (const result of projectResults) {
				if (result.status === 'fulfilled') {
					projects.push(...result.value);
				} else {
					console.warn('Failed to fetch project chunk:', result.reason);
				}
			}
		}

		return json(
			{
				collection,
				projects
			},
			{
				headers: {
					// Cache for 30 minutes, allow stale for 1 hour while revalidating
					'Cache-Control': 'public, max-age=1800, s-maxage=1800, stale-while-revalidate=3600'
				}
			}
		);
	} catch (err) {
		// Handle 404 specifically for collection not found
		if (err instanceof ClientError && err.status === 404) {
			throw error(404, `Collection not found: ${id}`);
		}

		if (err instanceof CollectionNotFoundError) {
			throw error(404, err.message);
		}

		console.error('Failed to fetch collection:', err);

		const status = isModrinthAPIError(err) ? err.status : 500;
		const message = getErrorMessage(err);

		return json({ error: message }, { status });
	}
};
