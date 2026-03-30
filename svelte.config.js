import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
    preprocess: vitePreprocess(),
    kit: {
        adapter: adapter({
            // Cloudflare Pages options
            routes: {
                include: ['/*'],
                exclude: ['<all>']
            }
        })
    }
};

export default config;
