import { createClient } from '@supabase/supabase-js';
import type { FastifyInstance } from 'fastify';
import { ConsoleMailer, SmtpMailer, type Mailer } from './auth/mailer';
import { SessionTokens } from './auth/session';
import { buildApp } from './app';
import { AnyVerifier, DevTokenVerifier } from './auth/verifiers';
import { MemoryDataRepository, SupabaseDataRepository } from './data/repository';
import type { Env } from './env';
import { MemoryAudioStore, SupabaseAudioStore } from './voice/audioStore';

// Builds the app from the environment. Used by the local server (server.ts).
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

  // MP4 export renders Claude's animation on this machine with HyperFrames (headless Chrome) and FFmpeg.
  const renderer = new (await import('./export/renderer')).HyperFramesRenderer();

  // Raw footage editing runs FFmpeg and whisper.cpp on this machine too.
  const { FootageStore, DEFAULT_FOOTAGE_DIR } = await import('./footage/store');
  const { LocalMediaTools } = await import('./footage/tools');
  const footage = { store: new FootageStore(env.FOOTAGE_DIR || DEFAULT_FOOTAGE_DIR), tools: new LocalMediaTools(env) };

  const layoutChecker = (await import('./animation/layout')).hyperFramesLayoutChecker();
  return buildApp({ ...deps, renderer, layoutChecker, footage, sessions, mailer, authSecret: env.AUTH_SECRET, webOrigin: env.WEB_ORIGIN, mode: env.API_DATA_MODE, logger: opts.logger });
}
