import { randomBytes } from 'node:crypto';
import { describe, expect, it } from '@jest/globals';
import { buildApp } from '../app';
import { ConsoleMailer } from '../auth/mailer';
import { SessionTokens } from '../auth/session';
import { DevTokenVerifier } from '../auth/verifiers';
import { MemoryDataRepository } from '../data/repository';
import { MemoryAudioStore } from '../voice/audioStore';
import { withEndCard } from '../animation/endCard';
import { withCoverText } from '../cover/overlay';
import { logoDataUrl, sniffImage } from './logo';

const secret = randomBytes(32).toString('base64');
const H = { authorization: 'Bearer dev:u1' };
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(40, 7)]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(40, 7)]);

async function setup() {
  const audio = new MemoryAudioStore();
  const app = await buildApp({ data: new MemoryDataRepository(), audio, sessions: new SessionTokens(secret), mailer: new ConsoleMailer(false), verifier: new DevTokenVerifier(), authSecret: secret, webOrigin: 'http://localhost:5173', mode: 'memory' });
  return { app, audio };
}
const upload = (app: Awaited<ReturnType<typeof setup>>['app'], body: Buffer, headers = H) => app.inject({ method: 'POST', url: '/api/profile/logo', headers: { ...headers, 'content-type': 'application/octet-stream' }, payload: body });

describe('sniffImage', () => {
  it('recognises PNG, JPEG and WebP from the bytes, and refuses SVG and text', () => {
    expect(sniffImage(PNG)?.mime).toBe('image/png');
    expect(sniffImage(JPEG)?.mime).toBe('image/jpeg');
    expect(sniffImage(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(8)]))?.mime).toBe('image/webp');
    expect(sniffImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
  });
});

describe('channel logo routes', () => {
  it('keeps one logo per account: upload, show, replace, remove, and nobody else sees it', async () => {
    const { app, audio } = await setup();
    expect((await app.inject({ method: 'GET', url: '/api/profile/logo', headers: H })).json().url).toBeNull();
    expect((await upload(app, PNG)).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/api/profile/logo', headers: H })).json().url).toMatch(/^data:image\/png;base64,/);
    expect(await logoDataUrl(audio, 'u1')).toMatch(/^data:image\/png/);
    expect(await logoDataUrl(audio, 'u2')).toBeUndefined();
    expect((await app.inject({ method: 'GET', url: '/api/profile/logo', headers: { authorization: 'Bearer dev:u2' } })).json().url).toBeNull();
    await upload(app, JPEG);
    expect(await logoDataUrl(audio, 'u1')).toMatch(/^data:image\/jpeg/);
    await app.inject({ method: 'DELETE', url: '/api/profile/logo', headers: H });
    expect(await logoDataUrl(audio, 'u1')).toBeUndefined();
  });

  it('refuses something that is not a picture, and an empty upload', async () => {
    const { app } = await setup();
    const bad = await upload(app, Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'));
    expect(bad.statusCode).toBe(400);
    expect(bad.json().error).toBe('not_image');
    expect((await upload(app, Buffer.alloc(0))).statusCode).toBe(400);
  });
});

describe('the logo on the reel', () => {
  const dataUrl = 'data:image/png;base64,iVBORw0KGgo=';
  const html = '<!doctype html><html><head></head><body><!-- motionmind:no-end-card --><div id="root" data-composition-id="main" data-start="0" data-duration="7"></div><script>window.__timelines = {};</script></body></html>';
  const opts = { storyEnd: 4, duration: 7, handle: '@x', platforms: ['instagram' as const], language: 'en' as const, accent: '#B7F34A' };

  it('is a round badge above the handle on the end card, and nothing when there is no logo', () => {
    expect(withEndCard(html, { ...opts, logo: dataUrl })).toContain(`<div class="mm-logo"><img alt="" src="${dataUrl}"></div>`);
    expect(withEndCard(html, opts)).not.toContain('class="mm-logo"><img');
  });
  it('sits beside the handle on the cover', () => {
    expect(withCoverText(html, { headline: 'A', handle: '@x', accent: '#B7F34A', logo: dataUrl })).toContain(`<div class="mm-cv-handle"><img alt="" src="${dataUrl}">@x</div>`);
  });
  it('only ever embeds a real image data URL', () => {
    const evil = 'javascript:alert(1)" onerror="x';
    expect(withEndCard(html, { ...opts, logo: evil })).not.toContain('javascript:');
    expect(withCoverText(html, { headline: 'A', handle: '@x', accent: '#B7F34A', logo: evil })).not.toContain('javascript:');
    expect(withEndCard(html, { ...opts, logo: 'data:image/svg+xml;base64,PHN2Zz4=' })).not.toContain('svg+xml');
  });
});
