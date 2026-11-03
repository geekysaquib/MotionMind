export type DataMode = 'api' | 'memory';

const env = import.meta.env;

export const config = {
  dataMode: (env.VITE_DATA_MODE === 'memory' ? 'memory' : 'api') as DataMode,
  // Unset in a production build means same origin (Netlify serves the API at /api).
  apiUrl: ((env.VITE_API_URL as string | undefined) ?? (env.DEV ? 'http://localhost:8787' : '')).replace(/\/+$/, ''),
};
