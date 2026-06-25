import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [svelte()],
  build: { outDir: 'dist' },
  // Worker is constructed with `new Worker(url, { type: 'module' })`, so the
  // bundled chunk must be ES modules, not the IIFE default. Without this,
  // the worker fails to load in production with no error message.
  worker: { format: 'es' },
});
