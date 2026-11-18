import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Readable } from 'node:stream';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  FOOTAGE_LIMITS,
  carryChoices,
  keptRanges,
  rangesDuration,
  speechSegments,
  wordsAfterCut,
  type FootageEdit,
  type FootageJob,
} from '@motionmind/shared';
import type { AppDeps } from '../app';
import { firstIssue } from '../http';
import { captionsAss } from './captions';
import { TooLargeError, type FootageStore } from './store';
import type { MediaTools, ToolsReport } from './tools';

export interface FootageDeps {
  store: FootageStore;
  tools: MediaTools;
}

const VIDEO_EXTS = ['mp4', 'mov', 'm4v', 'webm', 'mkv', 'avi'] as const;
const MIME: Record<string, string> = { mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', mkv: 'video/x-matroska', avi: 'video/x-msvideo' };

const segmentSchema = z.object({ start: z.number().min(0), end: z.number().positive(), keep: z.boolean() });

const saveSchema = z
  .object({
    name: z.string().trim().min(1, 'Give the edit a name.').max(80).optional(),
    settings: z.object({
      minPause: z.number().min(FOOTAGE_LIMITS.minPause[0]).max(FOOTAGE_LIMITS.minPause[1]),
      padSec: z.number().min(FOOTAGE_LIMITS.padSec[0]).max(FOOTAGE_LIMITS.padSec[1]),
      captions: z.boolean(),
      captionPosition: z.enum(['lower', 'middle']),
    }),
    segments: z.array(segmentSchema).max(3000),
    approved: z.boolean(),
  })
  .strict();

/** The edit as the web app sees it: with links for the clip and the export (video tags can't send a sign-in header). */
function view(edit: FootageEdit) {
  const base = `/api/footage-files/${edit.id}`;
  return {
    edit,
    sourceUrl: edit.source?.durationSec ? `${base}/${edit.source.file}` : null,
    outputUrl: edit.output ? `${base}/${edit.output.file}` : null,
  };
}

/** Signed-in only: edit a raw clip into a reel. Upload, find the pauses and words, review, export. */
export function registerFootageRoutes(api: FastifyInstance, deps: AppDeps) {
  const unavailable = { error: 'footage_unavailable', message: 'Raw footage editing runs on your PC: start Motion Mind with npm run dev.' };
  // Edits with a job in this process, so reads see the job's latest state. A "running" job that isn't here was cut off by a restart.
  const live = new Map<string, { edit: FootageEdit; settled: Promise<unknown> }>();
  let toolsCache: { at: number; report: ToolsReport } | null = null;

  // Clips arrive as the raw request body and stream straight to disk.
  api.addContentTypeParser(/^video\//, (_req, payload, done) => done(null, payload));

  async function load(userId: string, id: string): Promise<FootageEdit | null> {
    const current = live.get(id);
    if (current) return current.edit.ownerId === userId ? current.edit : null;
    const edit = await deps.footage!.store.get(userId, id);
    if (edit?.job?.status === 'running') {
      edit.job = { ...edit.job, status: 'failed', error: 'This stopped when the API restarted. Start it again.', finishedAt: new Date().toISOString() };
      await deps.footage!.store.save(edit);
    }
    return edit;
  }

  /** Runs `work` in the background with the edit's job kept up to date in edit.json. */
  function startJob(edit: FootageEdit, kind: FootageJob['kind'], work: (edit: FootageEdit, step: (text: string, progress: number) => Promise<void>) => Promise<void>, log: FastifyInstance['log']) {
    const { store } = deps.footage!;
    edit.job = { kind, status: 'running', progress: 0, step: 'Starting', startedAt: new Date().toISOString() };
    // Saves run one after another, so a late progress save can never overwrite the final state.
    const entry = { edit, settled: Promise.resolve() as Promise<unknown> };
    live.set(edit.id, entry);
    const persist = () => (entry.settled = entry.settled.then(() => store.save(edit)).catch(() => undefined));
    const step = async (text: string, progress: number) => {
      edit.job = { ...edit.job!, step: text, progress };
      await persist();
    };
    void (async () => {
      try {
        await persist();
        await work(edit, step);
        edit.job = { ...edit.job!, status: 'done', progress: 1, step: 'Done', finishedAt: new Date().toISOString() };
        log.info({ editId: edit.id, kind }, 'footage job done');
      } catch (err) {
        edit.job = { ...edit.job!, status: 'failed', error: (err as Error).message || 'Something went wrong.', finishedAt: new Date().toISOString() };
        log.error({ err, editId: edit.id, kind }, 'footage job failed');
      } finally {
        edit.updatedAt = new Date().toISOString();
        await persist();
        if (live.get(edit.id) === entry) live.delete(edit.id);
      }
    })();
  }

  /** Probe, find the pauses, then the words (only when there are none yet, since that is the slow part). */
  function analyze(edit: FootageEdit, log: FastifyInstance['log'], opts: { retranscribe: boolean }) {
    const { store, tools } = deps.footage!;
    startJob(
      edit,
      'analyze',
      async (e, step) => {
        const file = path.join(store.dir(e.id), e.source!.file);
        await step('Reading the clip', 0.05);
        const probe = await tools.probe(file);
        if (probe.durationSec > FOOTAGE_LIMITS.maxSec) throw new Error(`The clip is ${Math.round(probe.durationSec / 60)} minutes long. Keep it under ${FOOTAGE_LIMITS.maxSec / 60} minutes.`);
        e.source = { file: e.source!.file, ...probe };
        await step('Finding the pauses', 0.2);
        // Found at the shortest pause allowed, so the page can cut at any longer one without running FFmpeg again.
        e.silences = await tools.silences(file, { noiseDb: e.settings.noiseDb, minPause: FOOTAGE_LIMITS.minPause[0] });
        e.segments = carryChoices(speechSegments(e.silences, probe.durationSec, e.settings), e.segments);
        e.approvedAt = null;
        if (!probe.hasAudio) {
          e.words = null;
          e.transcriptNote = 'The clip has no sound, so there are no pauses to cut and no captions.';
          return;
        }
        if (e.words && !opts.retranscribe) return;
        await step('Writing down the words (whisper.cpp)', 0.4);
        const result = await tools.transcribe(file, store.dir(e.id));
        e.words = result.words;
        e.transcriptNote = result.note;
      },
      log,
    );
  }

  api.get('/footage/tools', async () => {
    if (!deps.footage) return { available: false, tools: null };
    if (!toolsCache || Date.now() - toolsCache.at > 60_000) toolsCache = { at: Date.now(), report: await deps.footage.tools.report() };
    return { available: true, tools: toolsCache.report };
  });

  api.get('/footage', async (req) => {
    if (!deps.footage) return { available: false, edits: [] };
    const edits = await deps.footage.store.list(req.userId);
    return { available: true, edits: edits.map((e) => view(e)) };
  });

  api.post('/footage', async (req, reply) => {
    if (!deps.footage) return reply.code(501).send(unavailable);
    const body = req.body as Readable | undefined;
    if (!body || typeof (body as Readable).pipe !== 'function') return reply.code(400).send({ error: 'no_video', message: 'Choose a video file to upload.' });
    const fileName = (() => {
      try {
        return decodeURIComponent(String(req.headers['x-file-name'] ?? '')).replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-').slice(0, 160) || 'clip.mp4';
      } catch {
        return 'clip.mp4';
      }
    })();
    const ext = (/\.([a-z0-9]+)$/i.exec(fileName)?.[1] ?? 'mp4').toLowerCase();
    if (!(VIDEO_EXTS as readonly string[]).includes(ext)) return reply.code(400).send({ error: 'not_video', message: 'Use an MP4, MOV, M4V, WebM, MKV or AVI video.' });
    let created;
    try {
      created = await deps.footage.store.create(req.userId, body, { fileName, ext, maxBytes: FOOTAGE_LIMITS.maxBytes });
    } catch (err) {
      if (err instanceof TooLargeError) return reply.code(413).send({ error: 'too_large', message: 'That clip is over 1 GB. Trim it or export it smaller first.' });
      throw err;
    }
    const { edit, bytes } = created;
    if (bytes === 0) {
      await deps.footage.store.remove(req.userId, edit.id);
      return reply.code(400).send({ error: 'no_video', message: 'Choose a video file to upload.' });
    }
    // Check it really is a video before keeping it.
    try {
      const probe = await deps.footage.tools.probe(path.join(deps.footage.store.dir(edit.id), edit.source!.file));
      edit.source = { file: edit.source!.file, ...probe };
    } catch (err) {
      await deps.footage.store.remove(req.userId, edit.id);
      req.log.warn({ err }, 'footage upload is not a readable video');
      return reply.code(400).send({ error: 'not_video', message: "That file doesn't look like a video FFmpeg can read." });
    }
    req.log.info({ editId: edit.id, bytes, ext }, 'footage uploaded');
    analyze(edit, req.log, { retranscribe: true });
    return view(edit);
  });

  api.get('/footage/:id', async (req, reply) => {
    if (!deps.footage) return reply.code(501).send(unavailable);
    const edit = await load(req.userId, (req.params as { id: string }).id);
    if (!edit) return reply.code(404).send({ error: 'not_found', message: 'That edit was not found.' });
    return view(edit);
  });

  api.put('/footage/:id', async (req, reply) => {
    if (!deps.footage) return reply.code(501).send(unavailable);
    const edit = await load(req.userId, (req.params as { id: string }).id);
    if (!edit) return reply.code(404).send({ error: 'not_found', message: 'That edit was not found.' });
    if (edit.job?.status === 'running') return reply.code(409).send({ error: 'busy', message: 'Wait for the clip to finish processing, then save.' });
    const body = saveSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_edit', message: firstIssue(body.error) });
    const { segments, settings, approved, name } = body.data;
    const duration = edit.source?.durationSec ?? 0;
    const ordered = segments.every((s, i) => s.end > s.start && s.end <= duration + 0.01 && (i === 0 || s.start >= segments[i - 1]!.end - 0.001));
    if (!ordered) return reply.code(400).send({ error: 'invalid_segments', message: 'The takes must be in order, not overlap, and stay inside the clip.' });
    if (approved && !segments.some((s) => s.keep)) return reply.code(400).send({ error: 'nothing_kept', message: 'Keep at least one take before approving.' });
    edit.segments = segments;
    edit.settings = { ...edit.settings, ...settings };
    if (name) edit.name = name;
    edit.approvedAt = approved ? (edit.approvedAt ?? new Date().toISOString()) : null;
    edit.updatedAt = new Date().toISOString();
    await deps.footage.store.save(edit);
    return view(edit);
  });

  api.post('/footage/:id/analyze', async (req, reply) => {
    if (!deps.footage) return reply.code(501).send(unavailable);
    const edit = await load(req.userId, (req.params as { id: string }).id);
    if (!edit) return reply.code(404).send({ error: 'not_found', message: 'That edit was not found.' });
    if (edit.job?.status === 'running') return reply.code(409).send({ error: 'busy', message: 'This clip is already being processed.' });
    const body = z.object({ noiseDb: z.number().min(FOOTAGE_LIMITS.noiseDb[0]).max(FOOTAGE_LIMITS.noiseDb[1]).optional(), retranscribe: z.boolean().optional() }).strict().safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: 'invalid_analyze', message: firstIssue(body.error) });
    if (body.data.noiseDb !== undefined) edit.settings = { ...edit.settings, noiseDb: body.data.noiseDb };
    analyze(edit, req.log, { retranscribe: body.data.retranscribe ?? false });
    return view(edit);
  });

  api.post('/footage/:id/export', async (req, reply) => {
    if (!deps.footage) return reply.code(501).send(unavailable);
    const { store, tools } = deps.footage;
    const edit = await load(req.userId, (req.params as { id: string }).id);
    if (!edit) return reply.code(404).send({ error: 'not_found', message: 'That edit was not found.' });
    if (edit.job?.status === 'running') return reply.code(409).send({ error: 'busy', message: 'This clip is already being processed.' });
    if (!edit.approvedAt) return reply.code(400).send({ error: 'not_approved', message: 'Approve the storyboard first.' });
    const kept = keptRanges(edit.segments);
    if (!kept.length || !edit.source) return reply.code(400).send({ error: 'nothing_kept', message: 'Keep at least one take.' });
    startJob(
      edit,
      'export',
      async (e, step) => {
        const dir = store.dir(e.id);
        const durationSec = rangesDuration(kept);
        const words = e.settings.captions && e.words ? wordsAfterCut(e.words, kept) : [];
        let captions: string | null = null;
        if (words.length) {
          captions = 'captions.ass';
          await writeFile(path.join(dir, captions), captionsAss(words, e.settings.captionPosition));
        }
        await step(captions ? 'Cutting the pauses and adding captions' : 'Cutting the pauses', 0.02);
        const file = `out-${randomUUID()}.mp4`;
        let last = 0;
        await tools.render({ cwd: dir, input: e.source!.file, output: file, kept, hasAudio: e.source!.hasAudio, captions, durationSec }, (p) => {
          // edit.json is rewritten at most every 5%.
          if (p - last >= 0.05) {
            last = p;
            void step(`Exporting… ${Math.round(p * 100)}%`, p);
          }
        });
        if (e.output) await rm(path.join(dir, e.output.file), { force: true });
        e.output = { file, durationSec, createdAt: new Date().toISOString() };
      },
      req.log,
    );
    return view(edit);
  });

  api.delete('/footage/:id', async (req, reply) => {
    if (!deps.footage) return reply.code(501).send(unavailable);
    const id = (req.params as { id: string }).id;
    const current = live.get(id);
    if (current?.edit.ownerId === req.userId && current.edit.job?.status === 'running') return reply.code(409).send({ error: 'busy', message: 'Wait for the clip to finish processing, then delete it.' });
    await current?.settled;
    const ok = await deps.footage.store.remove(req.userId, id);
    if (!ok) return reply.code(404).send({ error: 'not_found', message: 'That edit was not found.' });
    return { ok: true };
  });
}

