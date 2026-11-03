import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import { PROVIDER_INFO, providerIdSchema, saveKeySchema, type ProviderId } from '@motionmind/shared';
import type { TokenVerifier } from './auth';
import { KeyCipher, last4 } from './crypto';
import { toSummary, type KeyRepository } from './keys/repository';
import { KEY_TESTERS, type KeyTester } from './providers/testers';

export interface AppDeps {
  keys: KeyRepository;
  verifier: TokenVerifier;
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
    logger: deps.logger ? { redact: ['req.headers.authorization', 'body.apiKey'] } : false,
  });
  const testers = deps.testers ?? KEY_TESTERS;
  const fetchImpl = deps.fetchImpl ?? fetch;

  await app.register(cors, { origin: deps.webOrigin, methods: ['GET', 'PUT', 'POST', 'DELETE'] });
  app.decorateRequest('userId', '');

  app.get('/health', async () => ({ ok: true, mode: deps.mode }));

  app.register(async (api) => {
    api.addHook('onRequest', async (req, reply) => {
      const header = req.headers.authorization ?? '';
      const token = header.startsWith('Bearer ') ? header.slice(7) : '';
      const userId = token ? await deps.verifier.verify(token) : null;
      if (!userId) return reply.code(401).send({ error: 'unauthorized', message: 'Sign in again.' });
      req.userId = userId;
    });

    const parseProvider = (req: FastifyRequest) => providerIdSchema.safeParse((req.params as { provider?: string }).provider);

    api.get('/keys', async (req) => {
      const rows = await deps.keys.list(req.userId);
      return { keys: rows.map(toSummary) };
    });

    api.put('/keys/:provider', async (req, reply) => {
      const provider = parseProvider(req);
      if (!provider.success) return reply.code(404).send({ error: 'unknown_provider' });
      const body = saveKeySchema.safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: 'invalid_key', message: body.error.issues[0]?.message });
      const sealed = deps.cipher.seal(body.data.apiKey, `${req.userId}:${provider.data}`);
      const row = await deps.keys.upsert({ userId: req.userId, provider: provider.data, last4: last4(body.data.apiKey), ...sealed });
      return { key: toSummary(row) };
    });

    api.delete('/keys/:provider', async (req, reply) => {
      const provider = parseProvider(req);
      if (!provider.success) return reply.code(404).send({ error: 'unknown_provider' });
      const removed = await deps.keys.remove(req.userId, provider.data);
      return removed ? { ok: true } : reply.code(404).send({ error: 'not_found' });
    });

    api.post('/keys/:provider/test', async (req, reply) => {
      const provider = parseProvider(req);
      if (!provider.success) return reply.code(404).send({ error: 'unknown_provider' });
      const row = await deps.keys.get(req.userId, provider.data);
      if (!row) return reply.code(404).send({ error: 'not_found', message: 'Save a key first.' });
      const tester = testers[provider.data];
      if (!tester) {
        return {
          result: { ok: false, detail: `${PROVIDER_INFO[provider.data].label} has no free test call. The key is checked on first use.` },
          tested: false,
        };
      }
      const apiKey = deps.cipher.open(row, `${req.userId}:${provider.data}`);
      const result = await tester(apiKey, fetchImpl);
      await deps.keys.markTested(req.userId, provider.data, result.ok);
      return { result, tested: true };
    });
  }, { prefix: '/api' });

  app.setErrorHandler((err, req, reply) => {
    req.log.error({ err }, 'request failed');
    reply.code(500).send({ error: 'internal', message: 'Something went wrong on the server.' });
  });

  return app;
}
