export type OSPlatform = 'windows' | 'macos' | 'linux';

/**
 * Best-effort OS detection from browser APIs.
 * Falls back to 'windows' when detection is ambiguous (largest user base).
 */
export function detectOS(): OSPlatform {
    if (typeof navigator === 'undefined') return 'windows';

    // Navigator.userAgentData is the modern replacement (Chromium-based)
    const platform =
        (navigator as { userAgentData?: { platform?: string } }).userAgentData?.platform ??
        navigator.platform ??
        '';

    const ua = navigator.userAgent;

    if (/mac/i.test(platform) || /macintosh|mac os x/i.test(ua)) return 'macos';
    if (/linux/i.test(platform) || /linux/i.test(ua)) return 'linux';
    return 'windows';
}

export const OS_LABELS: Record<OSPlatform, string> = {
    windows: 'Windows',
    macos: 'macOS',
    linux: 'Linux'
};
