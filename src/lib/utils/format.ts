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

export const LOADER_DISPLAY_NAMES: Record<string, string> = {
    neoforge: 'NeoForge',
    bungeecord: 'BungeeCord',
    liteloader: 'LiteLoader',
    'bta-babric': 'BTA Babric',
    nilloader: 'NilLoader',
    waterfall: 'Waterfall',
    velocity: 'Velocity',
    purpur: 'Purpur',
    folia: 'Folia',
    sponge: 'Sponge',
    rift: 'Rift',
    babric: 'Babric',
    ornithe: 'Ornithe',
    bukkit: 'Bukkit',
    spigot: 'Spigot',
    paper: 'Paper',
    geyser: 'Geyser',
    datapack: 'Datapack'
};

export function formatSlugToReadableText(slug: string): string {
    if (!slug) return slug;
    return slug
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

export function formatVersionNumber(s: string): string {
    // append a leading 'v' character for numeric-prefixed versions
    const firstChar = s.charCodeAt(0);
    return firstChar < 48 || firstChar > 57 ? s : 'v' + s;
}

export function capitalize(str: string): string {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1);
}

export function getLoaderDisplayName(slug: string): string {
    return LOADER_DISPLAY_NAMES[slug] ?? capitalize(slug);
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

export function formatSpeed(bytesPerSec: number): string {
    if (bytesPerSec <= 0) return '0 B/s';
    let unitIndex = 0;
    let size = bytesPerSec;
    while (size >= 1024 && unitIndex < BYTE_UNITS.length - 1) {
        size /= 1024;
        unitIndex++;
    }
    const formatted = unitIndex === 0 ? size.toString() : size.toFixed(1).replace(/\.0$/, '');
    return `${formatted} ${BYTE_UNITS[unitIndex]}/s`;
}

export function formatEta(seconds: number): string {
    if (!isFinite(seconds) || isNaN(seconds)) return '∞';
    if (seconds <= 0) return '< 1s';
    if (seconds < 60) return `${Math.ceil(seconds)}s`;
    if (seconds < 3600) {
        const minutes = Math.floor(seconds / 60);
        const secs = Math.ceil(seconds % 60);
        return secs === 0 ? `${minutes}m` : `${minutes}m ${secs}s`;
    }
    if (seconds < 86400) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.ceil((seconds % 3600) / 60);
        return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
    }
    const days = Math.floor(seconds / 86400);
    const hours = Math.ceil((seconds % 86400) / 3600);
    return hours === 0 ? `${days}d` : `${days}d ${hours}h`;
}

export function getModrinthProjectUrl(projectType: string, projectSlug: string): string {
    return `https://modrinth.com/${projectType}/${projectSlug}`;
}

export function formatRelativeTime(isoDate: string): string {
    const date = new Date(isoDate);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 30) return `${diffDays}d ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
    return `${Math.floor(diffDays / 365)}y ago`;
}
