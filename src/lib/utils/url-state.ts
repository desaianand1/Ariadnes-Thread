/**
 * URL state management for the review page.
 * Keeps query params in sync with client state.
 */

import { MAX_ADVISOR_HISTORY_LENGTH } from '$lib/config/constants';

interface ReviewUrlUpdates {
    x?: Set<string>;
    /** Override Minecraft version (used by Best Configuration Advisor) */
    v?: string;
    /** Override mod loader (used by Best Configuration Advisor) */
    l?: string;
    /** When true, clear the `x` param (e.g. when switching config via advisor) */
    clearExclusions?: boolean;
    /** Record the config being switched FROM to prevent advisor oscillation */
    from_v?: string;
    from_l?: string;
}

export function buildReviewUrl(currentUrl: URL, updates: ReviewUrlUpdates): string {
    const params = new URLSearchParams(currentUrl.searchParams);

    if (updates.clearExclusions) {
        params.delete('x');
    } else if (updates.x !== undefined) {
        if (updates.x.size > 0) {
            params.set('x', Array.from(updates.x).join(','));
        } else {
            params.delete('x');
        }
    }

    if (updates.v !== undefined) {
        params.set('v', updates.v);
    }

    if (updates.l !== undefined) {
        params.set('l', updates.l);
    }

    if (updates.from_v !== undefined) {
        params.set('from_v', updates.from_v);
    }
    if (updates.from_l !== undefined) {
        params.set('from_l', updates.from_l);
    }

    const qs = params.toString();
    return `${currentUrl.pathname}${qs ? `?${qs}` : ''}`;
}

/**
 * Builds the URL for the advisor "Switch" action.
 * Sets the new version/loader, clears exclusions, and records the
 * current config as `from_v`/`from_l` to prevent oscillation.
 */
export function buildAdvisorSwitchUrl(
    currentUrl: URL,
    newVersion: string,
    newLoader: string,
    currentVersion: string,
    currentLoader: string
): string {
    const params = new URLSearchParams(currentUrl.searchParams);
    const existingFromV = params.get('from_v') || '';
    const existingFromL = params.get('from_l') || '';

    // Prepend current config to chain (newest first), cap at MAX_ADVISOR_HISTORY_LENGTH
    const chainV = existingFromV ? `${currentVersion},${existingFromV}` : currentVersion;
    const chainL = existingFromL ? `${currentLoader},${existingFromL}` : currentLoader;

    const truncatedV = chainV.split(',').slice(0, MAX_ADVISOR_HISTORY_LENGTH).join(',');
    const truncatedL = chainL.split(',').slice(0, MAX_ADVISOR_HISTORY_LENGTH).join(',');

    return buildReviewUrl(currentUrl, {
        v: newVersion,
        l: newLoader,
        clearExclusions: true,
        from_v: truncatedV,
        from_l: truncatedL
    });
}
