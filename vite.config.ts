import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import path from 'path'

export default defineConfig({
  plugins: [svelte()],
  base: './',
  resolve: {
    alias: {
      '$lib': path.resolve(__dirname, './src/lib'),
      '$components': path.resolve(__dirname, './src/lib/components'),
      '$utils': path.resolve(__dirname, './src/lib/utils'),
      '$styles': path.resolve(__dirname, './src/styles'),
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