import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import type { ProviderId } from '@motionmind/shared';
import { registerAccountRoutes } from './account/routes';
import type { Mailer } from './auth/mailer';
import { registerLoginRoutes } from './auth/routes';
import type { SessionTokens } from './auth/session';
import type { TokenVerifier } from './auth/verifiers';
import type { DataRepository } from './data/repository';
import type { KeyCipher } from './keys/crypto';
import type { KeyRepository } from './keys/repository';
import { registerKeyRoutes } from './keys/routes';
import type { KeyTester } from './keys/testers';

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
    },
    { prefix: '/api' },
  );

  app.setErrorHandler((err, req, reply) => {
    req.log.error({ err }, 'request failed');
    reply.code(500).send({ error: 'internal', message: 'Something went wrong on the server.' });
  });

  return app;
}
