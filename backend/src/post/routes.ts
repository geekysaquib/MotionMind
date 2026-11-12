import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Project } from '@motionmind/shared';
import type { AppDeps } from '../app';
import { firstIssue } from '../http';
import { noteOf, withNote } from '../ai/promptNote';
import { parsePost, PostError, postPrompt } from './post';

/** Signed-in only: captions and hashtags for posting the reel, by copy and paste through claude.ai. */
export function registerPostRoutes(api: FastifyInstance, deps: AppDeps) {
  async function owned(userId: string, id: string): Promise<Project | null> {
    return z.string().uuid().safeParse(id).success ? deps.data.getProject(userId, id) : null;
  }

  api.get('/projects/:id/post/prompt', async (req, reply) => {
    const project = await owned(req.userId, (req.params as { id: string }).id);
    if (!project) return reply.code(404).send({ error: 'not_found', message: 'Project not found.' });
    if (!project.script?.beats.length) return reply.code(400).send({ error: 'no_script', message: 'Write the script first.' });
    const profile = await deps.data.getProfile(req.userId);
    const prompt = postPrompt({
      script: project.script,
      topic: project.topic,
      platforms: project.platforms.length ? project.platforms : ['instagram'],
      language: profile?.language ?? 'hinglish',
      handle: profile?.handle ? `@${profile.handle}` : '@motionmind',
    });
    return { prompt: withNote(prompt, noteOf(req.query)) };
  });

  api.post('/projects/:id/post/import', async (req, reply) => {
    const body = z.object({ text: z.string().min(1, "Paste Claude's answer first.").max(60_000) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_post', message: firstIssue(body.error) });
    const project = await owned(req.userId, (req.params as { id: string }).id);
    if (!project) return reply.code(404).send({ error: 'not_found', message: 'Project not found.' });
    if (!project.script?.beats.length) return reply.code(400).send({ error: 'no_script', message: 'Write the script first.' });
    try {
      const post = parsePost(body.data.text);
      return { project: await deps.data.updateProject(req.userId, project.id, { script: { ...project.script, post } }) };
    } catch (err) {
      if (err instanceof PostError) return reply.code(400).send({ error: 'invalid_post', message: err.message });
      throw err;
    }
  });
}
