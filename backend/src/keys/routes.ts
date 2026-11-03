import type { FastifyInstance, FastifyRequest } from 'fastify';
import { PROVIDER_INFO, providerIdSchema, saveKeySchema } from '@motionmind/shared';
import type { AppDeps } from '../app';
import { firstIssue } from '../http';
import { last4 } from './crypto';
import { toSummary } from './repository';
import { KEY_TESTERS } from './testers';

/** Signed-in only: the caller's provider API keys. Keys are encrypted at rest and never sent back. */
export function registerKeyRoutes(api: FastifyInstance, deps: AppDeps) {
  const testers = deps.testers ?? KEY_TESTERS;
  const fetchImpl = deps.fetchImpl ?? fetch;
  const parseProvider = (req: FastifyRequest) => providerIdSchema.safeParse((req.params as { provider?: string }).provider);
  // Binds each ciphertext to its owner and provider, so a row copied elsewhere won't decrypt.
  const aad = (userId: string, provider: string) => `${userId}:${provider}`;

  api.get('/keys', async (req) => {
    const rows = await deps.keys.list(req.userId);
    return { keys: rows.map(toSummary) };
  });

  api.put('/keys/:provider', async (req, reply) => {
    const provider = parseProvider(req);
    if (!provider.success) return reply.code(404).send({ error: 'unknown_provider' });
    const body = saveKeySchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_key', message: firstIssue(body.error) });
    const sealed = deps.cipher.seal(body.data.apiKey, aad(req.userId, provider.data));
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
    const apiKey = deps.cipher.open(row, aad(req.userId, provider.data));
    const result = await tester(apiKey, fetchImpl);
    await deps.keys.markTested(req.userId, provider.data, result.ok);
    return { result, tested: true };
  });
}
