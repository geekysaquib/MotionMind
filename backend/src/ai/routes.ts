import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { z as zv4 } from 'zod/v4';
import type { AppDeps } from '../app';
import { firstIssue } from '../http';
import { manualReelPrompt, manualResearchPrompt, parsePastedScript, parseResearch, PastedScriptError, type ReelBrief } from './reelPrompt';
import { reelScriptSchema as scriptSchemaV4, type Research } from './reelSchema';
import { STYLE_IDS, type StyleId, type Project, type ReelScript, type ResearchReport } from '@motionmind/shared';

const editSchema = z.object({ script: z.unknown() });
// The storyboard carries the chosen style and the cover; the schema Claude writes to does not.
// (Same zod version as the script schema, or the two cannot be combined.)
const scriptWithLayout = scriptSchemaV4.extend({
  style: zv4.enum(STYLE_IDS).optional(),
  animation: zv4.object({ html: zv4.string().max(2_000_000), style: zv4.enum(STYLE_IDS).optional(), timingKey: zv4.string().max(4000), writtenAt: zv4.string() }).optional(),
  cover: zv4.object({ scene: zv4.number().int().min(0).max(60) }).optional(),
});
const importSchema = z.object({ text: z.string().min(1, "Paste Claude's answer first.").max(100_000), style: z.enum(STYLE_IDS).optional() });
/** The style picked before the script: the prompt designs every scene for it, and the script is saved with it. */
const styleOf = (v: unknown) => {
  const r = z.enum(STYLE_IDS).safeParse(v);
  return r.success ? r.data : undefined;
};

/** Model label for scripts written in claude.ai and pasted in. */
export const PASTED_MODEL = 'claude.ai (pasted)';

/** Signed-in only: research, script and style, all through copy and paste with claude.ai. */
export function registerClaudeRoutes(api: FastifyInstance, deps: AppDeps) {
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

  async function briefFor(userId: string, project: Project, style?: StyleId): Promise<ReelBrief> {
    const profile = await deps.data.getProfile(userId);
    return {
      topic: project.topic!,
      durationSec: project.durationSec,
      language: profile?.language ?? 'hinglish',
      niche: profile?.niche ?? null,
      channelName: profile?.channelName ?? null,
      // Only research the user approved feeds the script.
      research: project.research?.approvedAt ? project.research : null,
      style: style ?? project.script?.style ?? null,
    };
  }

  function saveScript(userId: string, project: Project, script: Omit<ReelScript, 'model' | 'writtenAt'>, model: string, style?: StyleId) {
    // The script is saved with the style it was designed for (or keeps the one already picked).
    const chosen = style ?? project.script?.style;
    const saved: ReelScript = { ...script, ...(chosen ? { style: chosen } : {}), model, writtenAt: new Date().toISOString() };
    return deps.data.updateProject(userId, project.id, {
      script: saved,
      stage: 'script',
      status: project.status === 'draft' ? 'in_progress' : project.status,
    });
  }

  function saveResearch(userId: string, project: Project, research: Research, model: string) {
    const saved: ResearchReport = { ...research, approvedAt: null, model, writtenAt: new Date().toISOString() };
    return deps.data.updateProject(userId, project.id, {
      research: saved,
      stage: project.stage === 'topic' ? 'research' : project.stage,
      status: project.status === 'draft' ? 'in_progress' : project.status,
    });
  }

  // ---------- Research ----------
  // Run the prompt in claude.ai (with web search on) and paste the answer back.
  api.get('/projects/:id/research/prompt', async (req, reply) => {
    const project = await projectFor(req, reply);
    if (!project) return reply;
    return { prompt: manualResearchPrompt({ topic: project.topic! }) };
  });

  api.post('/projects/:id/research/import', async (req, reply) => {
    const body = importSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_research', message: firstIssue(body.error) });
    const project = await projectFor(req, reply);
    if (!project) return reply;
    try {
      return { project: await saveResearch(req.userId, project, parseResearch(body.data.text), PASTED_MODEL) };
    } catch (err) {
      if (err instanceof PastedScriptError) return reply.code(400).send({ error: 'invalid_research', message: err.message });
      throw err;
    }
  });

  api.post('/projects/:id/research/approve', async (req, reply) => {
    const project = await projectFor(req, reply);
    if (!project) return reply;
    if (!project.research) return reply.code(400).send({ error: 'no_research', message: 'Research the topic first.' });
    const updated = await deps.data.updateProject(req.userId, project.id, { research: { ...project.research, approvedAt: new Date().toISOString() } });
    return { project: updated };
  });

  // ---------- Script ----------
  // The user runs this prompt in claude.ai and pastes the answer back.
  api.get('/projects/:id/script/prompt', async (req, reply) => {
    const project = await projectFor(req, reply);
    if (!project) return reply;
    return { prompt: manualReelPrompt(await briefFor(req.userId, project, styleOf((req.query as { style?: unknown }).style))) };
  });

  api.post('/projects/:id/script/import', async (req, reply) => {
    const body = importSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_script', message: firstIssue(body.error) });
    const project = await projectFor(req, reply);
    if (!project) return reply;
    try {
      const script = parsePastedScript(body.data.text);
      return { project: await saveScript(req.userId, project, script, PASTED_MODEL, body.data.style) };
    } catch (err) {
      if (err instanceof PastedScriptError) return reply.code(400).send({ error: 'invalid_script', message: err.message });
      throw err;
    }
  });

  // ---------- Storyboard ----------
  // The user edits the script beat by beat; we keep who wrote it and mark it edited.
  api.put('/projects/:id/script', async (req, reply) => {
    const body = editSchema.safeParse(req.body);
    const parsed = scriptWithLayout.safeParse(body.success ? body.data.script : undefined);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return reply.code(400).send({ error: 'invalid_script', message: `The storyboard has a problem${issue ? ` (${issue.path.join('.')}: ${issue.message})` : ''}.` });
    }
    if (parsed.data.beats.length === 0) return reply.code(400).send({ error: 'invalid_script', message: 'Keep at least one beat.' });
    const id = (req.params as { id: string }).id;
    const project = z.string().uuid().safeParse(id).success ? await deps.data.getProject(req.userId, id) : null;
    if (!project) return reply.code(404).send({ error: 'not_found', message: 'Project not found.' });
    const saved: ReelScript = { ...parsed.data, cover: parsed.data.cover as ReelScript['cover'], style: parsed.data.style, animation: parsed.data.animation, model: project.script?.model, writtenAt: project.script?.writtenAt, editedAt: new Date().toISOString() };
    return {
      project: await deps.data.updateProject(req.userId, project.id, { script: saved, stage: project.stage === 'script' ? 'storyboard' : project.stage }),
    };
  });

  // ---------- Style ----------
  // The look the reel is drawn in. Saved in the script; it does not count as editing the storyboard.
  api.put('/projects/:id/style', async (req, reply) => {
    const body = z.object({ style: z.enum(STYLE_IDS) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_style', message: 'Pick one of the styles.' });
    const id = (req.params as { id: string }).id;
    const project = z.string().uuid().safeParse(id).success ? await deps.data.getProject(req.userId, id) : null;
    if (!project) return reply.code(404).send({ error: 'not_found', message: 'Project not found.' });
    if (!project.script?.beats.length) return reply.code(400).send({ error: 'no_script', message: 'Write the script first.' });
    const stage = ['topic', 'research'].includes(project.stage) ? 'graphics' : project.stage;
    return { project: await deps.data.updateProject(req.userId, project.id, { script: { ...project.script, style: body.data.style }, stage }) };
  });
}
