import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@motionmind/shared': fileURLToPath(new URL('../shared/src/index.ts', import.meta.url)) } },
  // The single .env lives in the repo root. Only VITE_* values are exposed to the browser.
  envDir: fileURLToPath(new URL('..', import.meta.url)),
  // In development the web app calls /api on its own origin, like on Netlify; Vite forwards it to the local API.
  server: { port: 5173, proxy: { '/api': 'http://localhost:8787', '/health': 'http://localhost:8787' } },
});
