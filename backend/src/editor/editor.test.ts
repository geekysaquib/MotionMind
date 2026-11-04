import { randomBytes } from 'node:crypto';
import { describe, expect, it } from '@jest/globals';
import { buildApp } from '../app';
import { ConsoleMailer } from '../auth/mailer';
import { SessionTokens } from '../auth/session';
import { DevTokenVerifier } from '../auth/verifiers';
import { MemoryDataRepository } from '../data/repository';
import { MemoryAudioStore } from '../voice/audioStore';
import { reelSpecFor } from '../export/routes';
import { cleanFileName, sniffAudio } from './audioFormat';

const secret = randomBytes(32).toString('base64');
const H = { authorization: 'Bearer dev:u1' };
const OTHER = { authorization: 'Bearer dev:u2' };

const beat = (id: string, narration: string) => ({ id, narration, keywords: [], chapter: 0, card: { eyebrow: 'E', headline: 'H', tone: 'teal', rows: [] } });
const SCRIPT = { title: 'UPI', steps: ['App'], beats: [beat('a', 'Ek second mein.'), beat('b', 'NPCI beech mein.'), beat('c', 'Done.')] };

const mp3 = () => Buffer.concat([Buffer.from('ID3'), Buffer.alloc(40, 1)]);

async function setup() {
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
  });
  const created = await app.inject({ method: 'POST', url: '/api/projects', headers: H, payload: { title: 'UPI', topic: 'UPI', durationSec: 30, qualityTier: 'draft' } });
  const id = created.json().project.id as string;
  await data.updateProject('u1', id, { script: SCRIPT as never, stage: 'storyboard' });
  return { app, data, audio, id };
}

const upload = (app: Awaited<ReturnType<typeof setup>>['app'], id: string, kind: string, body: Buffer, headers = H) =>
  app.inject({ method: 'POST', url: `/api/projects/${id}/audio/${kind}`, headers: { ...headers, 'content-type': 'application/octet-stream', 'x-file-name': 'my%20voice.mp3' }, payload: body });

const editorFor = (track: { path: string }, cuts = [3, 7]) => ({
  voiceSource: 'upload',
  upload: { track: { path: track.path, fileName: 'my voice.mp3', mime: 'audio/mpeg', durationSec: 10, peaks: [1, 50, 99] }, cuts },
  pace: 1.1,
  scenePace: [1, 0.9, 1],
  music: null,
  captions: { size: 'medium', position: 'bottom', look: 'box' },
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
    expect(get.json().editor.pace).toBe(1.1);
  });

  it('saves again what the page loaded, including the old save time, and stamps a new one', async () => {
    const { app, id } = await setup();
    const track = (await upload(app, id, 'voice', mp3())).json().track;
    const first = await app.inject({ method: 'PUT', url: `/api/projects/${id}/editor`, headers: H, payload: { editor: editorFor(track) } });
    const loaded = (await app.inject({ method: 'GET', url: `/api/projects/${id}/editor`, headers: H })).json().editor;
    expect(loaded.updatedAt).toBeTruthy();
    const again = await app.inject({ method: 'PUT', url: `/api/projects/${id}/editor`, headers: H, payload: { editor: { ...loaded, pace: 1.2, updatedAt: '2000-01-01T00:00:00.000Z' } } });
    expect(again.statusCode).toBe(200);
    expect(again.json().project.editor.pace).toBe(1.2);
    expect(again.json().project.editor.updatedAt).not.toBe('2000-01-01T00:00:00.000Z');
    expect(first.statusCode).toBe(200);
  });

  it('refuses audio from another project, cuts out of order, and a cut count that does not match the scenes', async () => {
    const { app, id } = await setup();
    const track = (await upload(app, id, 'voice', mp3())).json().track;
    const put = (editor: unknown) => app.inject({ method: 'PUT', url: `/api/projects/${id}/editor`, headers: H, payload: { editor } });
    expect((await put(editorFor({ path: `u2/${id}/voice-x.mp3` }))).statusCode).toBe(400);
    expect((await put(editorFor(track, [7, 3]))).statusCode).toBe(400);
    expect((await put(editorFor(track, [3]))).statusCode).toBe(400);
    expect((await put({ ...editorFor(track), pace: 5 })).statusCode).toBe(400);
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

  it('puts the upload, pace and captions into the export spec', async () => {
    const { app, data, audio, id } = await setup();
    const track = (await upload(app, id, 'voice', mp3())).json().track;
    await app.inject({ method: 'PUT', url: `/api/projects/${id}/editor`, headers: H, payload: { editor: editorFor(track) } });
    const project = (await data.getProject('u1', id))!;
    const { spec, withVoice } = await reelSpecFor({ data, audio } as never, 'u1', project);
    expect(withVoice).toBe(true);
    expect(spec.voiceTrack).toMatchObject({ durationSec: 10, cuts: [3, 7] });
    expect(spec.pace).toBe(1.1);
    expect(spec.scenePace).toEqual([1, 0.9, 1]);
    expect(spec.captions).toMatchObject({ size: 'medium' });
    expect(spec.audioUrls).toBeUndefined();
  });
});
