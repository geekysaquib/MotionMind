import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import type { AppDeps } from '../app';
import { ClaudeError, claudeClient, type ClaudeClient } from '../ai/claude';
import { PastedScriptError } from '../ai/reelPrompt';
import { firstIssue } from '../http';
import { parseIdeas, trendingPrompt } from './ideas';
import { fetchTrending, TrendingError } from './trending';

const langSchema = z.object({ lang: z.enum(['en', 'hi']).default('en') });
const importSchema = z.object({ text: z.string().min(1, "Paste Claude's answer first.").max(100_000) });

/** Signed-in only: what is trending on Wikipedia, and reel ideas made from it (by Claude, on the server's key or pasted from claude.ai). */
export function registerDiscoverRoutes(api: FastifyInstance, deps: AppDeps) {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const makeClient = deps.claude ?? ((key: string) => claudeClient(key, deps.fetchImpl));
  let client: ClaudeClient | null = null;

  const sendError = (err: unknown, reply: FastifyReply) => {
    if (err instanceof TrendingError) return reply.code(err.status).send({ error: err.code, message: err.message });
    if (err instanceof ClaudeError) return reply.code(err.status).send({ error: err.code, message: err.message });
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

  // Option 1: copy this prompt into claude.ai and paste the answer back.
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

  // Option 2: Claude does it on the server's key.
  api.post('/discover/ideas', async (req, reply) => {
    const q = langSchema.safeParse(req.body ?? {});
    if (!q.success) return reply.code(400).send({ error: 'invalid_language', message: firstIssue(q.error) });
    if (!deps.anthropicApiKey) return reply.code(503).send({ error: 'claude_not_configured', message: "Claude isn't set up on the server yet (ANTHROPIC_API_KEY)." });
    client ??= makeClient(deps.anthropicApiKey);
    try {
      const trending = await fetchTrending(q.data.lang, fetchImpl);
      const res = await client.ask(trendingPrompt(trending));
      return { date: trending.date, ideas: parseIdeas(res.text) };
    } catch (err) {
      return sendError(err, reply);
    }
  });
}
