import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { reelTimeline, type Project } from '@motionmind/shared';
import type { AppDeps } from '../app';
import { firstIssue } from '../http';

const coverSchema = z.object({ scene: z.number().int().min(0).max(60) }).strict();

const renderSchema = z.object({ cover: coverSchema });

const unavailable = { error: 'export_unavailable', message: 'Making the cover runs on your PC. Open Motion Mind from your computer with npm run dev.' };

/** Signed-in only: the reel's cover image (thumbnail). Settings are saved with the script; the image is rendered on this machine. */
export function registerCoverRoutes(api: FastifyInstance, deps: AppDeps) {
  async function owned(userId: string, id: string): Promise<Project | null> {
    return z.string().uuid().safeParse(id).success ? deps.data.getProject(userId, id) : null;
  }

  // The cover settings live in the script's JSON. Saving them does not count as editing the storyboard.
  api.put('/projects/:id/cover', async (req, reply) => {
    const body = z.object({ cover: coverSchema }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_cover', message: firstIssue(body.error) });
    const project = await owned(req.userId, (req.params as { id: string }).id);
    if (!project) return reply.code(404).send({ error: 'not_found', message: 'Project not found.' });
    if (!project.script?.beats.length) return reply.code(400).send({ error: 'no_script', message: 'Write the script first.' });
    if (body.data.cover.scene >= project.script.beats.length) return reply.code(400).send({ error: 'invalid_cover', message: "That scene doesn't exist." });
    return { project: await deps.data.updateProject(req.userId, project.id, { script: { ...project.script, cover: body.data.cover } }) };
  });

  api.post('/projects/:id/cover/render', async (req, reply) => {
    if (!deps.renderer) return reply.code(501).send(unavailable);
    const body = renderSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_cover', message: firstIssue(body.error) });
    const project = await owned(req.userId, (req.params as { id: string }).id);
    if (!project) return reply.code(404).send({ error: 'not_found', message: 'Project not found.' });
    if (!project.script?.beats.length) return reply.code(400).send({ error: 'no_script', message: 'Write the script first.' });
    if (body.data.cover.scene >= project.script.beats.length) return reply.code(400).send({ error: 'invalid_cover', message: "That scene doesn't exist." });
    if (!project.script.animation) return reply.code(400).send({ error: 'no_animation', message: 'Make the animation first, on the Animate step.' });
    // The cover is a frame of Claude's animation, late in the chosen scene once everything has come in.
    const scene = reelTimeline(project.script, project.editor).scenes[body.data.cover.scene]!;
    try {
      const file = await deps.renderer.still(project.script.animation.html, scene.start + (scene.end - scene.start) * 0.8, project.id);
      req.log.info({ projectId: project.id, file, scene: body.data.cover.scene }, 'cover rendered');
      return { file, url: `/api/renders/${file}` };
    } catch (err) {
      req.log.error({ err }, 'cover render failed');
      return reply.code(500).send({ error: 'cover_failed', message: `The cover could not be made: ${err instanceof Error ? err.message.split('\n')[0] : 'unknown error'}` });
    }
  });
}
