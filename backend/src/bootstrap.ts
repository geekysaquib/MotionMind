import { createClient } from '@supabase/supabase-js';
import type { FastifyInstance } from 'fastify';
import { ConsoleMailer, SmtpMailer, type Mailer } from './accounts/mailer';
import { SessionTokens } from './accounts/session';
import { buildApp } from './app';
import { AnyVerifier, DevTokenVerifier } from './auth';
import { KeyCipher } from './crypto';
import { MemoryDataRepository, SupabaseDataRepository } from './data/repository';
import type { Env } from './env';
import { MemoryKeyRepository, SupabaseKeyRepository } from './keys/repository';

// Shared by the local server (server.ts) and the Netlify function (netlify/functions/api.ts).
export async function createAppFromEnv(env: Env, opts: { logger: boolean }): Promise<FastifyInstance> {
  const cipher = new KeyCipher(env.KEY_ENCRYPTION_SECRET);
  const sessions = new SessionTokens(env.AUTH_SECRET);

  let mailer: Mailer;
  if (env.SMTP_HOST) {
    mailer = new SmtpMailer({ host: env.SMTP_HOST, port: env.SMTP_PORT, user: env.SMTP_USER!, pass: env.SMTP_PASS!, from: env.SMTP_FROM ?? env.SMTP_USER! });
  } else {
    console.warn('SMTP_HOST is not set: sign-in codes will be printed here instead of emailed.');
    mailer = new ConsoleMailer();
  }

  let deps;
  if (env.API_DATA_MODE === 'memory') {
    console.warn('API running in MEMORY mode: data kept in RAM, demo tokens accepted. Never use this in production.');
    deps = { keys: new MemoryKeyRepository(), data: new MemoryDataRepository(), verifier: new AnyVerifier([sessions, new DevTokenVerifier()]) };
  } else {
    const db = createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
    deps = { keys: new SupabaseKeyRepository(db), data: new SupabaseDataRepository(db) };
  }

  return buildApp({ ...deps, sessions, mailer, authSecret: env.AUTH_SECRET, cipher, webOrigin: env.WEB_ORIGIN, mode: env.API_DATA_MODE, logger: opts.logger });
}
