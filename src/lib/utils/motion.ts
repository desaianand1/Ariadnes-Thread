import { browser } from '$app/environment';

/**
 * Whether the user prefers reduced motion.
 * Evaluated once at module load in the browser; always false during SSR.
 */
export const prefersReducedMotion: boolean =
    browser && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Returns transition params that respect prefers-reduced-motion.
 * When reduced motion is preferred, duration is forced to 0.
 */
export function safeTransition<T extends { duration?: number }>(params: T): T {
    if (prefersReducedMotion) {
        return { ...params, duration: 0 };
    }
    return params;
}
