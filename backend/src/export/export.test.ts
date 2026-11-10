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
import { localizeGsap, muxArgs, type HtmlRenderInput } from './hyperframes';

const secret = randomBytes(32).toString('base64');
const SCRIPT = {
  title: 'UPI',
  steps: ['App'],
  beats: [{ id: 'a', narration: 'Ek second.', keywords: [], chapter: 0, card: { eyebrow: 'UPI', headline: 'Fast', tone: 'teal', rows: [] } }],
  animation: { html: '<!doctype html><html><body>reel</body></html>', timingKey: 'x', writtenAt: 'now' },
};

class FakeRenderer implements Renderer {
  started: { userId: string; projectId: string; input: HtmlRenderInput }[] = [];
  job: RenderJob | null = null;
  platforms: (string | undefined)[] = [];
  start(userId: string, projectId: string, input: HtmlRenderInput, platform?: string) {
    this.platforms.push(platform);
    this.started.push({ userId, projectId, input });
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

  it('are exported one video each, and only for platforms the reel has', async () => {
    const renderer = new FakeRenderer();
    const { app, data, id, H, uid } = await setup(renderer);
    const post = (payload?: unknown) => app.inject({ method: 'POST', url: `/api/projects/${id}/export`, headers: H, payload: payload as never });
    expect((await post({ platform: 'youtube' })).statusCode).toBe(200);
    expect((await post({ platform: 'instagram' })).statusCode).toBe(200);
    expect(renderer.platforms).toEqual(['youtube', 'instagram']);
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
  it("renders Claude's animation with the matching voiceover under it", async () => {
    const renderer = new FakeRenderer();
    const { app, data, audio, id, H, uid } = await setup(renderer);
    await audio.put(voicePath(uid, id, 0), Buffer.from('mp3'));
    await data.updateProject(uid, id, { voice: { voiceId: 'v', beats: [{ durationSec: 1, words: [] }], narrations: ['Ek second.'], createdAt: 'now' } });
    const res = await app.inject({ method: 'POST', url: `/api/projects/${id}/export`, headers: H });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ withVoice: true, job: { status: 'rendering' } });
    const input = renderer.started[0]!.input;
    expect(input.html).toContain('reel');
    expect(input.audio).toHaveLength(1);
    expect(input.audio[0]!.url).toMatch(/^data:audio\/mpeg/);
    expect(input.audio[0]!.at).toBeCloseTo(0.15);
    // 1 s of voice + lead and gap, then the 3 s end card.
    expect(input.duration).toBeCloseTo(1 + 0.15 + 0.35 + 3, 2);
    expect((await app.inject({ method: 'GET', url: `/api/projects/${id}/export`, headers: H })).json()).toMatchObject({ available: true, job: { progress: 0.4 } });
  });

  it('leaves out voiceover that no longer matches the narration', async () => {
    const renderer = new FakeRenderer();
    const { app, data, id, H, uid } = await setup(renderer);
    await data.updateProject(uid, id, { voice: { voiceId: 'v', beats: [{ durationSec: 1, words: [] }], narrations: ['Old line.'], createdAt: 'now' } });
    expect((await app.inject({ method: 'POST', url: `/api/projects/${id}/export`, headers: H })).json().withVoice).toBe(false);
    expect(renderer.started[0]!.input.audio).toEqual([]);
  });

  it('needs the animation first', async () => {
    const renderer = new FakeRenderer();
    const { app, data, id, H, uid } = await setup(renderer);
    await data.updateProject(uid, id, { script: { ...SCRIPT, animation: undefined } as never });
    const res = await app.inject({ method: 'POST', url: `/api/projects/${id}/export`, headers: H });
    expect(res.json()).toMatchObject({ error: 'no_animation' });
    expect(renderer.started).toHaveLength(0);
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

describe('HyperFrames pipeline', () => {
  it('swaps GSAP from any CDN for the local copy', () => {
    const html = '<script src="https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/gsap.min.js"></script><script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>';
    expect(localizeGsap(html, 'gsap.min.js')).toBe('<script src="gsap.min.js"></script><script src="gsap.min.js"></script>');
  });

  it('places each voice clip at its time, mixes them and levels the loudness', () => {
    const args = muxArgs('v.mp4', [{ file: 'a0', clip: { url: 'x', at: 0.15 } }, { file: 'a1', clip: { url: 'y', at: 4.5, from: 2, to: 6 } }, { file: 'm', clip: { url: 'z', at: 0, volume: 0.2, loop: true } }], 12, 'out.mp4');
    const graph = args[args.indexOf('-filter_complex') + 1]!;
    expect(graph).toContain('[1:a]aresample=48000,adelay=150|150');
    expect(graph).toContain('adelay=4500|4500');
    expect(graph).toContain('volume=0.200');
    expect(graph).toContain('amix=inputs=3');
    expect(graph).toContain('loudnorm=I=-14');
    expect(args).toContain('-stream_loop');
    expect(args.slice(args.indexOf('-ss'), args.indexOf('-ss') + 4)).toEqual(['-ss', '2.000', '-t', '4.000']);
    expect(args.at(-1)).toBe('out.mp4');
  });

  it('copies the silent video when there is no audio', () => {
    expect(muxArgs('v.mp4', [], 5, 'o.mp4')).toEqual(['-y', '-loglevel', 'error', '-i', 'v.mp4', '-c:v', 'copy', '-movflags', '+faststart', '-t', '5.000', 'o.mp4']);
  });
});
