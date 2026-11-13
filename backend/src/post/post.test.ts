import { randomBytes } from 'node:crypto';
import { describe, expect, it } from '@jest/globals';
import { buildApp } from '../app';
import { ConsoleMailer } from '../auth/mailer';
import { SessionTokens } from '../auth/session';
import { DevTokenVerifier } from '../auth/verifiers';
import { MemoryDataRepository } from '../data/repository';
import { MemoryAudioStore } from '../voice/audioStore';
import { autoStar, withCoverText, coverFontSize } from '../cover/overlay';
import { parsePost, PostError } from './post';

const secret = randomBytes(32).toString('base64');
const H = { authorization: 'Bearer dev:u1' };
const SCRIPT = { title: 'Tatkal ke 60 second', steps: ['Queue'], beats: [{ id: 'a', narration: 'Subah dus baje Tatkal khulta hai.', keywords: [], chapter: 0, card: { eyebrow: 'E', headline: 'H', tone: 'red', rows: [] } }] };
const ANSWER = '```json\n{"captions": ["Tatkal 10 baje kyun girta hai?\\nAsli wajah bots hain.", "Second one", "Third one"], "hashtags": ["#IRCTC", "tatkal booking", "#irctc", "#IndianRailways!", "#a"], "title": "IRCTC Tatkal kaise kaam karta hai #shorts"}\n```';

async function setup(platforms: string[] = ['instagram', 'youtube']) {
  const data = new MemoryDataRepository();
  const app = await buildApp({ data, audio: new MemoryAudioStore(), sessions: new SessionTokens(secret), mailer: new ConsoleMailer(false), verifier: new DevTokenVerifier(), authSecret: secret, webOrigin: 'http://localhost:5173', mode: 'memory' });
  const id = (await app.inject({ method: 'POST', url: '/api/projects', headers: H, payload: { title: 'Tatkal', topic: 'IRCTC Tatkal', durationSec: 45, qualityTier: 'draft', platforms } })).json().project.id as string;
  await data.updateProject('u1', id, { script: SCRIPT as never });
  return { app, data, id };
}

describe('parsePost', () => {
  it('for Instagram: cleans the hashtags (one #, no spaces, no repeats, no stubs) and keeps no title', () => {
    const post = parsePost(ANSWER, 'instagram', new Date('2026-11-12T00:00:00Z'));
    expect(post.captions).toHaveLength(3);
    expect(post.captions[0]).toContain('\n');
    expect(post.hashtags).toEqual(['#IRCTC', '#tatkalbooking', '#IndianRailways']);
    expect(post.title).toBeUndefined();
    expect(post.createdAt).toBe('2026-11-12T00:00:00.000Z');
  });
  it('for YouTube Shorts: #Shorts comes first, five hashtags at most, and the title carries no hashtag', () => {
    const many = JSON.stringify({ title: 'T', captions: ['d'], hashtags: ['#a1', '#b2', '#shorts', '#c3', '#d4', '#e5', '#f6'] });
    expect(parsePost(many, 'youtube').hashtags).toEqual(['#Shorts', '#a1', '#b2', '#c3', '#d4']);
    expect(parsePost(ANSWER, 'youtube').title).toBe('IRCTC Tatkal kaise kaam karta hai');
    expect(() => parsePost('{"captions":["a"],"hashtags":["#a1"],"title":""}', 'youtube')).toThrow(/title/);
  });
  it('keeps Hindi hashtags whole, and refuses an answer without captions', () => {
    expect(parsePost('{"captions":["a"],"hashtags":["#तत्काल_टिकट"]}', 'instagram').hashtags).toEqual(['#तत्काल_टिकट']);
    expect(() => parsePost('Sure! Here you go', 'instagram')).toThrow(PostError);
    expect(() => parsePost('{"captions": [], "hashtags": ["#a1"]}', 'instagram')).toThrow(PostError);
  });
});

