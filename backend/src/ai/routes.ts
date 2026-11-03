import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import type { ReelScript } from '@motionmind/shared';
import type { AppDeps } from '../app';
import { firstIssue } from '../http';
import { ClaudeError, claudeClient, CLAUDE_MODEL, type ClaudeClient } from './claude';

const askSchema = z.object({ prompt: z.string().trim().min(1, 'Ask Claude something.').max(4000) });

/** Signed-in only: Claude, using the caller's own Anthropic key from Settings. */
export function registerClaudeRoutes(api: FastifyInstance, deps: AppDeps) {
  const makeClient = deps.claude ?? ((key: string) => claudeClient(key, deps.fetchImpl));

  async function clientFor(userId: string, reply: FastifyReply): Promise<ClaudeClient | null> {
    const row = await deps.keys.get(userId, 'anthropic');
    if (!row) {
      reply.code(409).send({ error: 'claude_not_connected', message: 'Connect Claude first: add your Anthropic API key in Settings > Claude.' });
      return null;
    }
    return makeClient(deps.cipher.open(row, `${userId}:anthropic`));
  }

  const sendClaudeError = (err: unknown, reply: FastifyReply) => {
    if (err instanceof ClaudeError) return reply.code(err.status).send({ error: err.code, message: err.message });
    throw err;
  };

  api.get('/claude/status', async (req) => {
    const row = await deps.keys.get(req.userId, 'anthropic');
    return { connected: Boolean(row), model: CLAUDE_MODEL, last4: row?.last4 ?? null, working: row?.lastTestOk ?? null };
  });

  api.post('/claude/ask', async (req, reply) => {
    const body = askSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_prompt', message: firstIssue(body.error) });
    const claude = await clientFor(req.userId, reply);
    if (!claude) return reply;
    try {
      const started = Date.now();
      const res = await claude.ask(body.data.prompt);
      await deps.keys.markTested(req.userId, 'anthropic', true);
      return { reply: res, ms: Date.now() - started };
    } catch (err) {
      if (err instanceof ClaudeError && err.code === 'claude_key_rejected') await deps.keys.markTested(req.userId, 'anthropic', false);
      return sendClaudeError(err, reply);
    }
  });

  api.post('/projects/:id/script', async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const project = z.string().uuid().safeParse(id).success ? await deps.data.getProject(req.userId, id) : null;
    if (!project) return reply.code(404).send({ error: 'not_found', message: 'Project not found.' });
    if (!project.topic) return reply.code(400).send({ error: 'no_topic', message: 'Give the project a topic first.' });
    const claude = await clientFor(req.userId, reply);
    if (!claude) return reply;
    const profile = await deps.data.getProfile(req.userId);
    try {
      const { script, model } = await claude.writeReel({
        topic: project.topic,
        durationSec: project.durationSec,
        language: profile?.language ?? 'hinglish',
        niche: profile?.niche ?? null,
        channelName: profile?.channelName ?? null,
      });
      const saved: ReelScript = { ...script, model, writtenAt: new Date().toISOString() };
      const updated = await deps.data.updateProject(req.userId, project.id, {
        script: saved,
        stage: 'script',
        status: project.status === 'draft' ? 'in_progress' : project.status,
      });
      return { project: updated };
    } catch (err) {
      return sendClaudeError(err, reply);
    }
  });
}
