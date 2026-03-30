/**
 * Human-readable formatting utilities for file sizes and large numbers
 */

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB'] as const;

export function formatBytes(bytes: number): string {
    if (bytes < 0) return '0 B';
    let unitIndex = 0;
    let size = bytes;
    while (size >= 1024 && unitIndex < BYTE_UNITS.length - 1) {
        size /= 1024;
        unitIndex++;
    }
    const formatted = unitIndex === 0 ? size.toString() : size.toFixed(1).replace(/\.0$/, '');
    return `${formatted} ${BYTE_UNITS[unitIndex]}`;
}

const NUMBER_SUFFIXES = [
    { threshold: 1_000_000_000, suffix: 'B' },
    { threshold: 1_000_000, suffix: 'M' },
    { threshold: 1_000, suffix: 'K' }
] as const;

const LOADER_DISPLAY_NAMES: Record<string, string> = {
    neoforge: 'NeoForge',
    bungeecord: 'BungeeCord',
    liteloader: 'LiteLoader',
    'bta-babric': 'BTA Babric',
    nilloader: 'NilLoader',
    waterfall: 'Waterfall',
    velocity: 'Velocity',
    purpur: 'Purpur',
    folia: 'Folia',
    sponge: 'Sponge'
};

export function getLoaderDisplayName(slug: string): string {
    return LOADER_DISPLAY_NAMES[slug] ?? slug.charAt(0).toUpperCase() + slug.slice(1);
}

export function formatNumber(n: number): string {
    for (const { threshold, suffix } of NUMBER_SUFFIXES) {
        if (n >= threshold) {
            const value = n / threshold;
            return `${value.toFixed(1).replace(/\.0$/, '')}${suffix}`;
        }
    }
    return n.toString();
}
