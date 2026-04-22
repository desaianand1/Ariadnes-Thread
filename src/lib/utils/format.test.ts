import { describe, it, expect, vi, afterEach } from 'vitest';
import {
    capitalize,
    formatBytes,
    formatNumber,
    formatRelativeTime,
    formatSpeed,
    formatEta,
    getLoaderDisplayName,
    formatSlugToReadableText,
    formatVersionNumber,
    getModrinthProjectUrl,
    isStaleUpdate,
    formatFullDate
} from './format';

describe('capitalize', () => {
    it('returns empty string unchanged', () => {
        expect(capitalize('')).toBe('');
    });

    it('capitalizes a single character', () => {
        expect(capitalize('a')).toBe('A');
    });

    it('returns already capitalized string unchanged', () => {
        expect(capitalize('Hello')).toBe('Hello');
    });

    it('capitalizes a normal word', () => {
        expect(capitalize('client')).toBe('Client');
    });
});

describe('formatBytes', () => {
    it('formats zero bytes', () => {
        expect(formatBytes(0)).toBe('0 B');
    });

    it('formats bytes under 1KB', () => {
        expect(formatBytes(512)).toBe('512 B');
    });

    it('formats kilobytes', () => {
        expect(formatBytes(1024)).toBe('1 KB');
        expect(formatBytes(1536)).toBe('1.5 KB');
    });

    it('formats megabytes', () => {
        expect(formatBytes(1048576)).toBe('1 MB');
    });

    it('handles negative values', () => {
        expect(formatBytes(-1)).toBe('0 B');
    });

    it('formats gigabytes', () => {
        expect(formatBytes(1073741824)).toBe('1 GB');
    });
});

describe('formatNumber', () => {
    it('formats small numbers without suffix', () => {
        expect(formatNumber(0)).toBe('0');
        expect(formatNumber(999)).toBe('999');
    });

    it('formats thousands with K suffix', () => {
        expect(formatNumber(1000)).toBe('1K');
        expect(formatNumber(1500)).toBe('1.5K');
        expect(formatNumber(45_000)).toBe('45K');
    });

    it('formats millions with M suffix', () => {
        expect(formatNumber(1_000_000)).toBe('1M');
        expect(formatNumber(1_500_000)).toBe('1.5M');
    });

    it('formats billions with B suffix', () => {
        expect(formatNumber(1_000_000_000)).toBe('1B');
    });

    it('handles negative numbers gracefully', () => {
        expect(formatNumber(-500)).toBe('-500');
    });
});

describe('getLoaderDisplayName', () => {
    it('returns correct names for multi-word loaders', () => {
        expect(getLoaderDisplayName('neoforge')).toBe('NeoForge');
        expect(getLoaderDisplayName('bungeecord')).toBe('BungeeCord');
        expect(getLoaderDisplayName('bta-babric')).toBe('BTA Babric');
        expect(getLoaderDisplayName('liteloader')).toBe('LiteLoader');
    });

    it('returns correct names for simple loaders', () => {
        expect(getLoaderDisplayName('fabric')).toBe('Fabric');
        expect(getLoaderDisplayName('forge')).toBe('Forge');
        expect(getLoaderDisplayName('quilt')).toBe('Quilt');
    });

    it('capitalizes unmapped loader slugs as fallback', () => {
        expect(getLoaderDisplayName('unknownloader')).toBe('Unknownloader');
    });

    it('handles empty string', () => {
        expect(getLoaderDisplayName('')).toBe('');
    });
});

describe('formatSpeed', () => {
    it('formats bytes per second', () => {
        expect(formatSpeed(500)).toBe('500 B/s');
    });

    it('formats kilobytes per second', () => {
        expect(formatSpeed(1024)).toBe('1 KB/s');
        expect(formatSpeed(1536)).toBe('1.5 KB/s');
    });

    it('formats megabytes per second', () => {
        expect(formatSpeed(5 * 1024 * 1024)).toBe('5 MB/s');
    });

    it('handles zero and negative', () => {
        expect(formatSpeed(0)).toBe('0 B/s');
        expect(formatSpeed(-100)).toBe('0 B/s');
    });
});

describe('formatEta', () => {
    it('returns "< 1s" for zero or negative', () => {
        expect(formatEta(0)).toBe('< 1s');
        expect(formatEta(-5)).toBe('< 1s');
    });

    it('formats seconds under a minute', () => {
        expect(formatEta(30)).toBe('30s');
        expect(formatEta(0.5)).toBe('1s');
    });

    it('formats minutes and seconds', () => {
        expect(formatEta(90)).toBe('1m 30s');
        expect(formatEta(120)).toBe('2m');
    });

    it('formats hours and minutes', () => {
        expect(formatEta(3600)).toBe('1h');
        expect(formatEta(5400)).toBe('1h 30m');
    });

    it('formats days and hours', () => {
        expect(formatEta(86400)).toBe('1d');
        expect(formatEta(90000)).toBe('1d 1h');
    });

    it('returns infinity symbol for Infinity and NaN', () => {
        expect(formatEta(Infinity)).toBe('∞');
        expect(formatEta(NaN)).toBe('∞');
    });

    it('formats very large finite numbers', () => {
        // 999999 seconds ≈ 11.5 days
        const result = formatEta(999999);
        expect(result).toMatch(/^\d+d \d+h$/);
    });
});

