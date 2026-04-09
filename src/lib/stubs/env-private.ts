/**
 * Stub for $env/dynamic/private used when bundling the DO class outside
 * of SvelteKit. The DO receives its env bindings via the constructor, not
 * through SvelteKit's $env module.
 *
 * Named `_env` internally to avoid colliding with the top-level
 * `import { env } from "cloudflare:workers"` that SvelteKit's adapter
 * emits in _worker.js. The re-export as `env` satisfies import sites
 * while esbuild's bundler will use the local `_env` identifier.
 */
const _env: Record<string, string | undefined> = {};
export { _env as env };