/**
 * Public: the clip and its exports, by the edit's unguessable id, for video tags and downloads.
 * Supports Range requests so the browser can seek.
 */
export function registerFootageFiles(app: FastifyInstance, deps: AppDeps) {
  app.get('/api/footage-files/:id/:file', async (req, reply) => {
    const { id, file } = req.params as { id: string; file: string };
    const notFound = () => reply.code(404).send({ error: 'not_found', message: 'That file is not available.' });
    if (!deps.footage) return notFound();
    const edit = await deps.footage.store.find(id);
    if (!edit || (file !== edit.source?.file && file !== edit.output?.file)) return notFound();
    const full = path.join(deps.footage.store.dir(id), file);
    const info = await stat(full).catch(() => null);
    if (!info) return notFound();
    const ext = file.split('.').pop()!;
    reply.header('Content-Type', MIME[ext] ?? 'application/octet-stream').header('Accept-Ranges', 'bytes');
    if ((req.query as { download?: string }).download !== undefined) {
      const name = `${edit.name.replace(/[^\p{L}\p{N}._ -]+/gu, '-').trim() || 'reel'}-reel.mp4`;
      reply.header('Content-Disposition', `attachment; filename="${name.replace(/[^ -~]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(name)}`);
    }
    const range = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range ?? ''));
    if (range && (range[1] || range[2])) {
      let start = range[1] ? Number(range[1]) : Math.max(0, info.size - Number(range[2]));
      let end = range[1] && range[2] ? Number(range[2]) : info.size - 1;
      end = Math.min(end, info.size - 1);
      if (start > end || start >= info.size) {
        return reply.code(416).header('Content-Range', `bytes */${info.size}`).send();
      }
      start = Math.max(0, start);
      reply.code(206).header('Content-Range', `bytes ${start}-${end}/${info.size}`).header('Content-Length', end - start + 1);
      return reply.send(createReadStream(full, { start, end }));
    }
    reply.header('Content-Length', info.size);
    return reply.send(createReadStream(full));
  });
}
