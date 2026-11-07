import { randomBytes } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
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
  platforms: (string | undefined)[] = [];
  start(userId: string, projectId: string, props: Record<string, unknown>, platform?: string) {
    this.platforms.push(platform);
    this.started.push({ userId, projectId, props });
    this.job = { id: 'j1', projectId, status: 'rendering', progress: 0.4, startedAt: 'now' };
    return this.job;
  }
  latest() {
    return this.job;
  }
  filePath(): string | null {
    return null;
  }
  async still() {
    return 'unused.png';
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

describe('platforms', () => {
  it('default to both, can be one, are validated, and are kept when the project is edited', async () => {
    const { app, id, H } = await setup();
    const get = async () => (await app.inject({ method: 'GET', url: `/api/projects/${id}`, headers: H })).json().project.platforms;
    expect(await get()).toEqual(['instagram', 'youtube']);
    const patch = (platforms: unknown) => app.inject({ method: 'PATCH', url: `/api/projects/${id}`, headers: H, payload: { platforms } });
    expect((await patch(['youtube'])).json().project.platforms).toEqual(['youtube']);
    expect((await patch([])).json().message).toBe('Pick at least one platform.');
    expect((await patch(['tiktok'])).statusCode).toBe(400);
    expect(await get()).toEqual(['youtube']);
    const one = await app.inject({ method: 'POST', url: '/api/projects', headers: H, payload: { title: 'X', topic: 'X', durationSec: 30, qualityTier: 'draft', platforms: ['instagram'] } });
    expect(one.json().project.platforms).toEqual(['instagram']);
  });

  it('are exported one video each, with the platform in the spec, and only for platforms the reel has', async () => {
    const renderer = new FakeRenderer();
    const { app, data, id, H, uid } = await setup(renderer);
    const post = (payload?: unknown) => app.inject({ method: 'POST', url: `/api/projects/${id}/export`, headers: H, payload: payload as never });
    expect((await post({ platform: 'youtube' })).statusCode).toBe(200);
    expect((await post({ platform: 'instagram' })).statusCode).toBe(200);
    expect(renderer.platforms).toEqual(['youtube', 'instagram']);
    expect((renderer.started[0]!.props as { platform: string }).platform).toBe('youtube');
    expect((await post({ platform: 'tiktok' })).json().error).toBe('invalid_platform');
    await data.updateProject(uid, id, { platforms: ['instagram'] });
    expect((await post({ platform: 'youtube' })).json().message).toMatch(/not set up for that platform/);
    // No platform given: the reel's first one.
    await post();
    expect(renderer.platforms.at(-1)).toBe('instagram');
    const status = (await app.inject({ method: 'GET', url: `/api/projects/${id}/export`, headers: H })).json();
    expect(Object.keys(status.jobs).sort()).toEqual(['instagram', 'youtube']);
  });
});

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
    const props = renderer.started[0]!.props as { brand: { name: string; initials: string; handle: string }; audioUrls: string[]; style: string };
    expect(props.brand).toMatchObject({ name: 'Decodify X', initials: 'DX', handle: '@decodify_x' });
    expect(props.style).toBe('live-map');
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

  it('explains that export runs locally when the server has no renderer', async () => {
    const { app, id, H } = await setup();
    const res = await app.inject({ method: 'POST', url: `/api/projects/${id}/export`, headers: H });
    expect(res.statusCode).toBe(501);
    expect(res.json().message).toMatch(/runs on your PC/);
    expect((await app.inject({ method: 'GET', url: `/api/projects/${id}/export`, headers: H })).json()).toEqual({ available: false, job: null });
  });

  it('saves a download under the name the link asks for (reel title and platform), and shows it inline otherwise', async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'mm-render-'));
    const file = path.join(dir, 'f.mp4');
    writeFileSync(file, 'video');
    const renderer = new FakeRenderer();
    renderer.filePath = () => file;
    const { app } = await setup(renderer);
    const url = '/api/renders/11111111-1111-1111-1111-111111111111.mp4';
    const named = await app.inject({ method: 'GET', url: `${url}?name=${encodeURIComponent('IRCTC-Tatkal-shorts.mp4')}` });
    expect(named.headers['content-disposition']).toContain('attachment; filename="IRCTC-Tatkal-shorts.mp4"');
    const odd = await app.inject({ method: 'GET', url: `${url}?name=${encodeURIComponent('../../x"y.mp4')}` });
    expect(odd.headers['content-disposition']).toContain('filename="x-y.mp4"');
    const plain = await app.inject({ method: 'GET', url });
    expect(plain.headers['content-disposition']).toBe('inline; filename="motion-mind-reel.mp4"');
    const wrongType = await app.inject({ method: 'GET', url: `${url}?name=evil.exe` });
    expect(wrongType.headers['content-disposition']).toContain('inline');
  });

  it('only serves known render files', async () => {
    const { app } = await setup(new FakeRenderer());
    expect((await app.inject({ method: 'GET', url: '/api/renders/..%2F..%2F.env' })).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: '/api/renders/00000000-0000-0000-0000-000000000000.mp4' })).statusCode).toBe(404);
  });
});
