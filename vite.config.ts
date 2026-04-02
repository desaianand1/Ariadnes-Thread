import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import devtoolsJson from 'vite-plugin-devtools-json';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));
const nodeStub = fileURLToPath(new URL('./src/lib/stubs/node.ts', import.meta.url));

/**
 * Patches Node built-in usage for Cloudflare Workers compatibility in the
 * SSR production build:
 * - Stubs fs/path (imported by @better-svelte-email/preview, dev-only)
 * - Fixes createRequire(import.meta.url) → createRequire(import.meta.url ?? 'file:///')
 *   because Rolldown's CJS interop emits this call but import.meta.url is
 *   undefined in Workers
 */
function cloudflareNodeCompat(): Plugin {
    return {
        name: 'cloudflare-node-compat',
        enforce: 'pre',
        apply: 'build',
        resolveId(id) {
            if ((id === 'fs' || id === 'path') && this.environment?.config.consumer === 'server') {
                return nodeStub;
            }
        },
        transform(code, _id) {
            if (
                this.environment?.config.consumer === 'server' &&
                code.includes('createRequire(import.meta.url)')
            ) {
                return code.replace(
                    /createRequire\(import\.meta\.url\)/g,
                    "createRequire(import.meta.url ?? 'file:///')"
                );
            }
        }
    };
}

export default defineConfig({
    plugins: [tailwindcss(), sveltekit(), cloudflareNodeCompat(), devtoolsJson()],
    define: { __APP_VERSION__: JSON.stringify(pkg.version) },
    test: {
        expect: { requireAssertions: true },
        projects: [
            {
                extends: './vite.config.ts',
                test: {
                    name: 'server',
                    environment: 'node',
                    include: ['src/**/*.{test,spec}.{js,ts}'],
                    exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
                }
            }
        ]
    }
});
