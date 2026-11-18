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
    },
  },
  // The single .env lives in the repo root. Only VITE_* values are exposed to the browser.
  envDir: fileURLToPath(new URL('..', import.meta.url)),
  // The web app calls /api on its own origin; Vite forwards it to the local API.
  // host: the phone and tablet reach Motion Mind Terminal on this PC's Wi-Fi address (see /t and Settings, Open on your phone).
  server: { port: 5173, host: true, proxy: { '/api': api, '/health': api } },
});
