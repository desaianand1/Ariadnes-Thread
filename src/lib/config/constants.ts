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
    VERSIONS: 7 * 24 * 60 * 60 * 1000,
    LOADERS: 7 * 24 * 60 * 60 * 1000,
    COLLECTIONS: 30 * 60 * 1000,
    REVIEW_RESULTS: 5 * 60 * 1000
} as const;

/**
 * Bump when the cached data shape changes to auto-invalidate stale entries.
 */
export const CACHE_VERSION = 1;

/**
 * LocalStorage keys for caching
 */
export const STORAGE_KEYS = {
    MINECRAFT_VERSIONS: 'ariadnes-thread-mc-versions',
    MOD_LOADERS: 'ariadnes-thread-loaders',
    THEME: 'ariadnes-thread-theme',
    REVIEW_PREFIX: 'ariadnes-thread-review:'
} as const;

// =============================================================================
// Download Limits
// =============================================================================

/**
 * Maximum number of collections that can be downloaded at once
 */
export const MAX_COLLECTIONS = 7;

/**
 * Default maximum concurrent downloads (PRD spec: default 6, max 8)
 */
export const MAX_CONCURRENT_DOWNLOADS = 6;

/** Bounds for the concurrent downloads stepper */
export const MIN_CONCURRENT_DOWNLOADS = 1;
export const MAX_CONCURRENT_DOWNLOADS_LIMIT = 8;

/**
 * Maximum retries per download
 */
export const MAX_RETRIES = 3;

/** Bounds for the retry count stepper */
export const MIN_RETRY_COUNT = 0;
export const MAX_RETRY_COUNT_LIMIT = 10;

/**
 * Base delay for retry logic in milliseconds
 */
export const RETRY_DELAY_MS = 1000;

/**
 * Per-file fetch timeout in milliseconds
 */
export const DOWNLOAD_TIMEOUT_MS = 60_000;

// =============================================================================
// API Configuration
// =============================================================================

/**
 * Regex pattern to extract collection ID from Modrinth URL
 * Matches: https://modrinth.com/collection/{id} or modrinth.com/collection/{id}
 */
export const COLLECTION_URL_PATTERN =
    /(?:https?:\/\/)?(?:www\.)?modrinth\.com\/collection\/([a-zA-Z0-9]{8})/;

/**
 * Regex pattern to validate a collection ID (Modrinth base62, 8 characters)
 */
export const COLLECTION_ID_PATTERN = /^[a-zA-Z0-9]{8}$/;

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

declare const __APP_VERSION__: string;

/**
 * Application version — injected from package.json at build time via Vite's `define`
 */
export const APP_VERSION = __APP_VERSION__;

/**
 * GitHub repository URL
 */
export const GITHUB_URL = 'https://github.com/desaianand1/Ariadnes-Thread';

// =============================================================================
// Security & Rate Limiting
// =============================================================================

/** Per-IP rate limit configurations */
export const RATE_LIMITS = {
    /** Modrinth API proxy routes */
    API: { maxRequests: 60, windowMs: 60_000 },
    /** Review page loads (each triggers many server-side API calls) */
    REVIEW: { maxRequests: 20, windowMs: 60_000 },
    /** Email sending (future Phase 5 endpoint) */
    EMAIL: { maxRequests: 5, windowMs: 3_600_000 }
} as const;

/** Per-recipient email limits */
export const EMAIL_RECIPIENT_LIMITS = {
    MAX_PER_RECIPIENT: 3,
    WINDOW_MS: 86_400_000 // 24 hours
} as const;

/** Rate limiter internal housekeeping */
export const RATE_LIMIT_CLEANUP_INTERVAL_MS = 60_000;

/** Maximum total projects across all collections on /review (prevents collection-bombing) */
export const MAX_TOTAL_PROJECTS = 300;

/** Minimum form submission time in ms (anti-bot timing check) */
export const MIN_FORM_SUBMIT_TIME_MS = 3_000;

/** Cloudflare Turnstile server-side verification endpoint */
export const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/** Known bot User-Agent patterns (case-insensitive match) */
export const BOT_UA_PATTERNS = [
    'curl',
    'wget',
    'httpie',
    'python-requests',
    'python-urllib',
    'aiohttp',
    'go-http-client',
    'node-fetch',
    'axios',
    'undici',
    'scrapy',
    'crawler',
    'spider'
] as const;

/** Search engine crawlers to allow through bot detection */
export const CRAWLER_ALLOWLIST = [
    'googlebot',
    'bingbot',
    'yandexbot',
    'duckduckbot',
    'slurp',
    'facebookexternalhit',
    'twitterbot',
    'linkedinbot'
] as const;

/**
 * Bot detection scoring weights.
 * Multiple signals are combined — a single weak signal (like missing Sec-Fetch-Site
 * in Safari < 16.4) won't block real users, but multiple missing signals indicate a bot.
 */
export const BOT_SCORE_WEIGHTS = {
    MISSING_ACCEPT: 3,
    MISSING_ACCEPT_LANGUAGE: 2,
    MISSING_SEC_FETCH: 1,
    EMPTY_USER_AGENT: 3,
    KNOWN_BOT_UA: 3
} as const;

/** Score threshold at which a request is classified as bot. Must be >= 3. */
export const BOT_SCORE_THRESHOLD = 3;

/**
 * Modrinth attribution URL
 */
export const MODRINTH_ATTRIBUTION_URL = 'https://modrinth.com';
