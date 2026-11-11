import { randomBytes } from 'node:crypto';
import { describe, expect, it } from '@jest/globals';
import { buildApp } from '../app';
import { ConsoleMailer } from '../auth/mailer';
import { SessionTokens } from '../auth/session';
import { DevTokenVerifier } from '../auth/verifiers';
import { MemoryDataRepository } from '../data/repository';
import { MemoryAudioStore } from '../voice/audioStore';
import type { MediaTools } from '../footage/tools';
import { htmlRenderFor } from '../export/routes';
import { narrationKey } from '@motionmind/shared';
import { cleanFileName, sniffAudio } from './audioFormat';

const secret = randomBytes(32).toString('base64');
const H = { authorization: 'Bearer dev:u1' };
const OTHER = { authorization: 'Bearer dev:u2' };

const beat = (id: string, narration: string) => ({ id, narration, keywords: [], chapter: 0, card: { eyebrow: 'E', headline: 'H', tone: 'teal', rows: [] } });
const SCRIPT = { title: 'UPI', steps: ['App'], beats: [beat('a', 'Ek second mein.'), beat('b', 'NPCI beech mein.'), beat('c', 'Done.')] };

const mp3 = () => Buffer.concat([Buffer.from('ID3'), Buffer.alloc(40, 1)]);

async function setup(tools?: Partial<MediaTools>) {
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
    ...(tools ? { footage: { store: {} as never, tools: tools as MediaTools } } : {}),
  });
  const created = await app.inject({ method: 'POST', url: '/api/projects', headers: H, payload: { title: 'UPI', topic: 'UPI', durationSec: 30, qualityTier: 'draft' } });
  const id = created.json().project.id as string;
  await data.updateProject('u1', id, { script: SCRIPT as never, stage: 'storyboard' });
  return { app, data, audio, id };
}

const upload = (app: Awaited<ReturnType<typeof setup>>['app'], id: string, kind: string, body: Buffer, headers = H) =>
  app.inject({ method: 'POST', url: `/api/projects/${id}/audio/${kind}`, headers: { ...headers, 'content-type': 'application/octet-stream', 'x-file-name': 'my%20voice.mp3' }, payload: body });

const editorFor = (track: { path: string }, cuts = [3, 7]) => ({
  upload: { track: { path: track.path, fileName: 'my voice.mp3', mime: 'audio/mpeg', durationSec: 10, peaks: [1, 50, 99] }, cuts },
  music: null,
});

describe('audio format', () => {
  it('recognises audio from its bytes and rejects the rest', () => {
    expect(sniffAudio(mp3())?.mime).toBe('audio/mpeg');
    expect(sniffAudio(Buffer.concat([Buffer.from('RIFF....WAVE'), Buffer.alloc(8)]))?.ext).toBe('wav');
    expect(sniffAudio(Buffer.concat([Buffer.from('OggS'), Buffer.alloc(20)]))?.ext).toBe('ogg');
    expect(sniffAudio(Buffer.from('<html>not audio at all</html>'))).toBeNull();
    expect(cleanFileName('../../a%20b.mp3')).toBe('.._.._a b.mp3');
    expect(cleanFileName(undefined)).toBe('audio');
  });
});

