import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { alignScript, clipToLoud, MAX_AUDIO_SEC, MIN_SCENE_SEC, narrationKey, runsFromPeaks, STAGES, trimWindow, type Project, type ReelEditor, type SpeechRun } from '@motionmind/shared';
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

export const editorSchema = z.object({
  upload: z
    .object({
      track: trackSchema,
      cuts: z.array(z.number().min(0)).max(80),
      closingAt: z.number().positive().nullable().optional(),
      trimStart: z.number().min(0).nullable().optional(),
      trimEnd: z.number().positive().nullable().optional(),
      wordTimes: z.array(z.tuple([z.number().min(0), z.number().min(0)])).max(6000).optional(),
      fitKey: z.string().max(40).optional(),
      speech: z.array(z.tuple([z.number().min(0), z.number().min(0)])).max(6000).optional(),
      fit: z.enum(['speech', 'loudness']).optional(),
    })
    .nullable(),
  music: z.object({ track: trackSchema, volume: z.number().min(0).max(1) }).nullable(),
  // The page sends back what it loaded, which includes the last save time. The server stamps its own, so this is ignored.
  updatedAt: z.string().max(40).optional(),
});

const stageBefore = (stage: Project['stage'], than: Project['stage']) => STAGES.indexOf(stage) < STAGES.indexOf(than);

