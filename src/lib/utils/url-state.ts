/**
 * URL state management for the review page.
 * Keeps the `x` (excluded project IDs) query param in sync with client state.
 */

export function buildReviewUrl(currentUrl: URL, updates: { x?: Set<string> }): string {
    const params = new URLSearchParams(currentUrl.searchParams);

    if (updates.x !== undefined) {
        if (updates.x.size > 0) {
            params.set('x', Array.from(updates.x).join(','));
        } else {
            params.delete('x');
        }
    }

    const qs = params.toString();
    return `${currentUrl.pathname}${qs ? `?${qs}` : ''}`;
}
