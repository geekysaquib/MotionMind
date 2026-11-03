import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@motionmind/shared': fileURLToPath(new URL('../shared/src/index.ts', import.meta.url)) } },
  // The single .env lives in the repo root. Only VITE_* values are exposed to the browser.
  envDir: fileURLToPath(new URL('..', import.meta.url)),
  server: { port: 5173 },
  test: { name: 'frontend', environment: 'jsdom', globals: false },
} as Parameters<typeof defineConfig>[0]);
