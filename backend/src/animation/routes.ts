import { createReadStream } from 'node:fs';
import { noteOf, withNote } from '../ai/promptNote';
import { createRequire } from 'node:module';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AnimationError, extractAnimation, reelTimeline, timingKey, type Project, type ReelAnimation } from '@motionmind/shared';
import type { AppDeps } from '../app';
import { firstIssue } from '../http';
import { animationPrompt } from '../ai/animationPrompt';
import { layoutFixRequest } from './layout';

/** The API's own address, where the composition loads company logos from (in the preview and in the render). */
export const apiOrigin = () => `http://localhost:${process.env.PORT ?? 8787}`;

/**
 * Signed-in only: the Animate step. Claude (in claude.ai) writes the reel as one HyperFrames composition from a
 * prompt with the script, the exact scene and word timings and the style's rulebook; the user pastes it back.
 */
export function registerAnimationRoutes(api: FastifyInstance, deps: AppDeps) {
  async function owned(userId: string, id: string): Promise<Project | null> {
    return z.string().uuid().safeParse(id).success ? deps.data.getProject(userId, id) : null;
  }

  const timelineOf = (p: Project) => reelTimeline(p.script!, p.editor);

  api.get('/projects/:id/animation', async (req, reply) => {
    const project = await owned(req.userId, (req.params as { id: string }).id);
    if (!project) return reply.code(404).send({ error: 'not_found', message: 'Project not found.' });
    if (!project.script?.beats.length) return { animation: null, timeline: null, stale: false };
    const timeline = timelineOf(project);
    const animation = project.script.animation ?? null;
    return { animation, timeline, stale: Boolean(animation && animation.timingKey !== timingKey(timeline)) };
  });

  api.get('/projects/:id/animation/prompt', async (req, reply) => {
    const project = await owned(req.userId, (req.params as { id: string }).id);
    if (!project) return reply.code(404).send({ error: 'not_found', message: 'Project not found.' });
    if (!project.script?.beats.length) return reply.code(400).send({ error: 'no_script', message: 'Write the script first.' });
    const profile = await deps.data.getProfile(req.userId);
    const timeline = timelineOf(project);
    const both = project.platforms.length > 1;
    const prompt = animationPrompt({
      script: project.script,
      timeline,
      style: project.script.style,
      channelName: profile?.channelName?.trim() || 'Motion Mind',
      handle: profile?.handle ? `@${profile.handle}` : '@motionmind',
      language: profile?.language ?? 'hinglish',
      logoBase: apiOrigin(),
      platform: both ? 'both' : project.platforms[0] ?? 'instagram',
    });
    return { prompt: withNote(prompt, noteOf(req.query)), timeline };
  });

  // Opens the saved animation in headless Chrome and looks for text that overlaps, is hidden or spills out.
  api.post('/projects/:id/animation/check', async (req, reply) => {
    if (!deps.layoutChecker) return reply.code(501).send({ error: 'check_unavailable', message: 'The layout check runs on your PC: start Motion Mind with npm run dev.' });
    const project = await owned(req.userId, (req.params as { id: string }).id);
    if (!project) return reply.code(404).send({ error: 'not_found', message: 'Project not found.' });
    const animation = project.script?.animation;
    if (!animation) return reply.code(400).send({ error: 'no_animation', message: 'Paste the animation first.' });
    try {
      const report = await deps.layoutChecker(animation.html, timelineOf(project).duration);
      req.log.info({ projectId: project.id, issues: report.total }, 'layout checked');
      return { report, request: report.ok ? null : layoutFixRequest(report) };
    } catch (err) {
      req.log.error({ err }, 'layout check failed');
      return reply.code(500).send({ error: 'check_failed', message: `The layout check could not run: ${err instanceof Error ? err.message.split('\n')[0] : 'unknown error'}` });
    }
  });

  api.post('/projects/:id/animation/import', async (req, reply) => {
    const body = z.object({ text: z.string().min(1, "Paste Claude's answer first.").max(2_000_000) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_animation', message: firstIssue(body.error) });
    const project = await owned(req.userId, (req.params as { id: string }).id);
    if (!project) return reply.code(404).send({ error: 'not_found', message: 'Project not found.' });
    if (!project.script?.beats.length) return reply.code(400).send({ error: 'no_script', message: 'Write the script first.' });
    let html: string;
    try {
      html = extractAnimation(body.data.text);
    } catch (err) {
      if (err instanceof AnimationError) return reply.code(400).send({ error: 'invalid_animation', message: err.message });
      throw err;
    }
    const animation: ReelAnimation = { html, style: project.script.style, timingKey: timingKey(timelineOf(project)), writtenAt: new Date().toISOString() };
    req.log.info({ projectId: project.id, bytes: html.length }, 'animation imported');
    return { project: await deps.data.updateProject(req.userId, project.id, { script: { ...project.script, animation } }) };
  });
}

/** Public: the GSAP build the animations use, served from this app (the preview frame and the renderer load it locally). */
export function registerAnimationAssets(app: FastifyInstance) {
  const file = createRequire(import.meta.url).resolve('gsap/dist/gsap.min.js');
  app.get('/api/static/gsap.min.js', async (_req, reply) => {
    reply.header('Content-Type', 'text/javascript; charset=utf-8').header('Cache-Control', 'public, max-age=86400');
    return reply.send(createReadStream(file));
  });
}
