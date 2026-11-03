import { fileURLToPath } from 'node:url';
import { defineWorkspace } from 'vitest/config';

const shared = { '@motionmind/shared': fileURLToPath(new URL('./shared/src/index.ts', import.meta.url)) };

export default defineWorkspace([
  'frontend/vite.config.ts',
  { resolve: { alias: shared }, test: { name: 'backend', root: 'backend', environment: 'node', exclude: ['reel-engine/**', '**/node_modules/**'] } },
  { test: { name: 'shared', root: 'shared', environment: 'node' } },
]);
