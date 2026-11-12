import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { PLATFORM_IDS, reelTimeline, type Platform, type Project } from '@motionmind/shared';
import type { AppDeps } from '../app';
import type { AudioClip, HtmlRenderInput } from './hyperframes';
import { finishedAnimation } from '../animation/endCard';

/**
 * What the renderer needs for a project: Claude's composition, its length, and the audio to lay under it
 * (the user's own recording, and the music).
 */
export async function htmlRenderFor(deps: AppDeps, project: Project): Promise<{ input: HtmlRenderInput; withVoice: boolean }> {
  const script = project.script!;
  const timeline = reelTimeline(script, project.editor);
  const editor = project.editor;
  const audio: AudioClip[] = [];
  if (timeline.source === 'recording' && editor?.upload) {
    const [url] = await deps.audio.urls([editor.upload.track.path]);
    const up = editor.upload;
    if (url) audio.push({ url, at: 0, from: up.trimStart ?? 0, to: up.trimEnd ?? up.track.durationSec });
  }
  if (editor?.music) {
    const [url] = await deps.audio.urls([editor.music.track.path]);
    if (url) audio.push({ url, at: 0, volume: editor.music.volume, loop: true });
  }
  const withVoice = audio.some((c) => !c.loop);
  const html = finishedAnimation(project, await deps.data.getProfile(project.ownerId));
  return { input: { html, duration: timeline.duration, audio }, withVoice };
}

/** Signed-in: start and follow an MP4 export. Public: download a finished file by its unguessable name. */
export function registerExportRoutes(api: FastifyInstance, deps: AppDeps) {
  const unavailable = {
    error: 'export_unavailable',
    message: 'MP4 export runs on your PC: start Motion Mind with npm run dev and export from there.',
  };
  const projectFor = async (userId: string, id: string) => (z.string().uuid().safeParse(id).success ? deps.data.getProject(userId, id) : null);

  api.post('/projects/:id/export', async (req, reply) => {
    if (!deps.renderer) return reply.code(501).send(unavailable);
    const project = await projectFor(req.userId, (req.params as { id: string }).id);
    if (!project) return reply.code(404).send({ error: 'not_found', message: 'Project not found.' });
    if (!project.script?.beats.length) return reply.code(400).send({ error: 'no_script', message: 'Write the script first.' });
    if (!project.script.animation) return reply.code(400).send({ error: 'no_animation', message: 'Make the animation first, on the Animate step.' });
    // One platform per call; without one, the project's first. The web app starts each chosen platform in turn.
    const asked = z.object({ platform: z.enum(PLATFORM_IDS).optional() }).safeParse(req.body ?? {});
    if (!asked.success) return reply.code(400).send({ error: 'invalid_platform', message: 'Pick Instagram or YouTube Shorts.' });
    const platform = asked.data.platform ?? project.platforms[0] ?? 'instagram';
    if (!project.platforms.includes(platform)) return reply.code(400).send({ error: 'invalid_platform', message: 'This reel is not set up for that platform. Add it on the Topic page first.' });
    const { input, withVoice } = await htmlRenderFor(deps, project);
    const job = deps.renderer.start(req.userId, project.id, input, platform);
    req.log.info({ projectId: project.id, jobId: job.id, withVoice, platform }, 'export started');
    return { job, withVoice, platform };
  });

  api.get('/projects/:id/export', async (req, reply) => {
    if (!deps.renderer) return { available: false, job: null };
    const project = await projectFor(req.userId, (req.params as { id: string }).id);
    if (!project) return reply.code(404).send({ error: 'not_found', message: 'Project not found.' });
    // `jobs` has the latest export for each platform; `job` stays as the first platform's, for older callers.
    const jobs = Object.fromEntries(PLATFORM_IDS.map((p) => [p, deps.renderer!.latest(req.userId, project.id, p)])) as Record<Platform, ReturnType<typeof deps.renderer.latest>>;
    return { available: true, job: jobs[project.platforms[0] ?? 'instagram'], jobs };
  });
}

export function registerRenderDownload(app: FastifyInstance, deps: AppDeps) {
  // Links go straight to the video tag and the download button, which can't send a sign-in header.
  // File names are random UUIDs, so they can't be guessed.
  app.get('/api/renders/:file', async (req, reply) => {
    const file = (req.params as { file: string }).file;
    const full = deps.renderer?.filePath(file);
    if (!full) return reply.code(404).send({ error: 'not_found', message: 'That file is not available.' });
    const info = await stat(full).catch(() => null);
    if (!info) return reply.code(404).send({ error: 'not_found', message: 'That file is not available.' });
    const kind = file.endsWith('.png') ? { type: 'image/png', name: 'motion-mind-cover.png' } : file.endsWith('.jpg') ? { type: 'image/jpeg', name: 'motion-mind-cover.jpg' } : { type: 'video/mp4', name: 'motion-mind-reel.mp4' };
    // A link with ?name= saves under that name (the web app sends the reel's title and platform); otherwise the file shows inline.
    const asked = (req.query as { name?: string }).name;
    const safe = typeof asked === 'string' ? asked.replace(/[^\p{L}\p{N}._-]+/gu, '-').replace(/^[-.]+/, '').slice(0, 120) : '';
    const disposition = safe && /\.(mp4|png|jpg)$/.test(safe) ? `attachment; filename="${safe.replace(/[^ -~]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(safe)}` : `inline; filename="${kind.name}"`;
    reply.header('Content-Type', kind.type).header('Content-Length', info.size).header('Content-Disposition', disposition);
    return reply.send(createReadStream(full));
  });
}
