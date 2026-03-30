/**
 * Minecraft version state management using Svelte 5 runes
 * Fetches from /api/modrinth/tags/game-versions with localStorage caching
 */

import { getCachedData, setCachedData } from '$lib/utils/cache';
import { STORAGE_KEYS, CACHE_TTL } from '$lib/config/constants';
import type { ModrinthGameVersion } from '$lib/api/types';
import { SvelteDate, SvelteMap, SvelteSet } from 'svelte/reactivity';

export interface MinecraftVersionItem {
    label: string;
    value: string;
    versionType: 'release' | 'snapshot' | 'alpha' | 'beta';
    isMajorVersion: boolean;
    date: Date;
}

export interface MinecraftVersionState {
    versions: MinecraftVersionItem[];
    isLoading: boolean;
    error: string | null;
}

/**
 * State using Svelte 5 runes
 */
const state = $state<MinecraftVersionState>({
    versions: [],
    isLoading: false,
    error: null
});

/**
 * Loads Minecraft versions from API or cache
 */
export async function loadMinecraftVersions(): Promise<void> {
    const isBrowser = typeof window !== 'undefined';

    // Already loading or already have data
    if (state.isLoading || state.versions.length > 0) {
        return;
    }

    state.isLoading = true;
    state.error = null;

    try {
        // Check cache first (browser only)
        if (isBrowser) {
            const cached = getCachedData<MinecraftVersionItem[]>(
                STORAGE_KEYS.MINECRAFT_VERSIONS,
                CACHE_TTL.VERSIONS
            );
            if (cached) {
                state.versions = cached.map((v) => ({
                    ...v,
                    date: new SvelteDate(v.date)
                }));
                state.isLoading = false;
                return;
            }
        }

        // Fetch from API
        const response = await fetch('/api/modrinth/tags/game-versions');

        if (!response.ok) {
            throw new Error(`Failed to fetch versions: ${response.status}`);
        }

        const { versions } = (await response.json()) as { versions: ModrinthGameVersion[] };

        // Transform to our format
        state.versions = versions.map((v) => ({
            label: v.version,
            value: v.version,
            versionType: v.version_type,
            isMajorVersion: v.major,
            date: new SvelteDate(v.date)
        }));

        // Cache in localStorage
        if (isBrowser) {
            setCachedData(STORAGE_KEYS.MINECRAFT_VERSIONS, state.versions);
        }
    } catch (err) {
        state.error = err instanceof Error ? err.message : 'Unknown error';
        console.error('Error loading Minecraft versions:', err);
    } finally {
        state.isLoading = false;
    }
}

/** Hand-picked versions that represent major community milestones */
const CURATED_POPULAR_VERSIONS = new Set([
    '1.20.1',
    '1.19.2',
    '1.18.2',
    '1.16.5',
    '1.12.2',
    '1.10.2',
    '1.8.9',
    '1.7.10',
    '1.6.4'
]);

/**
 * Returns grouped versions: curated popular list (latest release + community favorites) + everything else
 */
export function getGroupedVersions(): {
    popular: MinecraftVersionItem[];
    other: MinecraftVersionItem[];
} {
    const latestRelease = state.versions.find((v) => v.versionType === 'release');
    const versionsByValue = new SvelteMap(state.versions.map((v) => [v.value, v]));

    const popularSet = new SvelteSet<string>();
    const popular: MinecraftVersionItem[] = [];

    if (latestRelease) {
        popular.push(latestRelease);
        popularSet.add(latestRelease.value);
    }

    for (const version of CURATED_POPULAR_VERSIONS) {
        const item = versionsByValue.get(version);
        if (item && !popularSet.has(version)) {
            popular.push(item);
            popularSet.add(version);
        }
    }

    const other = state.versions.filter((v) => !popularSet.has(v.value));

    return { popular, other };
}

/**
 * Clears the cached versions data
 */
export function clearVersionsCache(): void {
    if (typeof window !== 'undefined') {
        localStorage.removeItem(STORAGE_KEYS.MINECRAFT_VERSIONS);
    }
    state.versions = [];
    state.error = null;
}

/**
 * Exported state getter for reactive access
 */
export function getVersionState(): MinecraftVersionState {
    return state;
}

export { state as versionState };
