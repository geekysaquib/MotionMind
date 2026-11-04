export type DataMode = 'api' | 'memory';

// import.meta.env is filled by Vite; in Jest it doesn't exist, so fall back to defaults.
const env: Partial<ImportMetaEnv> = import.meta.env ?? {};

export const config = {
  dataMode: (env.VITE_DATA_MODE === 'memory' ? 'memory' : 'api') as DataMode,
  // Same origin by default: Vite proxies /api to the local API in development.
  apiUrl: ((env.VITE_API_URL as string | undefined) ?? '').replace(/\/+$/, ''),
};
