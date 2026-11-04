import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Project } from '@motionmind/shared';
import type { AppDeps } from '../app';
import { voicePath } from '../voice/audioStore';

/** The reel as the engine renders it (same rules as the web app's specFromScript). */
export async function reelSpecFor(deps: AppDeps, userId: string, project: Project) {
  const script = project.script!;
  const profile = await deps.data.getProfile(userId);
  const name = profile?.channelName?.trim() || 'Motion Mind';
  const initials = name.split(/\s+/).map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase() || 'MM';
  const spec: Record<string, unknown> = {
    title: script.title,
    // Same rule as the web app's worldFor().
    world: script.world === 'train' ? 'train' : script.world === 'iso' || script.beats.some((b) => b.scene?.props.length) ? 'iso' : 'cards',
    steps: script.steps,
    brand: { name, initials, handle: profile?.handle ? `@${profile.handle}` : '@motionmind', tagline: '' },
    beats: script.beats,
  };
  const voice = project.voice;
  const matches = voice && JSON.stringify(voice.narrations) === JSON.stringify(script.beats.map((b) => b.narration));
  if (voice && matches) {
    spec.voice = voice.beats;
    spec.audioUrls = await deps.audio.urls(voice.beats.map((_, i) => voicePath(userId, project.id, i)));
  }
  return { spec, withVoice: Boolean(spec.audioUrls) };
}

/** Signed-in: start and follow an MP4 export. Public: download a finished file by its unguessable name. */
export function registerExportRoutes(api: FastifyInstance, deps: AppDeps) {
  const unavailable = {
    error: 'export_unavailable',
    message: 'MP4 export runs on your PC for now: start Motion Mind with npm run dev and export from there.',
  };
  const projectFor = async (userId: string, id: string) => (z.string().uuid().safeParse(id).success ? deps.data.getProject(userId, id) : null);

  api.post('/projects/:id/export', async (req, reply) => {
    if (!deps.renderer) return reply.code(501).send(unavailable);
    const project = await projectFor(req.userId, (req.params as { id: string }).id);
    if (!project) return reply.code(404).send({ error: 'not_found', message: 'Project not found.' });
    if (!project.script?.beats.length) return reply.code(400).send({ error: 'no_script', message: 'Write the script first.' });
    const { spec, withVoice } = await reelSpecFor(deps, req.userId, project);
    const job = deps.renderer.start(req.userId, project.id, spec);
    req.log.info({ projectId: project.id, jobId: job.id, withVoice }, 'export started');
    return { job, withVoice };
  });

  api.get('/projects/:id/export', async (req, reply) => {
    if (!deps.renderer) return { available: false, job: null };
    const project = await projectFor(req.userId, (req.params as { id: string }).id);
    if (!project) return reply.code(404).send({ error: 'not_found', message: 'Project not found.' });
    return { available: true, job: deps.renderer.latest(req.userId, project.id) };
  });
}

export function registerRenderDownload(app: FastifyInstance, deps: AppDeps) {
  // Links go straight to the video tag and the download button, which can't send a sign-in header.
  // File names are random UUIDs, so they can't be guessed.
  app.get('/api/renders/:file', async (req, reply) => {
    const file = (req.params as { file: string }).file;
    const full = deps.renderer?.filePath(file);
    if (!full) return reply.code(404).send({ error: 'not_found', message: 'That video is not available.' });
    const info = await stat(full).catch(() => null);
    if (!info) return reply.code(404).send({ error: 'not_found', message: 'That video is not available.' });
    reply.header('Content-Type', 'video/mp4').header('Content-Length', info.size).header('Content-Disposition', `inline; filename="motion-mind-reel.mp4"`);
    return reply.send(createReadStream(full));
  });
}
