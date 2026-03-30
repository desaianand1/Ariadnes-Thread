/**
 * Color utilities for mod loaders and Modrinth color values
 */

import type { KnownLoader } from '$lib/config/constants';

/**
 * Tailwind text color classes for mod loaders
 * Dark mode compatible with appropriate contrast
 */
const MOD_LOADER_TEXT_COLORS: Record<KnownLoader, string> = {
    // Popular mod loaders
    fabric: 'text-amber-700 dark:text-amber-400',
    forge: 'text-slate-600 dark:text-slate-300',
    neoforge: 'text-orange-600 dark:text-orange-400',
    quilt: 'text-violet-600 dark:text-violet-400',

    // Plugin platforms
    bukkit: 'text-sky-600 dark:text-sky-400',
    spigot: 'text-amber-600 dark:text-amber-400',
    paper: 'text-pink-600 dark:text-pink-400',
    purpur: 'text-purple-600 dark:text-purple-400',
    folia: 'text-green-600 dark:text-green-400',
    velocity: 'text-indigo-600 dark:text-indigo-400',
    bungeecord: 'text-amber-700 dark:text-amber-500',
    waterfall: 'text-blue-600 dark:text-blue-400',
    sponge: 'text-yellow-600 dark:text-yellow-400',
    geyser: 'text-cyan-600 dark:text-cyan-400',
    'bta-babric': 'text-rose-600 dark:text-rose-400',

    // Other platforms
    liteloader: 'text-cyan-600 dark:text-cyan-400',
    rift: 'text-teal-600 dark:text-teal-400',
    datapack: 'text-emerald-600 dark:text-emerald-400',
    babric: 'text-red-600 dark:text-red-400',
    nilloader: 'text-slate-600 dark:text-slate-400',
    ornithe: 'text-sky-600 dark:text-sky-400'
};

/**
 * Background color classes for mod loaders (for badges, chips)
 */
const MOD_LOADER_BG_COLORS: Record<KnownLoader, string> = {
    // Popular mod loaders
    fabric: 'bg-amber-100 dark:bg-amber-900/30',
    forge: 'bg-slate-100 dark:bg-slate-800/50',
    neoforge: 'bg-orange-100 dark:bg-orange-900/30',
    quilt: 'bg-violet-100 dark:bg-violet-900/30',

    // Plugin platforms
    bukkit: 'bg-sky-100 dark:bg-sky-900/30',
    spigot: 'bg-amber-100 dark:bg-amber-900/30',
    paper: 'bg-pink-100 dark:bg-pink-900/30',
    purpur: 'bg-purple-100 dark:bg-purple-900/30',
    folia: 'bg-green-100 dark:bg-green-900/30',
    velocity: 'bg-indigo-100 dark:bg-indigo-900/30',
    bungeecord: 'bg-amber-100 dark:bg-amber-900/30',
    waterfall: 'bg-blue-100 dark:bg-blue-900/30',
    sponge: 'bg-yellow-100 dark:bg-yellow-900/30',
    geyser: 'bg-cyan-100 dark:bg-cyan-900/30',
    'bta-babric': 'bg-rose-100 dark:bg-rose-900/30',

    // Other platforms
    liteloader: 'bg-cyan-100 dark:bg-cyan-900/30',
    rift: 'bg-teal-100 dark:bg-teal-900/30',
    datapack: 'bg-emerald-100 dark:bg-emerald-900/30',
    babric: 'bg-red-100 dark:bg-red-900/30',
    nilloader: 'bg-slate-100 dark:bg-slate-900/30',
    ornithe: 'bg-sky-100 dark:bg-sky-900/30'
};

/**
 * Get Tailwind text color class for a mod loader
 * @param slug - Mod loader slug (lowercase)
 * @returns Tailwind class string
 */
export function getTextColorByModLoader(slug: string): string {
    const key = slug.toLowerCase() as KnownLoader;
    return MOD_LOADER_TEXT_COLORS[key] ?? 'text-foreground';
}

/**
 * Get Tailwind background color class for a mod loader
 * @param slug - Mod loader slug (lowercase)
 * @returns Tailwind class string
 */
export function getBgColorByModLoader(slug: string): string {
    const key = slug.toLowerCase() as KnownLoader;
    return MOD_LOADER_BG_COLORS[key] ?? 'bg-muted';
}

/**
 * Get combined badge classes for a mod loader (bg + text)
 * @param slug - Mod loader slug (lowercase)
 * @returns Tailwind class string
 */
export function getBadgeClassesByModLoader(slug: string): string {
    const text = getTextColorByModLoader(slug);
    const bg = getBgColorByModLoader(slug);
    return `${bg} ${text}`;
}

/**
 * Tailwind classes for version type badges (snapshot, beta, alpha)
 * Shared across ModCard and SelectMinecraftVersion
 */
export const VERSION_TYPE_BADGE_CLASSES: Record<string, string> = {
    snapshot: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    beta: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    alpha: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
};

/**
 * Convert Modrinth decimal color to hex string
 * Modrinth stores colors as integers (e.g., 16711680 = #FF0000)
 * @param decimal - Decimal color value from Modrinth API
 * @returns Hex color string (e.g., "#FF0000") or undefined if invalid
 */
export function decimalToHex(decimal: number | undefined | null): string | undefined {
    if (decimal === undefined || decimal === null || decimal < 0 || decimal > 16777215) {
        return undefined;
    }
    return `#${decimal.toString(16).padStart(6, '0').toUpperCase()}`;
}

/**
 * Convert hex color string to decimal
 * @param hex - Hex color string (with or without #)
 * @returns Decimal color value or undefined if invalid
 */
export function hexToDecimal(hex: string): number | undefined {
    const cleaned = hex.replace(/^#/, '');
    if (!/^[0-9A-Fa-f]{6}$/.test(cleaned)) {
        return undefined;
    }
    return parseInt(cleaned, 16);
}

/**
 * Get a CSS variable for dynamic coloring based on Modrinth color
 * @param decimal - Decimal color value from Modrinth API
 * @param fallback - Fallback color if decimal is invalid
 * @returns CSS color value
 */
export function getModrinthColor(
    decimal: number | undefined | null,
    fallback: string = 'currentColor'
): string {
    const hex = decimalToHex(decimal);
    return hex || fallback;
}
