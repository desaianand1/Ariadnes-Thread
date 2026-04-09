/**
 * Stub for $env/dynamic/private used when bundling the DO class outside
 * of SvelteKit. The DO receives its env bindings via the constructor, not
 * through SvelteKit's $env module.
 */
export const env: Record<string, string | undefined> = {};
