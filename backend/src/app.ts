import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { registerAccountRoutes } from './account/routes';
import { registerClaudeRoutes } from './ai/routes';
import { registerDiscoverRoutes } from './discover/routes';
import { registerAnimationAssets, registerAnimationRoutes } from './animation/routes';
import { registerCoverRoutes } from './cover/routes';
import { MemoryAudioStore, type AudioStore } from './voice/audioStore';
import { registerEditorRoutes } from './editor/routes';
import type { Renderer } from './export/renderer';
import type { LayoutChecker } from './animation/layout';
import { registerExportRoutes, registerRenderDownload } from './export/routes';
import { registerFootageFiles, registerFootageRoutes, type FootageDeps } from './footage/routes';
import { registerLogoRoute, type LogoFetcher } from './logo/routes';
import type { Mailer } from './auth/mailer';
import { registerLoginRoutes } from './auth/routes';
import type { SessionTokens } from './auth/session';
import type { TokenVerifier } from './auth/verifiers';
import type { DataRepository } from './data/repository';
import { registerClientLogRoutes, type ClientLogReport } from './logs/routes';

/** Everything the API needs, passed in so tests can swap any piece. Built from env in bootstrap.ts. */
export interface AppDeps {
  /** Looks up a company's logo by website. Defaults to the public favicon services. */
  fetchLogo?: LogoFetcher;
  data: DataRepository;
  sessions: SessionTokens;
  mailer: Mailer;
  /** Defaults to the session tokens. Tests swap in DevTokenVerifier. */
  verifier?: TokenVerifier;
  /** Signs session tokens and hashes login codes. */
  authSecret: string;
  webOrigin: string;
  mode: 'supabase' | 'memory';
  fetchImpl?: typeof fetch;
  logger?: boolean;
  /** Where browser log reports go. Defaults to one console line each. */
  clientLogSink?: (report: ClientLogReport) => void;
  /** Where voiceover MP3s are stored. Defaults to memory (tests, demo). */
  audio: AudioStore;
  /** MP4 export (Remotion), rendered on the machine running the API. Absent in tests. */
  renderer?: Renderer;
  /** Looks for overlapping or hidden text in Claude's animation (runs Chrome on this machine). */
  layoutChecker?: LayoutChecker;
  /** Raw footage editing (FFmpeg, whisper.cpp) on the machine running the API. Absent: the routes answer 501. */
  footage?: FootageDeps;
}

declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
  }
}

export async function buildApp(input: Omit<AppDeps, 'audio'> & { audio?: AudioStore }): Promise<FastifyInstance> {
  const deps: AppDeps = { ...input, audio: input.audio ?? new MemoryAudioStore() };
  const app = Fastify({
    logger: deps.logger ? { redact: ['req.headers.authorization', 'body.apiKey', 'body.code'] } : false,
  });
  const verifier = deps.verifier ?? deps.sessions;

  await app.register(cors, { origin: deps.webOrigin, methods: ['GET', 'PUT', 'PATCH', 'POST', 'DELETE'] });
  app.decorateRequest('userId', '');

  app.get('/health', async () => ({ ok: true, mode: deps.mode }));
  registerRenderDownload(app, deps);
  registerLogoRoute(app, deps);
  registerAnimationAssets(app);
  registerFootageFiles(app, deps);

  // Public
  app.register(async (auth) => registerLoginRoutes(auth, deps), { prefix: '/api/auth' });
  app.register(async (logs) => registerClientLogRoutes(logs, deps), { prefix: '/api' });

  // Signed in: every route below sees req.userId
  app.register(
    async (api) => {
      api.addHook('onRequest', async (req, reply) => {
        const header = req.headers.authorization ?? '';
        const token = header.startsWith('Bearer ') ? header.slice(7) : '';
        const userId = token ? await verifier.verify(token) : null;
        if (!userId) return reply.code(401).send({ error: 'unauthorized', message: 'Sign in again.' });
        req.userId = userId;
      });
      registerAccountRoutes(api, deps);
      registerClaudeRoutes(api, deps);
      registerDiscoverRoutes(api, deps);
      registerEditorRoutes(api, deps);
      registerExportRoutes(api, deps);
      registerCoverRoutes(api, deps);
      registerAnimationRoutes(api, deps);
      registerFootageRoutes(api, deps);
    },
    { prefix: '/api' },
  );

  app.setErrorHandler((err: Error & { statusCode?: number; code?: string }, req, reply) => {
    // Fastify's own client errors (bad JSON, body too large, ...) keep their 4xx status.
    if (err.code === 'FST_ERR_CTP_BODY_TOO_LARGE') {
      return reply.code(413).send({ error: 'too_large', message: 'That file is too large. Keep audio under 40 MB.' });
    }
    if (err.statusCode && err.statusCode < 500) {
      return reply.code(err.statusCode).send({ error: err.code?.toLowerCase() ?? 'bad_request', message: err.message });
    }
    req.log.error({ err }, 'request failed');
    reply.code(500).send({ error: 'internal', message: 'Something went wrong on the server.' });
  });

  return app;
}
