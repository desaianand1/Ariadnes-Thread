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
    .refine((val) => parseCollectionId(val) !== null, {
        message: 'Must be a valid Modrinth collection URL or ID'
    });

/**
 * Extracts collection ID from URL or validates raw ID
 */
export function parseCollectionId(input: string): string | null {
    const trimmed = input.trim();
    if (!trimmed) return null;

    // Try URL extraction first — only for modrinth.com domains
    try {
        const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
        if (/(?:www\.)?modrinth\.com$/i.test(url.hostname)) {
            const match = url.pathname.match(/^\/collection\/([a-zA-Z0-9]{8})$/);
            if (match) return match[1];
        }
    } catch {
        // Not a parseable URL — fall through to raw ID check
    }

    // Check if it's a valid raw ID
    if (COLLECTION_ID_PATTERN.test(trimmed)) {
        return trimmed;
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

// =============================================================================
// Review Page Query Parameters
// =============================================================================

/**
 * Schema for /review query params that encode the full resolution context.
 *
 * - c: comma-separated collection IDs
 * - v: Minecraft version string
 * - l: loader slug
 * - opts: compact flags string — d=include deps, f=cross-loader fallback, a=allow alpha/beta
 * - x: comma-separated excluded project IDs (optional)
 * - add: comma-separated manually-added project IDs (optional)
 */
export const reviewParamsSchema = z.object({
    c: z.string().min(1, 'At least one collection ID is required'),
    v: z.string().min(1, 'Minecraft version is required (e.g., 1.20.1)'),
    l: z.string().min(1, 'Loader is required (e.g., fabric, forge, quilt)'),
    opts: z
        .string()
        .default('')
        .transform((val) => val.toLowerCase()),
    x: z.string().optional().default(''),
    add: z.string().optional().default('')
});

export type ReviewParams = z.infer<typeof reviewParamsSchema>;

/**
 * Parses validated review params into a ResolutionOptions object.
 */
export function parseReviewOptions(params: ReviewParams): {
    collectionIds: string[];
    gameVersion: string;
    loader: string;
    includeDependencies: boolean;
    includeOptionalDeps: boolean;
    enableCrossLoaderFallback: boolean;
    allowAlphaBeta: boolean;
    excludedProjectIds: Set<string>;
    addedProjectIds: string[];
} {
    const flags = params.opts;

    return {
        collectionIds: params.c.split(',').filter(Boolean),
        gameVersion: params.v,
        loader: params.l,
        includeDependencies: flags.includes('d'),
        includeOptionalDeps: flags.includes('o'),
        enableCrossLoaderFallback: flags.includes('f'),
        allowAlphaBeta: flags.includes('a'),
        excludedProjectIds: new Set(params.x.split(',').filter(Boolean)),
        addedProjectIds: params.add.split(',').filter(Boolean)
    };
}
