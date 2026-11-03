import { createClient } from '@supabase/supabase-js';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app';
import { DevTokenVerifier, SupabaseTokenVerifier } from './auth';
import { KeyCipher } from './crypto';
import type { Env } from './env';
import { MemoryKeyRepository, SupabaseKeyRepository } from './keys/repository';

// Shared by the local server (server.ts) and the Netlify function (netlify/functions/api.ts).
export async function createAppFromEnv(env: Env, opts: { logger: boolean }): Promise<FastifyInstance> {
  const cipher = new KeyCipher(env.KEY_ENCRYPTION_SECRET);

  let deps;
  if (env.API_DATA_MODE === 'memory') {
    console.warn('API running in MEMORY mode: demo tokens, keys kept in RAM. Never use this in production.');
    deps = { keys: new MemoryKeyRepository(), verifier: new DevTokenVerifier() };
  } else {
    const db = createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
    deps = { keys: new SupabaseKeyRepository(db), verifier: new SupabaseTokenVerifier(db) };
  }

  return buildApp({ ...deps, cipher, webOrigin: env.WEB_ORIGIN, mode: env.API_DATA_MODE, logger: opts.logger });
}