/** Signed-in only: the voice step. The user's own recording and music, the scene cuts, and the auto-fit of the script's words to the voice. */
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

  /** The cuts, trim and follow line must make sense for this recording and this script. */
  function checkUpload(upload: NonNullable<ReelEditor['upload']>, beats: number | undefined): { error: string; message: string } | null {
    const { cuts, track, closingAt, trimStart, trimEnd } = upload;
    const ordered = cuts.every((c, i) => c >= MIN_SCENE_SEC - 0.01 && c <= track.durationSec - MIN_SCENE_SEC + 0.01 && (i === 0 || c - cuts[i - 1]! >= MIN_SCENE_SEC - 0.05));
    if (!ordered) return { error: 'invalid_cuts', message: 'The scene breaks must be in order, at least 0.3 s apart and inside the recording.' };
    const from = trimStart ?? 0;
    const to = trimEnd ?? track.durationSec;
    if (to > track.durationSec + 0.01 || to - from < 1 || (cuts.length && (cuts[0]! < from + MIN_SCENE_SEC - 0.05 || cuts[cuts.length - 1]! > to - MIN_SCENE_SEC + 0.05))) {
      return { error: 'invalid_trim', message: 'The trimmed part must be at least 1 second long and keep every scene break inside it.' };
    }
    if (closingAt != null) {
      const last = cuts.length ? cuts[cuts.length - 1]! : from;
      if (closingAt < last + MIN_SCENE_SEC - 0.05 || closingAt > to - 0.3) return { error: 'invalid_closing', message: 'The follow line must start after the last scene break and before the end of the recording.' };
    }
    if (beats && cuts.length !== beats - 1) return { error: 'invalid_cuts', message: "The scene breaks don't match the script's scenes. Fit the script to your voice again." };
    return null;
  }

  async function save(req: FastifyRequest, project: Project, saved: ReelEditor) {
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
    return updated;
  }

  api.put('/projects/:id/editor', async (req, reply) => {
    const project = await ownedProject(req, reply);
    if (!project) return reply;
    const body = z.object({ editor: editorSchema }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_editor', message: firstIssue(body.error) });
    const editor = body.data.editor as ReelEditor;

    // Files must be this project's own: nobody can point the editor at someone else's audio.
    const prefix = `${req.userId}/${project.id}/`;
    for (const t of [editor.upload?.track, editor.music?.track]) {
      if (t && !t.path.startsWith(prefix)) return reply.code(400).send({ error: 'invalid_editor', message: "That audio file doesn't belong to this project." });
    }
    if (editor.upload) {
      const problem = checkUpload(editor.upload, project.script?.beats.length);
      if (problem) return reply.code(400).send(problem);
    }
    const saved: ReelEditor = { ...editor, updatedAt: new Date().toISOString() };
    const updated = await save(req, project, saved);
    return { project: updated, urls: await urlsFor(saved) };
  });

  /** The recording's bytes, from the audio store (a data URL in memory mode, a signed URL in Supabase mode). */
  async function readAudio(storagePath: string): Promise<Buffer> {
    const [url] = await deps.audio.urls([storagePath]);
    if (!url) throw new Error('The recording is no longer in storage.');
    if (url.startsWith('data:')) return Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
    const res = await (deps.fetchImpl ?? fetch)(url);
    if (!res.ok) throw new Error(`Could not read the recording (${res.status}).`);
    return Buffer.from(await res.arrayBuffer());
  }

  /**
   * Auto-fit: finds where every scene starts in the user's recording and when every word of the script is spoken.
   * It listens with whisper.cpp when that is set up (the words it hears give real timings) and otherwise uses the
   * loudness of the recording. The result is saved with the recording.
   */
  api.post('/projects/:id/voice/fit', async (req, reply) => {
    const project = await ownedProject(req, reply);
    if (!project) return reply;
    const up = project.editor?.upload;
    if (!project.script?.beats.length) return reply.code(400).send({ error: 'no_script', message: 'Write the script first.' });
    if (!up) return reply.code(400).send({ error: 'no_recording', message: 'Upload your voiceover first.' });
    const narrations = project.script.beats.map((b) => b.narration);
    const win = trimWindow(up);
    const end = up.closingAt ?? win.end;

    let runs: SpeechRun[] = [];
    let fit: 'speech' | 'loudness' = 'loudness';
    let note: string | null = null;
    const tools = deps.footage?.tools;
    if (tools) {
      const work = await mkdtemp(path.join(os.tmpdir(), 'mm-fit-'));
      try {
        const file = path.join(work, `voice.${up.track.path.split('.').pop() ?? 'mp3'}`);
        await writeFile(file, await readAudio(up.track.path));
        const heard = await tools.transcribe(file, work);
        const total = narrations.reduce((n, s) => n + s.split(/\s+/).filter(Boolean).length, 0);
        if (heard.words && heard.words.length >= Math.max(4, Math.round(total / 8))) {
          runs = clipToLoud(heard.words.map((w) => ({ start: w.start, end: w.end })), runsFromPeaks(up.track.peaks ?? []));
          fit = 'speech';
        } else note = heard.note ?? 'The speech could not be recognised, so the fit uses the loudness of your recording.';
      } catch (err) {
        req.log.warn({ err }, 'speech recognition failed, fitting from loudness');
        note = 'The speech could not be recognised, so the fit uses the loudness of your recording.';
      } finally {
        await rm(work, { recursive: true, force: true }).catch(() => undefined);
      }
    } else note = 'whisper.cpp is not set up, so the fit uses the loudness of your recording.';
    if (!runs.length) runs = runsFromPeaks(up.track.peaks ?? []);

    const result = alignScript(narrations, runs, { start: win.start, end });
    if (!result) return reply.code(400).send({ error: 'no_speech', message: "I couldn't hear any speech in that recording. Check the file and upload it again." });
    const upload = { ...up, cuts: result.cuts, wordTimes: result.wordTimes, fitKey: narrationKey(narrations), fit, speech: fit === 'speech' ? runs.map((r) => [r.start, r.end] as [number, number]).slice(0, 6000) : undefined };
    const problem = checkUpload(upload, narrations.length);
    if (problem) return reply.code(400).send(problem);
    const saved: ReelEditor = { ...(project.editor as ReelEditor), upload, updatedAt: new Date().toISOString() };
    const updated = await save(req, project, saved);
    req.log.info({ projectId: project.id, fit, scenes: narrations.length, words: result.wordTimes.length }, 'voice fitted');
    return { project: updated, urls: await urlsFor(saved), fit, note };
  });
}
