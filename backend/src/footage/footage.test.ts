import { randomBytes } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from '@jest/globals';
import type { FootageWord, TimeRange } from '@motionmind/shared';
import { buildApp } from '../app';
import { ConsoleMailer } from '../auth/mailer';
import { SessionTokens } from '../auth/session';
import { DevTokenVerifier } from '../auth/verifiers';
import { MemoryDataRepository } from '../data/repository';
import { assTime, captionsAss } from './captions';
import { FootageStore } from './store';
import { filterGraph, parseProbe, parseSilences, parseWhisper, type MediaTools, type RenderPlan } from './tools';

const secret = randomBytes(32).toString('base64');

class FakeTools implements MediaTools {
  rendered: RenderPlan[] = [];
  words: FootageWord[] | null = [
    { text: 'Hello', start: 0.5, end: 0.9 },
    { text: 'there', start: 3.2, end: 3.6 },
  ];
  async report() {
    return { ffmpeg: { ready: true, detail: 'ffmpeg 7' }, whisper: { ready: false, detail: 'missing' }, ytDlp: { ready: true, detail: '2026' } };
  }
  async probe(file: string) {
    if (file.endsWith('.avi')) throw new Error('not a video');
    return { durationSec: 6, width: 1080, height: 1920, hasAudio: true };
  }
  async silences(): Promise<TimeRange[]> {
    return [{ start: 1, end: 3 }];
  }
  async transcribe() {
    return { words: this.words, note: this.words ? null : 'Captions need whisper.cpp.' };
  }
  async render(plan: RenderPlan) {
    this.rendered.push(plan);
    writeFileSync(path.join(plan.cwd, plan.output), 'mp4');
  }
}

async function setup() {
  const tools = new FakeTools();
  const store = new FootageStore(mkdtempSync(path.join(os.tmpdir(), 'mm-footage-')));
  const app = await buildApp({ data: new MemoryDataRepository(), footage: { store, tools }, sessions: new SessionTokens(secret), mailer: new ConsoleMailer(false), verifier: new DevTokenVerifier(), authSecret: secret, webOrigin: 'http://localhost:5173', mode: 'memory' });
  const H = { authorization: 'Bearer dev:user-1' };
  return { app, tools, store, H };
}

const waitDone = async (app: Awaited<ReturnType<typeof setup>>['app'], id: string, H: Record<string, string>) => {
  for (let i = 0; i < 100; i++) {
    const res = (await app.inject({ method: 'GET', url: `/api/footage/${id}`, headers: H })).json();
    if (res.edit.job?.status !== 'running') return res;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error('job never finished');
};

const upload = (app: Awaited<ReturnType<typeof setup>>['app'], H: Record<string, string>, name = 'my%20clip.mp4') =>
  app.inject({ method: 'POST', url: '/api/footage', headers: { ...H, 'content-type': 'video/mp4', 'x-file-name': name }, payload: Buffer.from('fake video bytes') });

describe('footage routes', () => {
  it('upload, analyze, review, approve and export a clip', async () => {
    const { app, tools, H } = await setup();
    const up = await upload(app, H);
    expect(up.statusCode).toBe(200);
    const id = up.json().edit.id as string;
    expect(up.json().edit.name).toBe('my clip');

    const done = await waitDone(app, id, H);
    expect(done.edit.job.status).toBe('done');
    expect(done.edit.segments).toEqual([
      { start: 0, end: 1.05, keep: true },
      { start: 2.95, end: 6, keep: true },
    ]);
    expect(done.edit.words).toHaveLength(2);
    expect(done.sourceUrl).toBe(`/api/footage-files/${id}/source.mp4`);

    // Export needs an approved storyboard.
    expect((await app.inject({ method: 'POST', url: `/api/footage/${id}/export`, headers: H })).json().error).toBe('not_approved');

    const settings = { minPause: 0.1, padSec: 0.05, captions: true, captionPosition: 'lower' };
    const bad = await app.inject({ method: 'PUT', url: `/api/footage/${id}`, headers: H, payload: { settings, segments: [{ start: 3, end: 6, keep: true }, { start: 0, end: 1, keep: true }], approved: true } });
    expect(bad.json().error).toBe('invalid_segments');
    const saved = await app.inject({ method: 'PUT', url: `/api/footage/${id}`, headers: H, payload: { settings, segments: [{ start: 0, end: 1.05, keep: false }, { start: 2.95, end: 6, keep: true }], approved: true } });
    expect(saved.statusCode).toBe(200);
    expect(saved.json().edit.approvedAt).toBeTruthy();

    expect((await app.inject({ method: 'POST', url: `/api/footage/${id}/export`, headers: H })).statusCode).toBe(200);
    const exported = await waitDone(app, id, H);
    expect(exported.edit.job.status).toBe('done');
    expect(tools.rendered[0]!.kept).toEqual([{ start: 2.95, end: 6 }]);
    // Only "there" survives the cut, so captions are written.
    expect(tools.rendered[0]!.captions).toBe('captions.ass');
    expect(exported.outputUrl).toMatch(/\/api\/footage-files\/.+\/out-.+\.mp4$/);

    // The file route reads edit.json, which is written just after the job reports done.
    await new Promise((r) => setTimeout(r, 50));
    const file = await app.inject({ method: 'GET', url: exported.outputUrl, headers: { range: 'bytes=0-1' } });
    expect(file.statusCode).toBe(206);
    expect(file.body).toBe('mp');
  });

  it("keeps each user's edits to themselves", async () => {
    const { app, H } = await setup();
    const id = (await upload(app, H)).json().edit.id as string;
    await waitDone(app, id, H);
    const other = { authorization: 'Bearer dev:user-2' };
    expect((await app.inject({ method: 'GET', url: `/api/footage/${id}`, headers: other })).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: '/api/footage', headers: other })).json().edits).toEqual([]);
    expect((await app.inject({ method: 'DELETE', url: `/api/footage/${id}`, headers: other })).statusCode).toBe(404);
    expect((await app.inject({ method: 'DELETE', url: `/api/footage/${id}`, headers: H })).statusCode).toBe(200);
  });

  it('turns away files that are not videos', async () => {
    const { app, H } = await setup();
    expect((await upload(app, H, 'notes.txt')).json().error).toBe('not_video');
    expect((await upload(app, H, 'broken.avi')).json().error).toBe('not_video');
  });

  it('says why there are no captions when whisper.cpp is missing', async () => {
    const { app, tools, H } = await setup();
    tools.words = null;
    const id = (await upload(app, H)).json().edit.id as string;
    const done = await waitDone(app, id, H);
    expect(done.edit.words).toBeNull();
    expect(done.edit.transcriptNote).toMatch(/whisper/);
  });

  it('answers 501 without the tools', async () => {
    const app = await buildApp({ data: new MemoryDataRepository(), sessions: new SessionTokens(secret), mailer: new ConsoleMailer(false), verifier: new DevTokenVerifier(), authSecret: secret, webOrigin: 'http://localhost:5173', mode: 'memory' });
    const H = { authorization: 'Bearer dev:user-1' };
    expect((await app.inject({ method: 'GET', url: '/api/footage/tools', headers: H })).json().available).toBe(false);
    expect((await upload(app, H)).statusCode).toBe(501);
  });
});