describe('reel editor routes', () => {
  it('stores an upload under the user and project, and tells the audio type from its bytes', async () => {
    const { app, id } = await setup();
    const res = await upload(app, id, 'voice', mp3());
    expect(res.statusCode).toBe(200);
    expect(res.json().track.path).toMatch(new RegExp(`^u1/${id}/voice-.*\\.mp3$`));
    expect(res.json().track.mime).toBe('audio/mpeg');
    expect(res.json().track.fileName).toBe('my voice.mp3');
    expect(res.json().url).toBeTruthy();
  });

  it('rejects files that are not audio, empty bodies and other people\'s projects', async () => {
    const { app, id } = await setup();
    expect((await upload(app, id, 'voice', Buffer.from('hello world, definitely text'))).statusCode).toBe(400);
    expect((await upload(app, id, 'voice', Buffer.alloc(0))).statusCode).toBe(400);
    expect((await upload(app, id, 'other', mp3())).statusCode).toBe(404);
    expect((await upload(app, id, 'voice', mp3(), OTHER)).statusCode).toBe(404);
  });

  it('saves the editor, moves the project to the voice stage and returns playable urls', async () => {
    const { app, id } = await setup();
    const track = (await upload(app, id, 'voice', mp3())).json().track;
    const put = await app.inject({ method: 'PUT', url: `/api/projects/${id}/editor`, headers: H, payload: { editor: editorFor(track) } });
    expect(put.statusCode).toBe(200);
    expect(put.json().project.editor.updatedAt).toBeTruthy();
    expect(put.json().project.stage).toBe('voice');
    expect(put.json().urls.voice).toBeTruthy();
    const get = await app.inject({ method: 'GET', url: `/api/projects/${id}/editor`, headers: H });
    expect(get.json().editor.upload.cuts).toEqual([3, 7]);
  });

  it('saves again what the page loaded, including the old save time, and stamps a new one', async () => {
    const { app, id } = await setup();
    const track = (await upload(app, id, 'voice', mp3())).json().track;
    const first = await app.inject({ method: 'PUT', url: `/api/projects/${id}/editor`, headers: H, payload: { editor: editorFor(track) } });
    const loaded = (await app.inject({ method: 'GET', url: `/api/projects/${id}/editor`, headers: H })).json().editor;
    expect(loaded.updatedAt).toBeTruthy();
    const again = await app.inject({ method: 'PUT', url: `/api/projects/${id}/editor`, headers: H, payload: { editor: { ...loaded, music: null, updatedAt: '2000-01-01T00:00:00.000Z' } } });
    expect(again.statusCode).toBe(200);
        expect(again.json().project.editor.updatedAt).not.toBe('2000-01-01T00:00:00.000Z');
    expect(first.statusCode).toBe(200);
  });

  it('saves the follow line start, and refuses one that is out of range', async () => {
    const { app, id } = await setup();
    const track = (await upload(app, id, 'voice', mp3())).json().track;
    const put = (closingAt: number | null) => {
      const e = editorFor(track);
      return app.inject({ method: 'PUT', url: `/api/projects/${id}/editor`, headers: H, payload: { editor: { ...e, upload: { ...e.upload, closingAt } } } });
    };
    // editorFor cuts at 3 and 7 in a 10 second recording
    const ok = await put(8.5);
    expect(ok.statusCode).toBe(200);
    expect(ok.json().project.editor.upload.closingAt).toBe(8.5);
    expect((await put(7.1)).statusCode).toBe(400);
    expect((await put(9.9)).statusCode).toBe(400);
    expect((await put(null)).statusCode).toBe(200);
  });

  it('saves a trimmed recording, and refuses a trim that cuts into a scene or leaves under a second', async () => {
    const { app, id } = await setup();
    const track = (await upload(app, id, 'voice', mp3())).json().track;
    const put = (trimStart: number | null, trimEnd: number | null) => {
      const e = editorFor(track);
      return app.inject({ method: 'PUT', url: `/api/projects/${id}/editor`, headers: H, payload: { editor: { ...e, upload: { ...e.upload, trimStart, trimEnd } } } });
    };
    // editorFor cuts at 3 and 7 in a 10 second recording
    const ok = await put(1, 9);
    expect(ok.statusCode).toBe(200);
    expect(ok.json().project.editor.upload).toMatchObject({ trimStart: 1, trimEnd: 9 });
    expect((await put(3.1, 9)).statusCode).toBe(400); // starts after the first break
    expect((await put(0, 6.9)).statusCode).toBe(400); // ends before the last break
    expect((await put(0, 99)).statusCode).toBe(400); // longer than the file
    expect((await put(null, null)).statusCode).toBe(200);
  });

  it('refuses audio from another project, cuts out of order, and a cut count that does not match the scenes', async () => {
    const { app, id } = await setup();
    const track = (await upload(app, id, 'voice', mp3())).json().track;
    const put = (editor: unknown) => app.inject({ method: 'PUT', url: `/api/projects/${id}/editor`, headers: H, payload: { editor } });
    expect((await put(editorFor({ path: `u2/${id}/voice-x.mp3` }))).statusCode).toBe(400);
    expect((await put(editorFor(track, [7, 3]))).statusCode).toBe(400);
    expect((await put(editorFor(track, [3]))).statusCode).toBe(400);
  });

  it('deletes the old recording when it is replaced', async () => {
    const { app, audio, id } = await setup();
    const first = (await upload(app, id, 'voice', mp3())).json().track;
    await app.inject({ method: 'PUT', url: `/api/projects/${id}/editor`, headers: H, payload: { editor: editorFor(first) } });
    const second = (await upload(app, id, 'voice', mp3())).json().track;
    await app.inject({ method: 'PUT', url: `/api/projects/${id}/editor`, headers: H, payload: { editor: editorFor(second) } });
    const [a, b] = await audio.urls([first.path, second.path]);
    expect(a).toBeFalsy();
    expect(b).toBeTruthy();
  });

  it("deletes all of a project's files from storage when the project is deleted, and nobody else's", async () => {
    const { app, audio, id } = await setup();
    const voice = (await upload(app, id, 'voice', mp3())).json().track;
    const music = (await upload(app, id, 'music', mp3())).json().track;
    // A stray file in the project's folder (for example from a replaced recording that failed to delete) goes too.
    await audio.put(`u1/${id}/stray.mp3`, mp3());
    // Another project of the same person keeps its files.
    const other = (await app.inject({ method: 'POST', url: '/api/projects', headers: H, payload: { title: 'Other', topic: 'x', durationSec: 30, qualityTier: 'draft' } })).json().project.id as string;
    const keep = (await upload(app, other, 'voice', mp3())).json().track;
    await app.inject({ method: 'PUT', url: `/api/projects/${id}/editor`, headers: H, payload: { editor: { ...editorFor(voice), music: { track: { path: music.path, fileName: 'm.mp3', mime: 'audio/mpeg', durationSec: 10 }, volume: 0.2 } } } });
    expect((await app.inject({ method: 'DELETE', url: `/api/projects/${id}`, headers: OTHER })).statusCode).toBe(404);
    expect((await audio.urls([voice.path]))[0]).toBeTruthy();
    expect((await app.inject({ method: 'DELETE', url: `/api/projects/${id}`, headers: H })).statusCode).toBe(200);
    expect(await audio.urls([voice.path, music.path, `u1/${id}/stray.mp3`])).toEqual(['', '', '']);
    expect((await audio.urls([keep.path]))[0]).toBeTruthy();
  });

  it("lays the user's own recording under the animation when it is exported", async () => {
    const { app, data, audio, id } = await setup();
    const track = (await upload(app, id, 'voice', mp3())).json().track;
    await app.inject({ method: 'PUT', url: `/api/projects/${id}/editor`, headers: H, payload: { editor: editorFor(track) } });
    let project = (await data.getProject('u1', id))!;
    project = (await data.updateProject('u1', id, { script: { ...project.script!, animation: { html: '<html></html>', timingKey: 'x', writtenAt: 'now' } } }))!;
    const { input, withVoice } = await htmlRenderFor({ data, audio } as never, project);
    expect(withVoice).toBe(true);
    expect(input.audio).toHaveLength(1);
    expect(input.audio[0]).toMatchObject({ at: 0, from: 0, to: 10 });
    expect(input.duration).toBeCloseTo(10 + 3, 1);
  });

  describe('auto-fit', () => {
    // 3 scenes: 'Ek second mein.' (3 words), 'NPCI beech mein.' (3), 'Done.' (1). Speech in three bursts with pauses between.
    const WORDS = [
      [0.4, 0.8], [0.85, 1.3], [1.35, 1.9],
      [3.2, 3.7], [3.75, 4.2], [4.25, 4.7],
      [6.6, 7.4],
    ];
    const heard = (words = WORDS) => ({ words: words.map(([start, end], i) => ({ text: 'w' + i, start: start!, end: end! })), note: null });

    async function withRecording(tools?: Partial<MediaTools>, peaks?: number[]) {
      const ctx = await setup(tools);
      const track = (await upload(ctx.app, ctx.id, 'voice', mp3())).json().track;
      const ed = editorFor(track, [3, 7]);
      if (peaks) ed.upload.track.peaks = peaks;
      await ctx.app.inject({ method: 'PUT', url: `/api/projects/${ctx.id}/editor`, headers: H, payload: { editor: ed } });
      return ctx;
    }

    it('finds the scene breaks and every word from the words whisper heard, and saves them', async () => {
      const { app, id } = await withRecording({ transcribe: async () => heard() });
      const res = await app.inject({ method: 'POST', url: `/api/projects/${id}/voice/fit`, headers: H });
      expect(res.json()).toMatchObject({ fit: 'speech' });
      const up = res.json().project.editor.upload;
      // The breaks sit in the pauses (1.9 to 3.2 and 4.7 to 6.6), just before the next scene's first word.
      expect(up.cuts[0]).toBeGreaterThan(1.9);
      expect(up.cuts[0]).toBeLessThanOrEqual(3.2);
      expect(up.cuts[1]).toBeGreaterThan(4.7);
      expect(up.cuts[1]).toBeLessThanOrEqual(6.6);
      expect(up.wordTimes).toHaveLength(7);
      expect(up.wordTimes[0][0]).toBeCloseTo(0.4, 1);
      expect(up.wordTimes[6][1]).toBeCloseTo(7.4, 1);
      expect(up.fitKey).toBe(narrationKey(SCRIPT.beats.map((b) => b.narration)));
    });

    it('falls back to the loudness of the recording without whisper, and says so', async () => {
      // 20 peaks per second, 10 s: loud at 0.4 to 1.9 s, 3.2 to 4.7 s and 6.6 to 7.4 s.
      const peaks = Array.from({ length: 200 }, (_, i) => {
        const t = i / 20;
        return (t >= 0.4 && t < 1.9) || (t >= 3.2 && t < 4.7) || (t >= 6.6 && t < 7.4) ? 80 : 1;
      });
      const { app, id } = await withRecording(undefined, peaks);
      const res = await app.inject({ method: 'POST', url: `/api/projects/${id}/voice/fit`, headers: H });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ fit: 'loudness', note: expect.stringMatching(/whisper/) });
      const up = res.json().project.editor.upload;
      expect(up.cuts[0]).toBeGreaterThan(1.9);
      expect(up.cuts[0]).toBeLessThanOrEqual(3.2);
      expect(up.wordTimes).toHaveLength(7);
    });

    it('uses the loudness when whisper hears too little or fails', async () => {
      const peaks = Array.from({ length: 200 }, (_, i) => (i > 10 && i < 150 ? 70 : 1));
      const few = await withRecording({ transcribe: async () => ({ words: [], note: 'whisper.cpp heard no words in this clip.' }) }, peaks);
      expect((await few.app.inject({ method: 'POST', url: `/api/projects/${few.id}/voice/fit`, headers: H })).json().fit).toBe('loudness');
      const broken = await withRecording({ transcribe: async () => { throw new Error('boom'); } }, peaks);
      expect((await broken.app.inject({ method: 'POST', url: `/api/projects/${broken.id}/voice/fit`, headers: H })).json().fit).toBe('loudness');
    });

    it('needs a script and a recording, hears nothing in silence, and keeps to the owner', async () => {
      const none = await setup();
      expect((await none.app.inject({ method: 'POST', url: `/api/projects/${none.id}/voice/fit`, headers: H })).json().error).toBe('no_recording');
      const silent = await withRecording(undefined, Array.from({ length: 200 }, () => 0));
      expect((await silent.app.inject({ method: 'POST', url: `/api/projects/${silent.id}/voice/fit`, headers: H })).json().error).toBe('no_speech');
      const { app, id } = await withRecording({ transcribe: async () => heard() });
      expect((await app.inject({ method: 'POST', url: `/api/projects/${id}/voice/fit`, headers: OTHER })).statusCode).toBe(404);
    });
  });
});
