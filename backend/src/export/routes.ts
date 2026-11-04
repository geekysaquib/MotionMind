import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { PLATFORM_IDS, editorSpecParts, reelWorld, type Platform, type Project } from '@motionmind/shared';
import type { AppDeps } from '../app';
import { voicePath } from '../voice/audioStore';

/** The reel as the engine renders it (same rules as the web app's specFromScript). */
export async function reelSpecFor(deps: AppDeps, userId: string, project: Project, platform?: Platform, origin?: string) {
  const script = project.script!;
  const profile = await deps.data.getProfile(userId);
  const name = profile?.channelName?.trim() || 'Motion Mind';
  const initials = name.split(/\s+/).map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase() || 'MM';
  const spec: Record<string, unknown> = {
    title: script.title,
    // Same rule as the web app's worldFor().
    world: reelWorld(script),
    theme: script.theme,
    layout: script.layout,
    steps: script.steps,
    brand: { name, initials, handle: profile?.handle ? `@${profile.handle}` : '@motionmind', tagline: '' },
    beats: script.beats,
    glossary: script.glossary,
    brands: script.brands,
    // The renderer's browser loads company logos from this API.
    ...(origin ? { logoBase: origin } : {}),
    ...(platform ? { platform } : {}),
  };
  // The Reel editor: uploaded voice, music, pace and caption style.
  const editor = project.editor;
  const sfxPaths = (editor?.sfx ?? []).map((c) => c.track.path);
  const paths = [editor?.upload?.track.path, editor?.music?.track.path, ...sfxPaths].filter((p): p is string => Boolean(p));
  const urls = paths.length ? await deps.audio.urls(paths) : [];
  const parts = editorSpecParts(editor, script.beats.length, {
    voice: editor?.upload ? urls[paths.indexOf(editor.upload.track.path)] || undefined : undefined,
    music: editor?.music ? urls[paths.indexOf(editor.music.track.path)] || undefined : undefined,
    sfx: Object.fromEntries(sfxPaths.flatMap((p) => (urls[paths.indexOf(p)] ? [[p, urls[paths.indexOf(p)]!]] : []))),
  });
  Object.assign(spec, parts);

  // ElevenLabs voice is used only when no uploaded recording drives the reel.
  const voice = project.voice;
  const matches = voice && JSON.stringify(voice.narrations) === JSON.stringify(script.beats.map((b) => b.narration));
  if (!parts.voiceTrack && voice && matches && editor?.voiceSource !== 'upload') {
    spec.voice = voice.beats;
    spec.audioUrls = await deps.audio.urls(voice.beats.map((_, i) => voicePath(userId, project.id, i)));
  }
  return { spec, withVoice: Boolean(spec.audioUrls || parts.voiceTrack) };
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
    // One platform per call; without one, the project's first. The web app starts each chosen platform in turn.
    const asked = z.object({ platform: z.enum(PLATFORM_IDS).optional() }).safeParse(req.body ?? {});
    if (!asked.success) return reply.code(400).send({ error: 'invalid_platform', message: 'Pick Instagram or YouTube Shorts.' });
    const platform = asked.data.platform ?? project.platforms[0] ?? 'instagram';
    if (!project.platforms.includes(platform)) return reply.code(400).send({ error: 'invalid_platform', message: 'This reel is not set up for that platform. Add it on the Topic page first.' });
    const { spec, withVoice } = await reelSpecFor(deps, req.userId, project, platform, `${req.protocol}://${req.headers.host}`);
    const job = deps.renderer.start(req.userId, project.id, spec, platform);
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
