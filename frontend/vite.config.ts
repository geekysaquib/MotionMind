import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Local API address for the dev proxy (same PORT the API reads from .env).
const api = `http://localhost:${process.env.PORT ?? 8787}`;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@motionmind/shared': fileURLToPath(new URL('../shared/src/index.ts', import.meta.url)),
      // The reel engine is embedded in the web app for live previews (same code the renderer uses).
      '@motionmind/reel-engine': fileURLToPath(new URL('../backend/reel-engine/src/public.ts', import.meta.url)),
    },
  },
  // The single .env lives in the repo root. Only VITE_* values are exposed to the browser.
  envDir: fileURLToPath(new URL('..', import.meta.url)),
  // The web app calls /api on its own origin; Vite forwards it to the local API.
  server: { port: 5173, proxy: { '/api': api, '/health': api } },
});
