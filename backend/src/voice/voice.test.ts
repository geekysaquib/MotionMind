import { randomBytes } from 'node:crypto';
import { describe, expect, it } from '@jest/globals';
import { buildApp } from '../app';
import { ConsoleMailer } from '../auth/mailer';
import { SessionTokens } from '../auth/session';
import { DevTokenVerifier } from '../auth/verifiers';
import { wordTimings } from '../connectors/elevenlabs';
import { MemoryDataRepository } from '../data/repository';
import { MemoryAudioStore } from './audioStore';

const secret = randomBytes(32).toString('base64');
const H = { authorization: 'Bearer dev:u1' };

const SCRIPT = {
  title: 'UPI',
  steps: ['App'],
  beats: [
    { id: 'a', narration: 'Ek second mein.', keywords: [], chapter: 0, card: { eyebrow: 'UPI', headline: 'Fast', tone: 'teal', rows: [] } },
    { id: 'b', narration: 'NPCI beech mein.', keywords: [], chapter: 1, card: { eyebrow: 'NPCI', headline: 'Switch', tone: 'blue', rows: [] } },
  ],
};

/** Fake ElevenLabs: answers text-to-speech with a tiny "MP3" and per-character timings. */
function fakeEleven() {
  const spoken: { voice: string; text: string }[] = [];
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    if (url.endsWith('/voices')) return new Response(JSON.stringify({ voices: [{ voice_id: 'v1', name: 'Aarav' }] }), { status: 200 });
    const voice = decodeURIComponent(url.split('/text-to-speech/')[1]!.split('/')[0]!);
    const text = (JSON.parse(String(init?.body)) as { text: string }).text;
    spoken.push({ voice, text });
    const chars = [...text];
    return new Response(
      JSON.stringify({
        audio_base64: Buffer.from(`mp3:${text}`).toString('base64'),
        alignment: { characters: chars, character_start_times_seconds: chars.map((_, i) => i * 0.05), character_end_times_seconds: chars.map((_, i) => i * 0.05 + 0.05) },
      }),
      { status: 200 },
    );
  }) as unknown as typeof fetch;
  return { fetchImpl, spoken };
}

async function setup(opts: { key?: string | null; fetchImpl?: typeof fetch } = {}) {
  const data = new MemoryDataRepository();
  const audio = new MemoryAudioStore();
  const app = await buildApp({
    data,
    audio,
    sessions: new SessionTokens(secret),
    mailer: new ConsoleMailer(false),
    verifier: new DevTokenVerifier(),
    authSecret: secret,
    webOrigin: 'http://localhost:5173',
    mode: 'memory',
    elevenLabsApiKey: opts.key === null ? undefined : (opts.key ?? 'el-server-key'),
    defaultVoiceId: 'v-default',
    fetchImpl: opts.fetchImpl,
  });
  const created = await app.inject({ method: 'POST', url: '/api/projects', headers: H, payload: { title: 'UPI', topic: 'UPI', durationSec: 30, qualityTier: 'draft' } });
  const id = created.json().project.id as string;
  return { app, data, audio, id };
}

describe('voiceover', () => {
  it('speaks every scene with the chosen voice, stores the audio and saves word timings', async () => {
    const eleven = fakeEleven();
    const { app, data, audio, id } = await setup({ fetchImpl: eleven.fetchImpl });
    await data.updateProject('u1', id, { script: SCRIPT as never, stage: 'storyboard' });

    const res = await app.inject({ method: 'POST', url: `/api/projects/${id}/voice`, headers: H, payload: { voiceId: 'v1', voiceName: 'Aarav' } });
    expect(res.statusCode).toBe(200);
    expect(eleven.spoken).toEqual([
      { voice: 'v1', text: 'Ek second mein.' },
      { voice: 'v1', text: 'NPCI beech mein.' },
    ]);
    const voice = res.json().project.voice;
    expect(voice).toMatchObject({ voiceId: 'v1', voiceName: 'Aarav', narrations: ['Ek second mein.', 'NPCI beech mein.'] });
    expect(voice.beats[0].words).toHaveLength(3);
    expect(voice.beats[0].durationSec).toBeGreaterThan(0.7);
    expect(res.json().project.stage).toBe('voice');
    expect(audio.files.size).toBe(2);
    expect(res.json().urls[1]).toMatch(/^data:audio\/mpeg;base64,/);
  });

  it('uses the default voice, and reports when the script changed since', async () => {
    const eleven = fakeEleven();
    const { app, data, id } = await setup({ fetchImpl: eleven.fetchImpl });
    await data.updateProject('u1', id, { script: SCRIPT as never });
    await app.inject({ method: 'POST', url: `/api/projects/${id}/voice`, headers: H, payload: {} });
    expect(eleven.spoken[0]!.voice).toBe('v-default');
    expect((await app.inject({ method: 'GET', url: `/api/projects/${id}/voice`, headers: H })).json().stale).toBe(false);
    await data.updateProject('u1', id, { script: { ...SCRIPT, beats: [{ ...SCRIPT.beats[0]!, narration: 'Changed.' }, SCRIPT.beats[1]!] } as never });
    expect((await app.inject({ method: 'GET', url: `/api/projects/${id}/voice`, headers: H })).json().stale).toBe(true);
  });

  it('needs a script and a server key, and lists voices', async () => {
    const eleven = fakeEleven();
    const { app, id } = await setup({ fetchImpl: eleven.fetchImpl });
    expect((await app.inject({ method: 'POST', url: `/api/projects/${id}/voice`, headers: H })).json().error).toBe('no_script');
    expect((await app.inject({ method: 'GET', url: '/api/voices', headers: H })).json()).toEqual({ voices: [{ id: 'v1', name: 'Aarav' }], defaultVoiceId: 'v-default' });
    const noKey = await setup({ key: null });
    expect((await noKey.app.inject({ method: 'GET', url: '/api/voices', headers: H })).statusCode).toBe(503);
  });

  it('turns an ElevenLabs failure into a clear message', async () => {
    const out = (async () => new Response('{}', { status: 429 })) as unknown as typeof fetch;
    const { app, data, id } = await setup({ fetchImpl: out });
    await data.updateProject('u1', id, { script: SCRIPT as never });
    const res = await app.inject({ method: 'POST', url: `/api/projects/${id}/voice`, headers: H, payload: { voiceId: 'v1' } });
    expect(res.statusCode).toBe(429);
    expect(res.json().message).toMatch(/out of credits/);
  });
});

describe('wordTimings', () => {
  it('groups characters into words by spaces', () => {
    const chars = [...'ab cd'];
    const t = wordTimings({ characters: chars, character_start_times_seconds: [0, 0.1, 0.2, 0.3, 0.4], character_end_times_seconds: [0.1, 0.2, 0.3, 0.4, 0.5] });
    expect(t).toEqual([
      { start: 0, end: 0.2 },
      { start: 0.3, end: 0.5 },
    ]);
  });
});
