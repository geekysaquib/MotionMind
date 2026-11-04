import { randomBytes } from 'node:crypto';
import { describe, expect, it } from '@jest/globals';
import { buildApp } from '../app';
import { ConsoleMailer } from '../auth/mailer';
import { SessionTokens } from '../auth/session';
import { DevTokenVerifier } from '../auth/verifiers';
import { MemoryDataRepository } from '../data/repository';
import { MemoryAudioStore, voicePath } from '../voice/audioStore';
import type { Renderer, RenderJob } from './renderer';

const secret = randomBytes(32).toString('base64');
const SCRIPT = {
  title: 'UPI',
  steps: ['App'],
  beats: [{ id: 'a', narration: 'Ek second.', keywords: [], chapter: 0, card: { eyebrow: 'UPI', headline: 'Fast', tone: 'teal', rows: [] } }],
};

class FakeRenderer implements Renderer {
  started: { userId: string; projectId: string; props: Record<string, unknown> }[] = [];
  job: RenderJob | null = null;
  start(userId: string, projectId: string, props: Record<string, unknown>) {
    this.started.push({ userId, projectId, props });
    this.job = { id: 'j1', projectId, status: 'rendering', progress: 0.4, startedAt: 'now' };
    return this.job;
  }
  latest() {
    return this.job;
  }
  filePath() {
    return null;
  }
}

async function setup(renderer?: Renderer) {
  const data = new MemoryDataRepository();
  const audio = new MemoryAudioStore();
  const app = await buildApp({ data, audio, renderer, sessions: new SessionTokens(secret), mailer: new ConsoleMailer(false), verifier: new DevTokenVerifier(), authSecret: secret, webOrigin: 'http://localhost:5173', mode: 'memory' });
  const user = await data.signInUser('creator@example.com');
  const H = { authorization: `Bearer dev:${user.id}` };
  const id = (await app.inject({ method: 'POST', url: '/api/projects', headers: H, payload: { title: 'UPI', topic: 'UPI', durationSec: 30, qualityTier: 'draft' } })).json().project.id as string;
  await data.updateProject(user.id, id, { script: SCRIPT as never });
  return { app, data, audio, id, H, uid: user.id };
}

describe('MP4 export', () => {
  it('starts a render with the branded reel, including matching voiceover', async () => {
    const renderer = new FakeRenderer();
    const { app, data, audio, id, H, uid } = await setup(renderer);
    await data.updateProfile(uid, { channelName: 'Decodify X', handle: 'decodify_x' });
    await audio.put(voicePath(uid, id, 0), Buffer.from('mp3'));
    await data.updateProject(uid, id, { voice: { voiceId: 'v', beats: [{ durationSec: 1, words: [] }], narrations: ['Ek second.'], createdAt: 'now' } });
    const res = await app.inject({ method: 'POST', url: `/api/projects/${id}/export`, headers: H });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ withVoice: true, job: { status: 'rendering' } });
    const props = renderer.started[0]!.props as { brand: { name: string; initials: string; handle: string }; audioUrls: string[]; world: string };
    expect(props.brand).toMatchObject({ name: 'Decodify X', initials: 'DX', handle: '@decodify_x' });
    expect(props.world).toBe('iso');
    expect(props.audioUrls[0]).toMatch(/^data:audio\/mpeg/);
    expect((await app.inject({ method: 'GET', url: `/api/projects/${id}/export`, headers: H })).json()).toMatchObject({ available: true, job: { progress: 0.4 } });
  });

  it('leaves out voiceover that no longer matches the narration', async () => {
    const renderer = new FakeRenderer();
    const { app, data, id, H, uid } = await setup(renderer);
    await data.updateProject(uid, id, { voice: { voiceId: 'v', beats: [{ durationSec: 1, words: [] }], narrations: ['Old line.'], createdAt: 'now' } });
    expect((await app.inject({ method: 'POST', url: `/api/projects/${id}/export`, headers: H })).json().withVoice).toBe(false);
    expect(renderer.started[0]!.props.audioUrls).toBeUndefined();
  });

  it('explains that export runs locally when the server cannot render (Netlify)', async () => {
    const { app, id, H } = await setup();
    const res = await app.inject({ method: 'POST', url: `/api/projects/${id}/export`, headers: H });
    expect(res.statusCode).toBe(501);
    expect(res.json().message).toMatch(/runs on your PC/);
    expect((await app.inject({ method: 'GET', url: `/api/projects/${id}/export`, headers: H })).json()).toEqual({ available: false, job: null });
  });

  it('only serves known render files', async () => {
    const { app } = await setup(new FakeRenderer());
    expect((await app.inject({ method: 'GET', url: '/api/renders/..%2F..%2F.env' })).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: '/api/renders/00000000-0000-0000-0000-000000000000.mp4' })).statusCode).toBe(404);
  });
});
