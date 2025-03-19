import { defineConfig } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
  plugins: [sveltekit()],
  build: {
    target: 'esnext',
    minify: 'esbuild',
    sourcemap: true
  },
  server: {
    port: 5173,
    strictPort: true
  },
});
