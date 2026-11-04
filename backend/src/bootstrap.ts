import { createClient } from '@supabase/supabase-js';
import type { FastifyInstance } from 'fastify';
import { ConsoleMailer, SmtpMailer, type Mailer } from './auth/mailer';
import { SessionTokens } from './auth/session';
import { buildApp } from './app';
import { AnyVerifier, DevTokenVerifier } from './auth/verifiers';
import { MemoryDataRepository, SupabaseDataRepository } from './data/repository';
import type { Env } from './env';
import { MemoryAudioStore, SupabaseAudioStore } from './voice/audioStore';

// Shared by the local server (server.ts) and the Netlify function (netlify/functions/api.ts).
export async function createAppFromEnv(env: Env, opts: { logger: boolean }): Promise<FastifyInstance> {
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
    deps = { data: new MemoryDataRepository(), audio: new MemoryAudioStore(), verifier: new AnyVerifier([sessions, new DevTokenVerifier()]) };
  } else {
    const db = createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
    deps = { data: new SupabaseDataRepository(db), audio: new SupabaseAudioStore(db) };
  }

  return buildApp({ ...deps, sessions, mailer, authSecret: env.AUTH_SECRET, anthropicApiKey: env.ANTHROPIC_API_KEY, elevenLabsApiKey: env.ELEVENLABS_API_KEY, defaultVoiceId: env.ELEVENLABS_VOICE_ID, webOrigin: env.WEB_ORIGIN, mode: env.API_DATA_MODE, logger: opts.logger });
}
