import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { PLATFORM_IDS, type Platform, type Project, type ReelPost } from '@motionmind/shared';
import type { AppDeps } from '../app';
import { firstIssue } from '../http';
import { noteOf, withNote } from '../ai/promptNote';
import { parsePost, PostError, postPrompt } from './post';

/** Signed-in only: captions and hashtags for posting the reel, by copy and paste through claude.ai. */
/** The saved post, by platform. One saved before posts were split by platform is dropped. */
function postOf(raw: unknown): ReelPost {
  const r = (raw ?? {}) as ReelPost;
  return { ...(r.instagram ? { instagram: r.instagram } : {}), ...(r.youtube ? { youtube: r.youtube } : {}) };
}

export function registerPostRoutes(api: FastifyInstance, deps: AppDeps) {
  async function owned(userId: string, id: string): Promise<Project | null> {
    return z.string().uuid().safeParse(id).success ? deps.data.getProject(userId, id) : null;
  }

  /** The platform asked for; it must be one the reel is made for. Without one, the reel's first. */
  function platformOf(project: Project, raw: unknown): Platform | null {
    const list = project.platforms.length ? project.platforms : (['instagram'] as Platform[]);
    if (raw === undefined || raw === null || raw === '') return list[0]!;
    const p = z.enum(PLATFORM_IDS).safeParse(raw);
    return p.success && list.includes(p.data) ? p.data : null;
  }
  const wrongPlatform = { error: 'invalid_platform', message: 'This reel is not set up for that platform. Add it on the Topic page first.' };

  api.get('/projects/:id/post/prompt', async (req, reply) => {
    const project = await owned(req.userId, (req.params as { id: string }).id);
    if (!project) return reply.code(404).send({ error: 'not_found', message: 'Project not found.' });
    if (!project.script?.beats.length) return reply.code(400).send({ error: 'no_script', message: 'Write the script first.' });
    const platform = platformOf(project, (req.query as { platform?: unknown }).platform);
    if (!platform) return reply.code(400).send(wrongPlatform);
    const profile = await deps.data.getProfile(req.userId);
    const prompt = postPrompt({
      script: project.script,
      topic: project.topic,
      platform,
      language: profile?.language ?? 'hinglish',
      handle: profile?.handle ? `@${profile.handle}` : '@motionmind',
    });
    return { prompt: withNote(prompt, noteOf(req.query)), platform };
  });

  api.post('/projects/:id/post/import', async (req, reply) => {
    const body = z.object({ text: z.string().min(1, "Paste Claude's answer first.").max(60_000), platform: z.string().optional() }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_post', message: firstIssue(body.error) });
    const project = await owned(req.userId, (req.params as { id: string }).id);
    if (!project) return reply.code(404).send({ error: 'not_found', message: 'Project not found.' });
    if (!project.script?.beats.length) return reply.code(400).send({ error: 'no_script', message: 'Write the script first.' });
    const platform = platformOf(project, body.data.platform);
    if (!platform) return reply.code(400).send(wrongPlatform);
    try {
      const post = { ...postOf(project.script.post), [platform]: parsePost(body.data.text, platform) };
      return { project: await deps.data.updateProject(req.userId, project.id, { script: { ...project.script, post } }) };
    } catch (err) {
      if (err instanceof PostError) return reply.code(400).send({ error: 'invalid_post', message: err.message });
      throw err;
    }
  });
}
