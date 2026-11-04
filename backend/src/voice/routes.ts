import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ReelVoice } from '@motionmind/shared';
import type { AppDeps } from '../app';
import { ElevenLabsError, listVoices, speak } from '../connectors/elevenlabs';
import { voicePath } from './audioStore';

const generateSchema = z.object({ voiceId: z.string().trim().min(1).max(100).optional(), voiceName: z.string().max(100).optional() });

/** Runs `fn` over items with at most `limit` running at once, keeping the order of results. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]!, i);
      }
    }),
  );
  return out;
}

/** Signed-in only: ElevenLabs voiceover for a project's script, on the server's key. */
export function registerVoiceRoutes(api: FastifyInstance, deps: AppDeps) {
  const notConfigured = { error: 'elevenlabs_not_configured', message: "ElevenLabs isn't set up on the server yet (ELEVENLABS_API_KEY)." };

  api.get('/voices', async (_req, reply) => {
    if (!deps.elevenLabsApiKey) return reply.code(503).send(notConfigured);
    try {
      return { voices: await listVoices(deps.elevenLabsApiKey, deps.fetchImpl), defaultVoiceId: deps.defaultVoiceId ?? null };
    } catch (err) {
      if (err instanceof ElevenLabsError) return reply.code(err.status).send({ error: 'elevenlabs_failed', message: err.message });
      throw err;
    }
  });

  // Voiceover with fresh playback URLs, and whether the script changed since it was made.
  api.get('/projects/:id/voice', async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const project = z.string().uuid().safeParse(id).success ? await deps.data.getProject(req.userId, id) : null;
    if (!project) return reply.code(404).send({ error: 'not_found', message: 'Project not found.' });
    if (!project.voice) return { voice: null, urls: [], stale: false };
    const urls = await deps.audio.urls(project.voice.beats.map((_, i) => voicePath(req.userId, project.id, i)));
    const now = project.script?.beats.map((b) => b.narration) ?? [];
    const stale = JSON.stringify(now) !== JSON.stringify(project.voice.narrations);
    return { voice: project.voice, urls, stale };
  });

  api.post('/projects/:id/voice', async (req, reply) => {
    if (!deps.elevenLabsApiKey) return reply.code(503).send(notConfigured);
    const body = generateSchema.safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: 'invalid_voice', message: 'Pick a voice.' });
    const id = (req.params as { id: string }).id;
    const project = z.string().uuid().safeParse(id).success ? await deps.data.getProject(req.userId, id) : null;
    if (!project) return reply.code(404).send({ error: 'not_found', message: 'Project not found.' });
    if (!project.script?.beats.length) return reply.code(400).send({ error: 'no_script', message: 'Write the script first.' });
    const voiceId = body.data.voiceId ?? deps.defaultVoiceId;
    if (!voiceId) return reply.code(400).send({ error: 'no_voice', message: 'Pick a voice.' });

    const key = deps.elevenLabsApiKey;
    try {
      const narrations = project.script.beats.map((b) => b.narration);
      // A few lines at a time: fast, without tripping ElevenLabs' concurrency limits.
      const beats = await mapLimit(narrations, 3, async (text, i) => {
        const { audio, words, durationSec } = await speak(key, voiceId, text, deps.fetchImpl);
        await deps.audio.put(voicePath(req.userId, project.id, i), audio);
        return { durationSec, words };
      });
      const voice: ReelVoice = { voiceId, voiceName: body.data.voiceName, beats, narrations, createdAt: new Date().toISOString() };
      const updated = await deps.data.updateProject(req.userId, project.id, { voice, stage: ['topic', 'research', 'script', 'storyboard', 'graphics'].includes(project.stage) ? 'voice' : project.stage });
      req.log.info({ projectId: project.id, beats: beats.length }, 'voiceover generated');
      const urls = await deps.audio.urls(beats.map((_, i) => voicePath(req.userId, project.id, i)));
      return { project: updated, urls };
    } catch (err) {
      if (err instanceof ElevenLabsError) return reply.code(err.status).send({ error: 'elevenlabs_failed', message: err.message });
      throw err;
    }
  });
}
