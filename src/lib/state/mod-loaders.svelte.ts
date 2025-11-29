/**
 * Mod loader state management using Svelte 5 runes
 * Fetches from /api/modrinth/tags/loaders with localStorage caching
 */

import { getCachedData, setCachedData } from '$lib/utils/cache';
import { getTextColorByModLoader } from '$lib/utils/colors';
import { STORAGE_KEYS, CACHE_TTL, getLoaderCategory } from '$lib/config/constants';
import type { LoaderCategory } from '$lib/config/constants';
import type { ModrinthLoader } from '$lib/api/types';

export interface ModLoaderItem {
	name: string;
	slug: string;
	icon: string;
	colorClass: string;
	category: LoaderCategory;
}

export interface ModLoaderState {
	loaders: ModLoaderItem[];
	isLoading: boolean;
	error: string | null;
}

/**
 * State using Svelte 5 runes
 */
const state = $state<ModLoaderState>({
	loaders: [],
	isLoading: false,
	error: null
});

/**
 * Loads mod loaders from API or cache
 */
export async function loadModLoaders(): Promise<void> {
	const isBrowser = typeof window !== 'undefined';

	// Already loading or already have data
	if (state.isLoading || state.loaders.length > 0) {
		return;
	}

	state.isLoading = true;
	state.error = null;

	try {
		// Check cache first (browser only)
		if (isBrowser) {
			const cached = getCachedData<ModLoaderItem[]>(STORAGE_KEYS.MOD_LOADERS, CACHE_TTL.LOADERS);
			if (cached) {
				state.loaders = cached;
				state.isLoading = false;
				return;
			}
		}

		// Fetch from API
		const response = await fetch('/api/modrinth/tags/loaders');

		if (!response.ok) {
			throw new Error(`Failed to fetch loaders: ${response.status}`);
		}

		const { loaders } = (await response.json()) as { loaders: ModrinthLoader[] };

		// Transform to our format with categories
		state.loaders = loaders.map((loader) => {
			const slug = loader.name.toLowerCase();

			return {
				name: loader.name,
				slug,
				icon: loader.icon,
				colorClass: getTextColorByModLoader(slug),
				category: getLoaderCategory(slug)
			};
		});

		// Cache in localStorage
		if (isBrowser) {
			setCachedData(STORAGE_KEYS.MOD_LOADERS, state.loaders);
		}
	} catch (err) {
		state.error = err instanceof Error ? err.message : 'Unknown error';
		console.error('Error loading mod loaders:', err);
	} finally {
		state.isLoading = false;
	}
}

/**
 * Returns grouped loaders (popular, other, plugins)
 */
export function getGroupedLoaders(): {
	popular: ModLoaderItem[];
	other: ModLoaderItem[];
	plugins: ModLoaderItem[];
} {
	const popular = state.loaders.filter((l) => l.category === 'popular');
	const other = state.loaders.filter((l) => l.category === 'other');
	const plugins = state.loaders.filter((l) => l.category === 'plugin');

	return { popular, other, plugins };
}

/**
 * Finds a loader by slug
 */
export function findLoaderBySlug(slug: string): ModLoaderItem | undefined {
	return state.loaders.find((l) => l.slug === slug.toLowerCase());
}

/**
 * Clears the cached loaders data
 */
export function clearLoadersCache(): void {
	if (typeof window !== 'undefined') {
		localStorage.removeItem(STORAGE_KEYS.MOD_LOADERS);
	}
	state.loaders = [];
	state.error = null;
}

/**
 * Exported state getter for reactive access
 */
export function getLoaderState(): ModLoaderState {
	return state;
}

export { state as loaderState };
