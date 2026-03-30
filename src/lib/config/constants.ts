/**
 * Application-wide constants
 */

// =============================================================================
// Mod Loaders Configuration
// =============================================================================

/**
 * Loaders to exclude from the selection (not relevant for mod downloads)
 */
export const EXCLUDED_LOADERS = [
	'minecraft',
	'vanilla',
	'optifine',
	'canvas',
	'iris',
	'modloader',
	'java-agent',
	'legacy-fabric'
] as const;
export type ExcludedLoader = (typeof EXCLUDED_LOADERS)[number];

/**
 * Popular loaders to pin at top of selection
 */
export const POPULAR_LOADERS = ['fabric', 'forge', 'neoforge', 'quilt'] as const;
export type PopularLoader = (typeof POPULAR_LOADERS)[number];

/**
 * Plugin loaders (server-side only platforms)
 */
export const PLUGIN_LOADERS = [
	'bukkit',
	'spigot',
	'paper',
	'purpur',
	'folia',
	'velocity',
	'bungeecord',
	'waterfall',
	'sponge',
	'geyser',
	'bta-babric'
] as const;
export type PluginLoader = (typeof PLUGIN_LOADERS)[number];

/**
 * Other known loaders (not popular or plugin)
 */
export const OTHER_LOADERS = [
	'liteloader',
	'rift',
	'datapack',
	'babric',
	'nilloader',
	'ornithe'
] as const;
export type OtherLoader = (typeof OTHER_LOADERS)[number];

/**
 * All known loaders with defined colors/behavior
 */
export type KnownLoader = PopularLoader | PluginLoader | OtherLoader;

/**
 * Loader category for UI grouping
 */
export type LoaderCategory = 'popular' | 'plugin' | 'other';

/**
 * Type guard to check if a loader is a popular loader
 */
export function isPopularLoader(slug: string): slug is PopularLoader {
	return (POPULAR_LOADERS as readonly string[]).includes(slug);
}

/**
 * Type guard to check if a loader is a plugin loader
 */
export function isPluginLoader(slug: string): slug is PluginLoader {
	return (PLUGIN_LOADERS as readonly string[]).includes(slug);
}

/**
 * Type guard to check if a loader is excluded
 */
export function isExcludedLoader(slug: string): slug is ExcludedLoader {
	return (EXCLUDED_LOADERS as readonly string[]).includes(slug);
}

/**
 * Get the category for a loader
 */
export function getLoaderCategory(slug: string): LoaderCategory {
	if (isPopularLoader(slug)) return 'popular';
	if (isPluginLoader(slug)) return 'plugin';
	return 'other';
}

// =============================================================================
// Cross-Loader Fallbacks & Dependency Resolution
// =============================================================================

/**
 * When a project has no version for the selected loader, try these fallbacks
 * in order. Quilt can load Fabric mods; NeoForge can sometimes load Forge mods.
 */
export const CROSS_LOADER_FALLBACKS: Record<string, string[]> = {
	quilt: ['fabric'],
	neoforge: ['forge']
};

/**
 * BFS traversal stops after this many levels to prevent runaway resolution
 */
export const MAX_DEPENDENCY_DEPTH = 10;

// =============================================================================
// Cache Configuration
// =============================================================================

/**
 * Cache TTL values in milliseconds
 */
export const CACHE_TTL = {
	/** Cache versions for 2 hours */
	VERSIONS: 2 * 60 * 60 * 1000,
	/** Cache loaders for 2 hours */
	LOADERS: 2 * 60 * 60 * 1000,
	/** Cache collections for 30 minutes */
	COLLECTIONS: 30 * 60 * 1000
} as const;

/**
 * LocalStorage keys for caching
 */
export const STORAGE_KEYS = {
	MINECRAFT_VERSIONS: 'ariadnes-thread-mc-versions',
	MOD_LOADERS: 'ariadnes-thread-loaders',
	THEME: 'ariadnes-thread-theme'
} as const;

// =============================================================================
// Download Limits
// =============================================================================

/**
 * Maximum number of collections that can be downloaded at once
 */
export const MAX_COLLECTIONS = 7;

/**
 * Default maximum concurrent downloads
 */
export const MAX_CONCURRENT_DOWNLOADS = 5;

/**
 * Maximum retries per download
 */
export const MAX_RETRIES = 3;

/**
 * Base delay for retry logic in milliseconds
 */
export const RETRY_DELAY_MS = 1000;

// =============================================================================
// API Configuration
// =============================================================================

/**
 * Modrinth API base URL
 */
export const MODRINTH_API_URL = 'https://api.modrinth.com';

/**
 * Modrinth website base URL (for collection URLs)
 */
export const MODRINTH_WEB_URL = 'https://modrinth.com';

/**
 * Regex pattern to extract collection ID from Modrinth URL
 * Matches: https://modrinth.com/collection/{id} or modrinth.com/collection/{id}
 */
export const COLLECTION_URL_PATTERN =
	/(?:https?:\/\/)?(?:www\.)?modrinth\.com\/collection\/([a-zA-Z0-9]+)/;

/**
 * Regex pattern to validate a collection ID (alphanumeric)
 */
export const COLLECTION_ID_PATTERN = /^[a-zA-Z0-9]+$/;

// =============================================================================
// UI Configuration
// =============================================================================

/**
 * Toast notification durations in milliseconds
 */
export const TOAST_DURATION = {
	SUCCESS: 3000,
	ERROR: 5000,
	INFO: 4000,
	WARNING: 4000
} as const;

/**
 * Animation durations in milliseconds
 */
export const ANIMATION_DURATION = {
	FAST: 150,
	NORMAL: 200,
	SLOW: 300
} as const;

// =============================================================================
// App Metadata
// =============================================================================

/**
 * Application name
 */
export const APP_NAME = "Ariadne's Thread";

/**
 * Application description
 */
export const APP_DESCRIPTION =
	'Download multiple Modrinth mod collections as organized ZIP bundles';

/**
 * Application version (synced with package.json)
 */
export const APP_VERSION = '1.0.0';

/**
 * GitHub repository URL
 */
export const GITHUB_URL = 'https://github.com/your-username/ariadnes-thread';

/**
 * Modrinth attribution URL
 */
export const MODRINTH_ATTRIBUTION_URL = 'https://modrinth.com';
