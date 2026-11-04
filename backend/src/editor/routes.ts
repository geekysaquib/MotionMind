import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { MAX_AUDIO_SEC, MIN_SCENE_SEC, PACE_MAX, PACE_MIN, STAGES, type Project, type ReelEditor } from '@motionmind/shared';
import type { AppDeps } from '../app';
import { firstIssue } from '../http';
import { cleanFileName, sniffAudio } from './audioFormat';

export const MAX_AUDIO_BYTES = 40 * 1024 * 1024;

const kindSchema = z.enum(['voice', 'music']);

const trackSchema = z.object({
  path: z.string().min(1).max(300),
  fileName: z.string().max(200),
  mime: z.string().max(60),
  durationSec: z.number().positive().max(MAX_AUDIO_SEC, `Audio can be at most ${MAX_AUDIO_SEC / 60} minutes.`),
  peaks: z.array(z.number().int().min(0).max(99)).max(MAX_AUDIO_SEC * 20 + 200).optional(),
});

const pace = z.number().min(PACE_MIN).max(PACE_MAX);

export const editorSchema = z
  .object({
    voiceSource: z.enum(['upload', 'elevenlabs']),
    upload: z.object({ track: trackSchema, cuts: z.array(z.number().min(0)).max(80) }).nullable(),
    pace,
    scenePace: z.array(pace).max(80),
    music: z.object({ track: trackSchema, volume: z.number().min(0).max(1) }).nullable(),
    captions: z.object({ size: z.enum(['small', 'medium', 'large']), position: z.enum(['bottom', 'middle']), look: z.enum(['box', 'plain']) }),
  })
  .strict();

const stageBefore = (stage: Project['stage'], than: Project['stage']) => STAGES.indexOf(stage) < STAGES.indexOf(than);

/** Signed-in only: the Reel editor. Uploaded voice and music, scene cuts, pace and caption style. */
export function registerEditorRoutes(api: FastifyInstance, deps: AppDeps) {
  // Audio arrives as the raw request body: not JSON, not multipart.
  api.addContentTypeParser(/^(audio\/|application\/octet-stream)/, { parseAs: 'buffer', bodyLimit: MAX_AUDIO_BYTES }, (_req, body, done) => done(null, body));

  async function ownedProject(req: FastifyRequest, reply: FastifyReply): Promise<Project | null> {
    const id = (req.params as { id: string }).id;
    const project = z.string().uuid().safeParse(id).success ? await deps.data.getProject(req.userId, id) : null;
    if (!project) {
      reply.code(404).send({ error: 'not_found', message: 'Project not found.' });
      return null;
    }
    return project;
  }

  /** Playback URLs for the tracks the editor uses. */
  async function urlsFor(editor: ReelEditor | null) {
    const voicePath = editor?.upload?.track.path;
    const musicPath = editor?.music?.track.path;
    const paths = [voicePath, musicPath].filter((p): p is string => Boolean(p));
    const urls = await deps.audio.urls(paths);
    return {
      voice: voicePath ? urls[paths.indexOf(voicePath)] || undefined : undefined,
      music: musicPath ? urls[paths.indexOf(musicPath)] || undefined : undefined,
    };
  }

  api.post('/projects/:id/audio/:kind', { bodyLimit: MAX_AUDIO_BYTES }, async (req, reply) => {
    const kind = kindSchema.safeParse((req.params as { kind: string }).kind);
    if (!kind.success) return reply.code(404).send({ error: 'unknown_kind', message: 'Upload voice or music.' });
    const project = await ownedProject(req, reply);
    if (!project) return reply;
    const body = req.body;
    if (!Buffer.isBuffer(body) || body.length === 0) return reply.code(400).send({ error: 'no_audio', message: 'Choose an audio file to upload.' });
    const format = sniffAudio(body);
    if (!format) return reply.code(400).send({ error: 'not_audio', message: "That file doesn't look like audio. Use MP3, WAV, M4A, OGG, WebM or FLAC." });
    const path = `${req.userId}/${project.id}/${kind.data}-${randomUUID()}.${format.ext}`;
    await deps.audio.put(path, body, format.mime);
    const [url] = await deps.audio.urls([path]);
    req.log.info({ projectId: project.id, kind: kind.data, bytes: body.length, mime: format.mime }, 'audio uploaded');
    return { track: { path, fileName: cleanFileName(req.headers['x-file-name']), mime: format.mime }, url, bytes: body.length };
  });

  api.get('/projects/:id/editor', async (req, reply) => {
    const project = await ownedProject(req, reply);
    if (!project) return reply;
    return { editor: project.editor, urls: await urlsFor(project.editor) };
  });

  api.put('/projects/:id/editor', async (req, reply) => {
    const project = await ownedProject(req, reply);
    if (!project) return reply;
    const body = z.object({ editor: editorSchema }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_editor', message: firstIssue(body.error) });
    const editor = body.data.editor;

    // Files must be this project's own: nobody can point the editor at someone else's audio.
    const prefix = `${req.userId}/${project.id}/`;
    for (const t of [editor.upload?.track, editor.music?.track]) {
      if (t && !t.path.startsWith(prefix)) return reply.code(400).send({ error: 'invalid_editor', message: "That audio file doesn't belong to this project." });
    }
    if (editor.upload) {
      const { cuts, track } = editor.upload;
      const ordered = cuts.every(
        (c, i) => c >= MIN_SCENE_SEC - 0.01 && c <= track.durationSec - MIN_SCENE_SEC + 0.01 && (i === 0 || c - cuts[i - 1]! >= MIN_SCENE_SEC - 0.05),
      );
      if (!ordered) return reply.code(400).send({ error: 'invalid_cuts', message: 'The scene breaks must be in order, at least 0.3 s apart and inside the recording.' });
      const beats = project.script?.beats.length;
      if (beats && cuts.length !== beats - 1) {
        return reply.code(400).send({ error: 'invalid_cuts', message: "The scene breaks don't match the script's scenes. Open the Reel editor to refit them." });
      }
    }

    const saved: ReelEditor = { ...editor, updatedAt: new Date().toISOString() };
    const before = [project.editor?.upload?.track.path, project.editor?.music?.track.path];
    const after = new Set([saved.upload?.track.path, saved.music?.track.path]);
    const updated = await deps.data.updateProject(req.userId, project.id, {
      editor: saved,
      stage: saved.upload && stageBefore(project.stage, 'voice') ? 'voice' : project.stage,
      status: project.status === 'draft' ? 'in_progress' : project.status,
    });
    // Files the editor no longer uses are cleaned up. A failure to delete never fails the save.
    const unused = before.filter((p): p is string => Boolean(p) && !after.has(p));
    if (unused.length) await deps.audio.remove(unused).catch((err) => req.log.warn({ err }, 'could not delete unused audio'));
    return { project: updated, urls: await urlsFor(saved) };
  });
}