describe('formatRelativeTime', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('returns "today" for current date', () => {
        expect(formatRelativeTime(new Date().toISOString())).toBe('today');
    });

    it('returns "yesterday" for 1 day ago', () => {
        const yesterday = new Date(Date.now() - 86_400_000);
        expect(formatRelativeTime(yesterday.toISOString())).toBe('yesterday');
    });

    it('returns days ago for recent dates', () => {
        const fiveDaysAgo = new Date(Date.now() - 5 * 86_400_000);
        expect(formatRelativeTime(fiveDaysAgo.toISOString())).toBe('5d ago');
    });

    it('returns months ago for older dates', () => {
        const twoMonthsAgo = new Date(Date.now() - 60 * 86_400_000);
        expect(formatRelativeTime(twoMonthsAgo.toISOString())).toBe('2mo ago');
    });

    it('returns years ago for dates over a year old', () => {
        const twoYearsAgo = new Date(Date.now() - 730 * 86_400_000);
        expect(formatRelativeTime(twoYearsAgo.toISOString())).toBe('2y ago');
    });

    it('returns today for future dates', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2024-06-15T12:00:00Z'));
        const tomorrow = new Date('2024-06-16T12:00:00Z');
        const result = formatRelativeTime(tomorrow.toISOString());
        expect(result).toBe('today');
    });
});

describe('formatSlugToReadableText', () => {
    it('converts hyphenated slug to title case', () => {
        expect(formatSlugToReadableText('my-cool-mod')).toBe('My Cool Mod');
    });

    it('capitalizes a single word', () => {
        expect(formatSlugToReadableText('fabric')).toBe('Fabric');
    });

    it('returns empty string for empty input', () => {
        expect(formatSlugToReadableText('')).toBe('');
    });

    it('handles consecutive hyphens by producing extra spaces', () => {
        expect(formatSlugToReadableText('hello--world')).toBe('Hello  World');
    });
});

describe('formatVersionNumber', () => {
    it('prepends v to numeric-prefixed version', () => {
        expect(formatVersionNumber('1.0.0')).toBe('v1.0.0');
    });

    it('leaves alpha-prefixed version unchanged', () => {
        expect(formatVersionNumber('beta-1.0')).toBe('beta-1.0');
    });

    it('prepends v to version starting with 0', () => {
        expect(formatVersionNumber('0.1.0')).toBe('v0.1.0');
    });
});

describe('getModrinthProjectUrl', () => {
    it('builds mod URL', () => {
        expect(getModrinthProjectUrl('mod', 'sodium')).toBe('https://modrinth.com/mod/sodium');
    });

    it('builds resourcepack URL', () => {
        expect(getModrinthProjectUrl('resourcepack', 'faithless')).toBe(
            'https://modrinth.com/resourcepack/faithless'
        );
    });
});

describe('isStaleUpdate', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('returns true when date exceeds threshold', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2024-06-15'));
        expect(isStaleUpdate('2024-01-01T00:00:00Z', 30)).toBe(true);
    });

    it('returns false when within threshold', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2024-01-15'));
        expect(isStaleUpdate('2024-01-01T00:00:00Z', 30)).toBe(false);
    });

    it('returns false for today with threshold of 1', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2024-06-15T12:00:00Z'));
        expect(isStaleUpdate('2024-06-15T00:00:00Z', 1)).toBe(false);
    });
});

describe('formatFullDate', () => {
    it('formats a known ISO date with year and month', () => {
        const result = formatFullDate('2024-06-15T14:30:00Z');
        expect(result).toContain('2024');
    });

    it('formats epoch date', () => {
        const result = formatFullDate('1970-01-01T00:00:00Z');
        expect(result).toContain('1970');
    });
});

describe('formatEta — boundary cases', () => {
    it('rounds up at boundary value 59.999 to 60s', () => {
        // Math.ceil(59.999) = 60 — documents that sub-minute display can show "60s"
        expect(formatEta(59.999)).toBe('60s');
    });
});

describe('formatBytes — TB range', () => {
    it('caps at GB for TB-range values since no TB unit exists', () => {
        expect(formatBytes(2 * 1024 ** 4)).toBe('2048 GB');
    });
});
