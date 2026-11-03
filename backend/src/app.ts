import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import type { ProviderId } from '@motionmind/shared';
import { registerAccountRoutes } from './account/routes';
import type { ClaudeClient } from './ai/claude';
import { registerClaudeRoutes } from './ai/routes';
import type { Mailer } from './auth/mailer';
import { registerLoginRoutes } from './auth/routes';
import type { SessionTokens } from './auth/session';
import type { TokenVerifier } from './auth/verifiers';
import type { DataRepository } from './data/repository';
import type { KeyCipher } from './keys/crypto';
import type { KeyRepository } from './keys/repository';
import { registerKeyRoutes } from './keys/routes';
import type { KeyTester } from './keys/testers';
import { registerClientLogRoutes, type ClientLogReport } from './logs/routes';

/** Everything the API needs, passed in so tests can swap any piece. Built from env in bootstrap.ts. */
export interface AppDeps {
  keys: KeyRepository;
  data: DataRepository;
  sessions: SessionTokens;
  mailer: Mailer;
  /** Defaults to the session tokens. Tests swap in DevTokenVerifier. */
  verifier?: TokenVerifier;
  /** Signs session tokens and hashes login codes. */
  authSecret: string;
  cipher: KeyCipher;
  webOrigin: string;
  mode: 'supabase' | 'memory';
  testers?: Partial<Record<ProviderId, KeyTester>>;
  fetchImpl?: typeof fetch;
  logger?: boolean;
  /** Where browser log reports go. Defaults to one console line each. */
  clientLogSink?: (report: ClientLogReport) => void;
  /** Builds a Claude client for a user's Anthropic key. Tests pass a fake. */
  claude?: (apiKey: string) => ClaudeClient;
}

declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
  }
}

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({
    logger: deps.logger ? { redact: ['req.headers.authorization', 'body.apiKey', 'body.code'] } : false,
  });
  const verifier = deps.verifier ?? deps.sessions;

  await app.register(cors, { origin: deps.webOrigin, methods: ['GET', 'PUT', 'PATCH', 'POST', 'DELETE'] });
  app.decorateRequest('userId', '');

  app.get('/health', async () => ({ ok: true, mode: deps.mode }));

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
      registerKeyRoutes(api, deps);
      registerClaudeRoutes(api, deps);
    },
    { prefix: '/api' },
  );

  app.setErrorHandler((err: Error & { statusCode?: number; code?: string }, req, reply) => {
    // Fastify's own client errors (bad JSON, body too large, ...) keep their 4xx status.
    if (err.statusCode && err.statusCode < 500) {
      return reply.code(err.statusCode).send({ error: err.code?.toLowerCase() ?? 'bad_request', message: err.message });
    }
    req.log.error({ err }, 'request failed');
    reply.code(500).send({ error: 'internal', message: 'Something went wrong on the server.' });
  });

  return app;
}
