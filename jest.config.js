// Jest runs TypeScript through SWC as native ES modules (see the `test` script for the Node flag).
// Three projects: the web app in a browser-like jsdom, the API and shared code in Node.
const swc = [
  '@swc/jest',
  {
    jsc: {
      parser: { syntax: 'typescript', tsx: true },
      transform: { react: { runtime: 'automatic' } },
      target: 'es2022',
    },
    module: { type: 'es6' },
  },
];

const base = {
  transform: { '^.+\\.(t|j)sx?$': swc },
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  moduleNameMapper: {
    '^@motionmind/shared$': '<rootDir>/shared/src/index.ts',
    '^@motionmind/reel-engine$': '<rootDir>/backend/reel-engine/src/public.ts',
    '\.css$': '<rootDir>/test/shims/style.cjs',
    // ESM-only package that Fastify's inject() requires; see the shim for why.
    '^cookie$': '<rootDir>/test/shims/cookie.cjs',
  },
  rootDir: '.',
  setupFiles: ['<rootDir>/test/quiet-app-logs.ts'],
};

// The first page test that loads the reel player imports all of Remotion, which can take a while on Windows.
const TEST_TIMEOUT_MS = 20_000;

/** @type {import('jest').Config} */
export default {
  testTimeout: TEST_TIMEOUT_MS,
  projects: [
    { ...base, testTimeout: TEST_TIMEOUT_MS, displayName: 'frontend', testEnvironment: '<rootDir>/test/jsdom-environment.cjs', roots: ['<rootDir>/frontend/src'] },
    { ...base, displayName: 'backend', testEnvironment: 'node', roots: ['<rootDir>/backend/src'] },
    { ...base, displayName: 'shared', testEnvironment: 'node', roots: ['<rootDir>/shared/src'] },
  ],
  collectCoverageFrom: ['{frontend,backend,shared}/src/**/*.{ts,tsx}', '!**/*.test.{ts,tsx}', '!frontend/src/main.tsx', '!backend/src/server.ts'],
};