describe('caption and hashtag routes', () => {
  it('writes a different prompt for each platform', async () => {
    const { app, id } = await setup();
    const get = async (q: string) => (await app.inject({ method: 'GET', url: `/api/projects/${id}/post/prompt${q}`, headers: H })).json();
    const ig = (await get('?platform=instagram')).prompt as string;
    const yt = (await get(`?platform=youtube&note=${encodeURIComponent('Keep it funny')}`)).prompt as string;
    expect(ig).toContain('Subah dus baje Tatkal khulta hai.');
    expect(ig).toContain('for Instagram Reels');
    expect(ig).toContain('FIRST FIVE');
    expect(ig).toContain('THREE COVER LINES');
    expect(yt).toContain('THREE COVER LINES');
    expect(ig).not.toContain('#Shorts');
    expect(yt).toContain('for YouTube Shorts');
    expect(yt).toContain('The first must be #Shorts');
    expect(yt).toContain('at most 60 characters');
    expect(yt).toContain('Keep it funny');
    // Without a platform, the reel's first one.
    expect((await get('')).platform).toBe('instagram');
  });

  it('saves each platform on its own, keeps both, and survives a storyboard save', async () => {
    const { app, id } = await setup();
    const imp = (platform: string) => app.inject({ method: 'POST', url: `/api/projects/${id}/post/import`, headers: H, payload: { text: ANSWER, platform } });
    expect((await imp('instagram')).json().project.script.post.instagram.hashtags).toEqual(['#IRCTC', '#tatkalbooking', '#IndianRailways']);
    const both = (await imp('youtube')).json().project.script;
    expect(both.post.youtube.hashtags[0]).toBe('#Shorts');
    expect(both.post.youtube.title).toBe('IRCTC Tatkal kaise kaam karta hai');
    expect(both.post.instagram.captions).toHaveLength(3);
    const saved = await app.inject({ method: 'PUT', url: `/api/projects/${id}/script`, headers: H, payload: { script: both } });
    expect(saved.json().project.script.post.youtube.title).toBe('IRCTC Tatkal kaise kaam karta hai');
  });

  it('refuses a platform the reel is not made for, says why a paste was refused, and keeps other people out', async () => {
    const { app, id } = await setup(['instagram']);
    expect((await app.inject({ method: 'GET', url: `/api/projects/${id}/post/prompt?platform=youtube`, headers: H })).json().error).toBe('invalid_platform');
    const bad = await app.inject({ method: 'POST', url: `/api/projects/${id}/post/import`, headers: H, payload: { text: 'hello', platform: 'instagram' } });
    expect(bad.statusCode).toBe(400);
    expect(bad.json().message).toMatch(/whole answer/);
    expect((await app.inject({ method: 'GET', url: `/api/projects/${id}/post/prompt`, headers: { authorization: 'Bearer dev:u2' } })).statusCode).toBe(404);
  });
});

describe('cover text', () => {
  const page = '<html><body><div id="root"></div></body></html>';
  it('puts the title and the handle over the frame, colours *starred* words, escapes them, and shrinks a long title', () => {
    const out = withCoverText(page, { headline: 'Tatkal *10 baje* <kyun>', handle: '@decodify_x', accent: '#FFD60A' });
    expect(out).toContain('<span class="mm-cv-hi">10 baje</span>');
    expect(out).toContain('&lt;kyun&gt;');
    expect(out).toContain('@decodify_x');
    expect(out.indexOf('mm-cv-h')).toBeLessThan(out.indexOf('</body>'));
    expect(coverFontSize('Short')).toBeGreaterThan(coverFontSize('A much longer cover headline that needs several lines to fit'));
  });
  it('sets the words in the middle for Instagram (grid crop) and high up for YouTube Shorts (its title covers the bottom)', () => {
    const ig = withCoverText(page, { headline: 'T', handle: '@x', accent: '#FFD60A', platform: 'instagram' });
    const yt = withCoverText(page, { headline: 'T', handle: '@x', accent: '#FFD60A', platform: 'youtube' });
    expect(ig).toContain('.mm-cv-box{position:absolute;left:78px;top:700px');
    expect(yt).toContain('.mm-cv-box{position:absolute;left:78px;top:250px');
  });
  it('always highlights something: your *starred* words, or else the number, or else the longest word', () => {
    expect(autoStar('Tatkal *kyun* girta hai')).toBe('Tatkal *kyun* girta hai');
    expect(autoStar('Tatkal 10 baje kyun girta hai?')).toBe('Tatkal *10 baje* kyun girta hai?');
    expect(autoStar('IRCTC ka asli raaz')).toBe('*IRCTC* ka asli raaz');
    expect(autoStar('UPI')).toBe('UPI');
  });
  it('adds the badge, and picks readable ink for the highlight (dark on a light accent, white on a dark one)', () => {
    const light = withCoverText(page, { headline: 'A *b*', handle: '@x', accent: '#FFD60A', kicker: 'Explained in 60 sec' });
    expect(light).toContain('Explained in 60 sec');
    expect(light).toContain('.mm-cv-hi{display:inline-block');
    expect(light).toMatch(/\.mm-cv-hi\{[^}]*color:#0a0b12/);
    expect(withCoverText(page, { headline: 'A *b*', handle: '@x', accent: '#1E3A8A' })).toMatch(/\.mm-cv-hi\{[^}]*color:#ffffff/);
    expect(withCoverText(page, { headline: 'A *b*', handle: '@x', accent: '#FFD60A' })).not.toContain('class="mm-cv-kick"');
  });
});

describe('cover lines from Claude', () => {
  it('are asked for in the prompt and kept with the post, cleaned', () => {
    const a = JSON.stringify({ captions: ['c'], hashtags: ['#a1'], covers: ['Tatkal *10 baje* kyun girta hai?', '  #IRCTC ka\nraaz  ', ''] });
    expect(parsePost(a, 'instagram').covers).toEqual(['Tatkal *10 baje* kyun girta hai?', 'IRCTC ka raaz']);
    expect(parsePost('{"captions":["c"],"hashtags":["#a1"]}', 'instagram').covers).toBeUndefined();
  });
});
