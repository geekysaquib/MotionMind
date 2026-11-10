import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import type { AppDeps } from '../app';
import { PastedScriptError } from '../ai/reelPrompt';
import { firstIssue } from '../http';
import { parseIdeas, trendingPrompt } from './ideas';
import { fetchTrending, TrendingError } from './trending';

const langSchema = z.object({ lang: z.enum(['en', 'hi']).default('en') });
const importSchema = z.object({ text: z.string().min(1, "Paste Claude's answer first.").max(100_000) });

/** Signed-in only: what is trending on Wikipedia, and reel ideas made from it (a prompt for claude.ai, and the pasted answer). */
export function registerDiscoverRoutes(api: FastifyInstance, deps: AppDeps) {
  const fetchImpl = deps.fetchImpl ?? fetch;

  const sendError = (err: unknown, reply: FastifyReply) => {
    if (err instanceof TrendingError) return reply.code(err.status).send({ error: err.code, message: err.message });
    if (err instanceof PastedScriptError) return reply.code(400).send({ error: 'invalid_ideas', message: err.message });
    throw err;
  };

  api.get('/discover/trending', async (req, reply) => {
    const q = langSchema.safeParse(req.query);
    if (!q.success) return reply.code(400).send({ error: 'invalid_language', message: firstIssue(q.error) });
    try {
      return await fetchTrending(q.data.lang, fetchImpl);
    } catch (err) {
      return sendError(err, reply);
    }
  });

  // Copy this prompt into claude.ai and paste the answer back.
  api.get('/discover/prompt', async (req, reply) => {
    const q = langSchema.safeParse(req.query);
    if (!q.success) return reply.code(400).send({ error: 'invalid_language', message: firstIssue(q.error) });
    try {
      return { prompt: trendingPrompt(await fetchTrending(q.data.lang, fetchImpl)) };
    } catch (err) {
      return sendError(err, reply);
    }
  });

  api.post('/discover/import', async (req, reply) => {
    const body = importSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_ideas', message: firstIssue(body.error) });
    try {
      return { ideas: parseIdeas(body.data.text) };
    } catch (err) {
      return sendError(err, reply);
    }
  });
}