describe('tool output parsing', () => {
  it('reads FFmpeg silencedetect lines, closing a silence that runs to the end', () => {
    const log = '[silencedetect @ 0x1] silence_start: 1.2\n[silencedetect @ 0x1] silence_end: 2.5 | silence_duration: 1.3\n[silencedetect @ 0x1] silence_start: 9.1\n';
    expect(parseSilences(log, 10)).toEqual([{ start: 1.2, end: 2.5 }, { start: 9.1, end: 10 }]);
  });

  it('reads FFprobe and swaps the size of a rotated phone clip', () => {
    const json = JSON.stringify({ format: { duration: '12.5' }, streams: [{ codec_type: 'video', width: 1920, height: 1080, side_data_list: [{ rotation: -90 }] }, { codec_type: 'audio' }] });
    expect(parseProbe(json)).toEqual({ durationSec: 12.5, width: 1080, height: 1920, hasAudio: true });
  });

  it('reads whisper.cpp words, skipping markers', () => {
    const json = JSON.stringify({ transcription: [{ offsets: { from: 0, to: 400 }, text: ' Namaste' }, { offsets: { from: 400, to: 900 }, text: ' [BLANK_AUDIO]' }, { offsets: { from: 900, to: 1200 }, text: ' dosto' }] });
    expect(parseWhisper(json)).toEqual([{ text: 'Namaste', start: 0, end: 0.4 }, { text: 'dosto', start: 0.9, end: 1.2 }]);
  });

  it('builds a filter graph that joins the kept takes into a vertical frame with captions', () => {
    const g = filterGraph({ kept: [{ start: 0, end: 1 }, { start: 2, end: 3 }], hasAudio: true, captions: 'captions.ass' });
    expect(g).toContain('[v0][a0][v1][a1]concat=n=2:v=1:a=1[vc][ac]');
    expect(g).toContain('crop=1080:1920');
    expect(g).toContain('subtitles=captions.ass[vout]');
  });
});

describe('captions', () => {
  it('writes ASS times and one event per spoken word with that word highlighted', () => {
    expect(assTime(3661.25)).toBe('1:01:01.25');
    const ass = captionsAss([{ text: 'Hello', start: 0, end: 0.4 }, { text: 'world', start: 0.5, end: 0.9 }], 'lower');
    const events = ass.split('\n').filter((l) => l.startsWith('Dialogue'));
    expect(events).toHaveLength(2);
    expect(events[1]).toContain('Hello {\\c&H00FA8BA7&}world');
  });
});
