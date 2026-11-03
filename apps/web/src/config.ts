export type DataMode = 'supabase' | 'memory';

const env = import.meta.env;

export const config = {
  dataMode: (env.VITE_DATA_MODE === 'memory' ? 'memory' : 'supabase') as DataMode,
  supabaseUrl: env.VITE_SUPABASE_URL as string | undefined,
  supabaseAnonKey: env.VITE_SUPABASE_ANON_KEY as string | undefined,
  apiUrl: (env.VITE_API_URL as string | undefined) ?? 'http://localhost:8787',
};

export function configProblems(): string[] {
  if (config.dataMode === 'memory') return [];
  const out: string[] = [];
  if (!config.supabaseUrl) out.push('VITE_SUPABASE_URL is not set');
  if (!config.supabaseAnonKey) out.push('VITE_SUPABASE_ANON_KEY is not set');
  return out;
}
