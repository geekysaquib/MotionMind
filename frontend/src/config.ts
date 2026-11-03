export type DataMode = 'api' | 'memory';

const env = import.meta.env;

export const config = {
  dataMode: (env.VITE_DATA_MODE === 'memory' ? 'memory' : 'api') as DataMode,
  // Same origin by default: Netlify serves the API at /api, and Vite proxies /api to the local API in development.
  apiUrl: ((env.VITE_API_URL as string | undefined) ?? '').replace(/\/+$/, ''),
};
