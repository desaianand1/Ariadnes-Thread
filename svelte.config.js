import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import adapter from '@sveltejs/adapter-static';
export default {
  // Consult https://svelte.dev/docs#compile-time-svelte-preprocess
  // for more information about preprocessors
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      fallback: 'index.html'
    }),
    alias: {
      $routes: '.svelte-kit/types/src/routes',
      $components: 'src/lib/components',
      $ui: 'src/lib/components/ui',
      $utils: 'src/lib/utils',
      $schema: 'src/lib/schema',
      $api: 'src/lib/api',
      $state: 'src/lib/state',
      $config: 'src/config',
      $assets: 'src/assets'
    }
  }
};
