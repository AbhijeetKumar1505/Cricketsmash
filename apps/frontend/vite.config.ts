import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  /** Monorepo `public/` (logo and static assets at repo root). */
  publicDir: path.resolve(__dirname, '../../public'),
  plugins: [svelte(), tailwindcss()],
  resolve: {
    /** Prefer browser-safe `@cricket-crash/fairness` entry (no `node:crypto`). */
    conditions: ['browser', 'development', 'import', 'module', 'default'],
  },
  optimizeDeps: {
    exclude: ['stake-engine'],
  },
  build: {
    /** Static output for Stake Engine upload */
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'esbuild',
  },
  server: {
    port: 5173,
  },
});
