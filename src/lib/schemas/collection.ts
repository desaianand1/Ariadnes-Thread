/**
 * Zod schemas for collection form validation
 */

import { z } from 'zod';
import { COLLECTION_ID_PATTERN, MAX_COLLECTIONS } from '$lib/config/constants';

/**
 * Validates a Modrinth collection URL or ID
 * Accepts:
 * - Full URL: https://modrinth.com/collection/XXXXXXXX
 * - Short URL: modrinth.com/collection/XXXXXXXX
 * - Raw ID: XXXXXXXX (alphanumeric, 8 characters)
 */
export const collectionUrlOrIdSchema = z
	.string()
	.min(1, 'Collection URL or ID is required')
	.transform((val) => val.trim())
	.refine(
		(val) => {
			// Check if it's a URL
			try {
				const url = new URL(val.startsWith('http') ? val : `https://${val}`);
				const match = url.pathname.match(/^\/collection\/([a-zA-Z0-9]+)$/);
				return match !== null;
			} catch {
				// Check if it's a valid raw ID
				return COLLECTION_ID_PATTERN.test(val);
			}
		},
		{ message: 'Must be a valid Modrinth collection URL or ID' }
	);

/**
 * Extracts collection ID from URL or validates raw ID
 */
export function parseCollectionId(input: string): string | null {
	const trimmed = input.trim();

	// Check if it's a URL
	try {
		const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
		const match = url.pathname.match(/^\/collection\/([a-zA-Z0-9]+)$/);
		if (match) return match[1];
	} catch {
		// Not a URL, check if it's a valid ID
		if (COLLECTION_ID_PATTERN.test(trimmed)) {
			return trimmed;
		}
	}

	return null;
}

/**
 * Main download form schema
 */
export const downloadFormSchema = z.object({
	collections: z
		.array(z.string().min(1))
		.min(1, 'At least one collection is required')
		.max(MAX_COLLECTIONS, `Maximum ${MAX_COLLECTIONS} collections allowed`),

	modLoader: z.string().min(1, 'Mod loader is required'),

	minecraftVersion: z.string().min(1, 'Minecraft version is required'),

	includeDependencies: z.boolean().default(true)
});

export type DownloadFormSchema = typeof downloadFormSchema;
export type DownloadFormData = z.infer<typeof downloadFormSchema>;
