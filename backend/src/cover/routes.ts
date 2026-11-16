import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { MAX_COVER_HEADLINE, PLATFORM_IDS, reelTimeline, styleOf, type CoverSettings, type Project } from '@motionmind/shared';
import { withCoverText } from './overlay';
import { logoDataUrl } from '../profile/logo';
import type { AppDeps } from '../app';
import { firstIssue } from '../http';
import { finishedAnimation } from '../animation/endCard';

// thumbs is set by the server only; a client that sends back what it loaded is not refused for it, but it is ignored.
const coverSchema = z.object({ scene: z.number().int().min(0).max(60), headline: z.string().trim().max(MAX_COVER_HEADLINE).optional(), text: z.boolean().optional(), thumbs: z.unknown().optional() }).strict();

const settingsOf = ({ thumbs: _ignored, ...cover }: z.infer<typeof coverSchema>): CoverSettings => cover;

const renderSchema = z.object({ cover: coverSchema, platform: z.enum(PLATFORM_IDS).optional() });

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
    return { project: await deps.data.updateProject(req.userId, project.id, { script: { ...project.script, cover: { ...settingsOf(body.data.cover), ...(project.script.cover?.thumbs ? { thumbs: project.script.cover.thumbs } : {}) } } }) };
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
    const timeline = reelTimeline(project.script, project.editor);
    const scene = timeline.scenes[body.data.cover.scene]!;
    // The badge says how short the explainer is, rounded to the nearest 5 seconds.
    const kicker = `Explained in ${Math.max(15, Math.round(timeline.storyEnd / 5) * 5)} sec`;
    try {
      const profile = await deps.data.getProfile(req.userId);
      const logo = await logoDataUrl(deps.audio, req.userId);
      let html = finishedAnimation(project, profile, logo);
      // The words on the cover: the reel's title unless the creator wrote their own; none when they turned the text off.
      if (body.data.cover.text !== false) html = withCoverText(html, { headline: body.data.cover.headline?.trim() || project.script.title, handle: profile?.handle ? `@${profile.handle}` : '@motionmind', accent: styleOf(project.script.style).swatch[1], logo, kicker, platform: body.data.platform ?? project.platforms[0] ?? 'instagram' });
      const platform = body.data.platform ?? project.platforms[0] ?? 'instagram';
      const file = await deps.renderer.still(html, scene.start + (scene.end - scene.start) * 0.8, project.id);
      req.log.info({ projectId: project.id, file, scene: body.data.cover.scene }, 'cover rendered');
      // The newest cover per platform becomes the project's thumbnail; the one it replaces is deleted.
      const old = project.script.cover?.thumbs?.[platform];
      const thumbs = { ...project.script.cover?.thumbs, [platform]: file };
      const saved = await deps.data.updateProject(req.userId, project.id, { script: { ...project.script, cover: { ...settingsOf(body.data.cover), thumbs } } });
      if (old && old !== file) await deps.renderer.removeFiles?.([old]).catch((err) => req.log.warn({ err }, 'could not delete the old cover'));
      return { file, url: `/api/renders/${file}`, project: saved };
    } catch (err) {
      req.log.error({ err }, 'cover render failed');
      return reply.code(500).send({ error: 'cover_failed', message: `The cover could not be made: ${err instanceof Error ? err.message.split('\n')[0] : 'unknown error'}` });
    }
  });
}
