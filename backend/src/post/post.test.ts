import { randomBytes } from 'node:crypto';
import { describe, expect, it } from '@jest/globals';
import { buildApp } from '../app';
import { ConsoleMailer } from '../auth/mailer';
import { SessionTokens } from '../auth/session';
import { DevTokenVerifier } from '../auth/verifiers';
import { MemoryDataRepository } from '../data/repository';
import { MemoryAudioStore } from '../voice/audioStore';
import { withCoverText, coverFontSize } from '../cover/overlay';
import { parsePost, PostError } from './post';

const secret = randomBytes(32).toString('base64');
const H = { authorization: 'Bearer dev:u1' };
const SCRIPT = { title: 'Tatkal ke 60 second', steps: ['Queue'], beats: [{ id: 'a', narration: 'Subah dus baje Tatkal khulta hai.', keywords: [], chapter: 0, card: { eyebrow: 'E', headline: 'H', tone: 'red', rows: [] } }] };
const ANSWER = '```json\n{"captions": ["Tatkal 10 baje kyun girta hai?\\nAsli wajah bots hain.", "Second one", "Third one"], "hashtags": ["#IRCTC", "tatkal booking", "#irctc", "#IndianRailways!", "#a"], "title": "IRCTC Tatkal kaise kaam karta hai"}\n```';

async function setup() {
  const data = new MemoryDataRepository();
  const app = await buildApp({ data, audio: new MemoryAudioStore(), sessions: new SessionTokens(secret), mailer: new ConsoleMailer(false), verifier: new DevTokenVerifier(), authSecret: secret, webOrigin: 'http://localhost:5173', mode: 'memory' });
  const id = (await app.inject({ method: 'POST', url: '/api/projects', headers: H, payload: { title: 'Tatkal', topic: 'IRCTC Tatkal', durationSec: 45, qualityTier: 'draft', platforms: ['instagram', 'youtube'] } })).json().project.id as string;
  return { app, data, id };
}

describe('parsePost', () => {
  it('reads the captions, cleans the hashtags (one #, no spaces, no repeats, no stubs) and keeps the title', () => {
    const post = parsePost(ANSWER, new Date('2026-11-12T00:00:00Z'));
    expect(post.captions).toHaveLength(3);
    expect(post.captions[0]).toContain('\n');
    expect(post.hashtags).toEqual(['#IRCTC', '#tatkalbooking', '#IndianRailways']);
    expect(post.title).toBe('IRCTC Tatkal kaise kaam karta hai');
    expect(post.createdAt).toBe('2026-11-12T00:00:00.000Z');
  });
  it('keeps Hindi hashtags whole, and refuses an answer without captions', () => {
    expect(parsePost('{"captions":["a"],"hashtags":["#तत्काल_टिकट"]}').hashtags).toEqual(['#तत्काल_टिकट']);
    expect(() => parsePost('Sure! Here you go')).toThrow(PostError);
    expect(() => parsePost('{"captions": [], "hashtags": ["#a1"]}')).toThrow(PostError);
  });
});

describe('caption and hashtag routes', () => {
  it('gives a prompt with the narration, the platforms and the handle, then saves the pasted answer with the script', async () => {
    const { app, data, id } = await setup();
    expect((await app.inject({ method: 'GET', url: `/api/projects/${id}/post/prompt`, headers: H })).json().error).toBe('no_script');
    await data.updateProject('u1', id, { script: SCRIPT as never });
    const prompt = (await app.inject({ method: 'GET', url: `/api/projects/${id}/post/prompt?note=${encodeURIComponent('Keep it funny')}`, headers: H })).json().prompt as string;
    expect(prompt).toContain('Subah dus baje Tatkal khulta hai.');
    expect(prompt).toContain('Instagram Reels and YouTube Shorts');
    expect(prompt).toContain('A TITLE for YouTube Shorts');
    expect(prompt).toContain('search the web');
    expect(prompt).toContain('Keep it funny');
    const res = await app.inject({ method: 'POST', url: `/api/projects/${id}/post/import`, headers: H, payload: { text: ANSWER } });
    expect(res.statusCode).toBe(200);
    expect(res.json().project.script.post.hashtags).toEqual(['#IRCTC', '#tatkalbooking', '#IndianRailways']);
    // Saving the storyboard afterwards keeps it.
    const script = res.json().project.script;
    const saved = await app.inject({ method: 'PUT', url: `/api/projects/${id}/script`, headers: H, payload: { script } });
    expect(saved.json().project.script.post.captions).toHaveLength(3);
  });

  it('says why a paste was refused, and keeps other people out', async () => {
    const { app, data, id } = await setup();
    await data.updateProject('u1', id, { script: SCRIPT as never });
    const bad = await app.inject({ method: 'POST', url: `/api/projects/${id}/post/import`, headers: H, payload: { text: 'hello' } });
    expect(bad.statusCode).toBe(400);
    expect(bad.json().message).toMatch(/whole answer/);
    expect((await app.inject({ method: 'GET', url: `/api/projects/${id}/post/prompt`, headers: { authorization: 'Bearer dev:u2' } })).statusCode).toBe(404);
  });
});

describe('cover text', () => {
  it('puts the title and the handle over the frame, colours *starred* words, escapes them, and shrinks a long title', () => {
    const out = withCoverText('<html><body><div id="root"></div></body></html>', { headline: 'Tatkal *10 baje* <kyun>', handle: '@decodify_x', accent: '#FFD60A' });
    expect(out).toContain('<span class="mm-cv-hi">10 baje</span>');
    expect(out).toContain('&lt;kyun&gt;');
    expect(out).toContain('@decodify_x');
    expect(out.indexOf('mm-cv-h')).toBeLessThan(out.indexOf('</body>'));
    expect(coverFontSize('Short')).toBeGreaterThan(coverFontSize('A much longer cover headline that needs several lines to fit'));
  });
});
