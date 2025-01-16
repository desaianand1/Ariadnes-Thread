import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import path from 'path'

export default defineConfig({
  plugins: [svelte()],
  base: './',
  resolve: {
    alias: {
      '$lib': path.resolve(__dirname, './src/lib'),
      '$ui': path.resolve(__dirname, './src/lib/components/ui'),
      '$components': path.resolve(__dirname, './src/lib/components'),
      '$utils': path.resolve(__dirname, './src/lib/utils'),
      '$schema': path.resolve(__dirname, './src/lib/schema'),
      '$api': path.resolve(__dirname, './src/lib/api'),
      '$config': path.resolve(__dirname, './src/config'),
      '$assets': path.resolve(__dirname, './src/assets')
    }
  },
  build: {
    target: 'esnext',
    minify: 'esbuild',
    sourcemap: true
  },
  server: {
    port: 5173,
    strictPort: true
  }
})