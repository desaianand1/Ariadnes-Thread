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
// Loader-Agnostic Project Types
// =============================================================================

/**
 * Project types that don't require a mod loader — the API should be queried
 * without a `loaders` filter for these.
 */
export const LOADER_AGNOSTIC_PROJECT_TYPES = new Set([
    'resourcepack',
    'shader',
    'datapack',
    'plugin'
]);

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
 * Bidirectional loader alternatives for the Best Configuration Advisor.
 * Unlike CROSS_LOADER_FALLBACKS (which is one-directional for resolution),
 * these map both directions for probing alternative configurations.
 */
export const CROSS_LOADER_ALTERNATIVES: Record<string, string[]> = {
    fabric: ['quilt'],
    forge: ['neoforge'],
    quilt: ['fabric'],
    neoforge: ['forge']
};

/**
 * BFS traversal stops after this many levels to prevent runaway resolution
 */
export const MAX_DEPENDENCY_DEPTH = 10;

// =============================================================================
// Best Configuration Advisor
// =============================================================================

/** Minimum net improvement (% of total mods) before showing the advisor callout */
export const ADVISOR_MIN_IMPROVEMENT_PERCENT = 5;

/** Absolute net gain that always passes the advisor threshold regardless of percentage */
export const ADVISOR_MIN_ABSOLUTE_GAIN = 3;

/** Timeout for all alternative probes in milliseconds */
export const ADVISOR_PROBE_TIMEOUT_MS = 120_000;

/** Maximum number of adjacent MC versions to probe */
export const MAX_ALTERNATIVE_VERSIONS = 3;

/** Batch size for individual project version checks in checkGains() */
export const GAIN_CHECK_BATCH_SIZE = 20;

/** Stop probing once the best alternative resolves this % of total mods */
export const ADVISOR_EARLY_STOP_PERCENT = 95;

/** Skip probing versions where fewer than this many unresolved mods have support */
export const HISTOGRAM_MIN_COVERAGE = 2;

/** Maximum versions to select from histogram for full probing */
export const HISTOGRAM_TOP_CANDIDATES = 5;

/** Sub-timeout for the histogram pre-scan phase (ms) */
export const HISTOGRAM_SCAN_TIMEOUT_MS = 10_000;

/** Max configs remembered in the advisor switch chain to prevent oscillation */
export const MAX_ADVISOR_HISTORY_LENGTH = 5;

/** Versions older than this are considered "old" — only probe backward, not forward */
export const VERSION_AGE_CUTOFF_DAYS = 730;

/** Hand-picked MC versions that represent major community milestones */
export const CURATED_POPULAR_VERSIONS = [
    '1.21.1',
    '1.20.1',
    '1.19.2',
    '1.18.2',
    '1.16.5',
    '1.12.2',
    '1.10.2',
    '1.8.9',
    '1.7.10',
    '1.6.4'
] as const;

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
    REVIEW_PREFIX: 'ariadnes-thread-review:',
    VIEW_MODE_PREFERENCE: 'ariadnes-thread-view-mode'
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

/**
 * When the other-side download has at most this many files to fetch (after
 * cache filtering), use inline mini-progress instead of the full download view.
 */
export const INLINE_DOWNLOAD_FILE_THRESHOLD = 20;

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

/** Cookie name for persisting view mode preference (avoids SSR flash) */
export const VIEW_MODE_COOKIE = 'at-view-mode';

/** Resolution percentage thresholds for semantic coloring */
export const RESOLUTION_PERCENTAGE_THRESHOLDS = { HIGH: 80, MEDIUM: 50 } as const;

/** Mods not updated within this many days get amber "stale" styling */
export const STALE_MOD_THRESHOLD_DAYS = 180;

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

/** Fallback retry delay when a 429 response lacks a Retry-After header */
export const RATE_LIMIT_DEFAULT_RETRY_SECONDS = 5;

/** Centralized error messages for the /review resolution page */
export const RESOLUTION_MESSAGES = {
    TIMEOUT: 'The request took too long. Try with fewer collections or try again later.',
    ALL_FAILED: 'Could not reach Modrinth. The API may be temporarily unavailable.',
    GENERIC: 'Something went wrong while processing results. Please try again.'
} as const;

/** Projects per version-resolution batch */
export const RESOLUTION_BATCH_SIZE = 50;

/** Modrinth API rate limit (requests per minute per IP) */
export const MODRINTH_RATE_LIMIT = 300;

/**
 * Show MultiStepLoader when total projects exceed 50% of Modrinth's rate limit.
 * Each mod costs ~1.5-2x requests (version lookup + deps), so 150 mods ≈ 225-300
 * total API requests — right at the rate limit. Lower factor gives headroom.
 */
export const LARGE_LOAD_THRESHOLD = Math.floor(MODRINTH_RATE_LIMIT * 0.5);

/** Raised from 300 — batching handles pacing, this is just abuse prevention */
export const MAX_TOTAL_PROJECTS = 1000;

/** Breathing room between resolution batches (ms) */
export const INTER_BATCH_DELAY_MS = 500;

/** Upper bound on how long to wait for a rate-limit window reset between batches (ms) */
export const MAX_RATE_LIMIT_WAIT_MS = 5_000;

/** Reserve this many requests before pausing for rate limit */
export const RATE_LIMIT_SAFETY_MARGIN = 50;

/** Page-level load timeout for /review (covers all resolution + fetching) */
export const PAGE_LOAD_TIMEOUT_MS = 25_000;

/** Overall timeout for the large-load streaming path (2 minutes) */
export const LARGE_LOAD_TIMEOUT_MS = 120_000;

/** Max project IDs per batch when calling Modrinth bulk endpoints (GET /v2/projects, etc.) */
export const MODRINTH_BATCH_SIZE = 100;

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
