import { readFileSync, existsSync, appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { build as esbuildBuild } from 'esbuild';
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

/**
 * Post-build plugin: bundles the ResolutionCache DO class with esbuild and
 * appends it to the SvelteKit-generated _worker.js.
 *
 * Temporary workaround — remove when sveltejs/kit#15627 merges and
 * @cloudflare/vite-plugin supports SvelteKit natively.
 */
function injectDurableObject(): Plugin {
    return {
        name: 'inject-durable-object',
        apply: 'build',
        async closeBundle() {
            const workerPath = resolve('.svelte-kit/cloudflare/_worker.js');
            if (!existsSync(workerPath)) return;

            const doEntry = resolve('src/lib/server/resolution-cache-do.ts');

            const result = await esbuildBuild({
                entryPoints: [doEntry],
                bundle: true,
                format: 'esm',
                target: 'es2022',
                write: false,
                external: ['cloudflare:workers'],
                alias: {
                    $lib: resolve('src/lib'),
                    '$env/dynamic/private': resolve('src/lib/stubs/env-private.ts')
                },
                define: {
                    __APP_VERSION__: JSON.stringify(pkg.version)
                }
            });

            const bundledCode = result.outputFiles[0].text;

            // Strip the esbuild-generated export so we can re-export from _worker.js
            const codeWithoutExport = bundledCode.replace(
                /export\s*\{[^}]*ResolutionCache[^}]*\}\s*;?\s*$/m,
                ''
            );

            if (/export\s*\{[^}]*ResolutionCache/.test(codeWithoutExport)) {
                throw new Error(
                    '[inject-durable-object] Failed to strip esbuild export for ResolutionCache'
                );
            }

            appendFileSync(
                workerPath,
                `\n// === Durable Object: ResolutionCache (injected by injectDurableObject plugin) ===\n` +
                    codeWithoutExport +
                    `\nexport { ResolutionCache };\n`
            );

            console.log('[inject-durable-object] Appended ResolutionCache to _worker.js');
        }
    };
}

export default defineConfig({
    plugins: [
        tailwindcss(),
        sveltekit(),
        cloudflareNodeCompat(),
        injectDurableObject(),
        devtoolsJson()
    ],
    optimizeDeps: { include: ['qrcode'] },
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
