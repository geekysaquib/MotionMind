import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { AppDeps } from '../app';
import { firstIssue } from '../http';
import { ClaudeError, claudeClient, CLAUDE_MODEL, type ClaudeClient } from './claude';
import { manualReelPrompt, parsePastedScript, PastedScriptError, type ReelBrief } from './reelPrompt';
import type { Project, ReelScript } from '@motionmind/shared';

const askSchema = z.object({ prompt: z.string().trim().min(1, 'Ask Claude something.').max(4000) });
const importSchema = z.object({ text: z.string().min(1, "Paste Claude's answer first.").max(100_000) });

/** Model label for scripts written in claude.ai and pasted in. */
export const PASTED_MODEL = 'claude.ai (pasted)';

/** Signed-in only: Claude, on the server's own Anthropic key. Users never set up keys. */
export function registerClaudeRoutes(api: FastifyInstance, deps: AppDeps) {
  const makeClient = deps.claude ?? ((key: string) => claudeClient(key, deps.fetchImpl));
  let client: ClaudeClient | null = null;

  function claudeOr503(reply: FastifyReply): ClaudeClient | null {
    if (!deps.anthropicApiKey) {
      reply.code(503).send({ error: 'claude_not_configured', message: "Claude isn't set up on the server yet (ANTHROPIC_API_KEY)." });
      return null;
    }
    client ??= makeClient(deps.anthropicApiKey);
    return client;
  }

  const sendClaudeError = (err: unknown, reply: FastifyReply) => {
    if (err instanceof ClaudeError) return reply.code(err.status).send({ error: err.code, message: err.message });
    throw err;
  };

  api.get('/claude/status', async () => ({ connected: Boolean(deps.anthropicApiKey), model: CLAUDE_MODEL }));

  api.post('/claude/ask', async (req, reply) => {
    const body = askSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_prompt', message: firstIssue(body.error) });
    const claude = claudeOr503(reply);
    if (!claude) return reply;
    try {
      const started = Date.now();
      const res = await claude.ask(body.data.prompt);
      return { reply: res, ms: Date.now() - started };
    } catch (err) {
      return sendClaudeError(err, reply);
    }
  });

  async function projectFor(req: FastifyRequest, reply: FastifyReply): Promise<Project | null> {
    const id = (req.params as { id: string }).id;
    const project = z.string().uuid().safeParse(id).success ? await deps.data.getProject(req.userId, id) : null;
    if (!project) {
      reply.code(404).send({ error: 'not_found', message: 'Project not found.' });
      return null;
    }
    if (!project.topic) {
      reply.code(400).send({ error: 'no_topic', message: 'Give the project a topic first.' });
      return null;
    }
    return project;
  }

  async function briefFor(userId: string, project: Project): Promise<ReelBrief> {
    const profile = await deps.data.getProfile(userId);
    return {
      topic: project.topic!,
      durationSec: project.durationSec,
      language: profile?.language ?? 'hinglish',
      niche: profile?.niche ?? null,
      channelName: profile?.channelName ?? null,
    };
  }

  function saveScript(userId: string, project: Project, script: Omit<ReelScript, 'model' | 'writtenAt'>, model: string) {
    const saved: ReelScript = { ...script, model, writtenAt: new Date().toISOString() };
    return deps.data.updateProject(userId, project.id, {
      script: saved,
      stage: 'script',
      status: project.status === 'draft' ? 'in_progress' : project.status,
    });
  }

  // Option 1: the server calls Claude with its API key.
  api.post('/projects/:id/script', async (req, reply) => {
    const project = await projectFor(req, reply);
    if (!project) return reply;
    const claude = claudeOr503(reply);
    if (!claude) return reply;
    try {
      const { script, model } = await claude.writeReel(await briefFor(req.userId, project));
      return { project: await saveScript(req.userId, project, script, model) };
    } catch (err) {
      return sendClaudeError(err, reply);
    }
  });

  // Option 2: no API key needed. The user runs this prompt in claude.ai and pastes the answer back.
  api.get('/projects/:id/script/prompt', async (req, reply) => {
    const project = await projectFor(req, reply);
    if (!project) return reply;
    return { prompt: manualReelPrompt(await briefFor(req.userId, project)) };
  });

  api.post('/projects/:id/script/import', async (req, reply) => {
    const body = importSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_script', message: firstIssue(body.error) });
    const project = await projectFor(req, reply);
    if (!project) return reply;
    try {
      const script = parsePastedScript(body.data.text);
      return { project: await saveScript(req.userId, project, script, PASTED_MODEL) };
    } catch (err) {
      if (err instanceof PastedScriptError) return reply.code(400).send({ error: 'invalid_script', message: err.message });
      throw err;
    }
  });
}
