import { randomBytes } from 'node:crypto';
import { describe, expect, it } from '@jest/globals';
import { buildApp } from '../app';
import { ConsoleMailer } from '../auth/mailer';
import { SessionTokens } from '../auth/session';
import { DevTokenVerifier } from '../auth/verifiers';
import { MemoryDataRepository } from '../data/repository';
import { MemoryAudioStore } from '../voice/audioStore';

const secret = randomBytes(32).toString('base64');
const H = { authorization: 'Bearer dev:u1' };
const SCRIPT = {
  title: 'Tatkal ke 60 second',
  style: 'whiteboard',
  steps: ['Queue'],
  glossary: [{ short: 'IRCTC', full: 'Indian Railway Catering and Tourism Corporation' }],
  brands: [{ name: 'IRCTC', domain: 'irctc.co.in' }],
  beats: [{ id: 'a', narration: 'Subah dus baje Tatkal khulta hai.', keywords: [], chapter: 0, card: { eyebrow: 'IRCTC Tatkal', headline: '10 baje, *lakhon* log', tone: 'red', rows: [] } }],
};
const HTML = '<!doctype html><html><head><script src="https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/gsap.min.js"></script></head><body><div id="root" data-composition-id="main" data-start="0" data-duration="6"></div><script>window.__timelines = window.__timelines || {}; window.__timelines["main"] = gsap.timeline({ paused: true });</script></body></html>';

async function setup() {
  const data = new MemoryDataRepository();
  const app = await buildApp({ data, audio: new MemoryAudioStore(), sessions: new SessionTokens(secret), mailer: new ConsoleMailer(false), verifier: new DevTokenVerifier(), authSecret: secret, webOrigin: 'http://localhost:5173', mode: 'memory' });
  const id = (await app.inject({ method: 'POST', url: '/api/projects', headers: H, payload: { title: 'Tatkal', topic: 'IRCTC Tatkal', durationSec: 45, qualityTier: 'draft' } })).json().project.id as string;
  return { app, data, id };
}

describe('Animate step', () => {
  it("gives a claude.ai prompt with the script, every word's time and the style's rulebook", async () => {
    const { app, data, id } = await setup();
    expect((await app.inject({ method: 'GET', url: `/api/projects/${id}/animation/prompt`, headers: H })).json().error).toBe('no_script');
    await data.updateProject('u1', id, { script: SCRIPT as never });
    const res = await app.inject({ method: 'GET', url: `/api/projects/${id}/animation/prompt`, headers: H });
    expect(res.statusCode).toBe(200);
    const { prompt, timeline } = res.json();
    expect(timeline.source).toBe('estimate');
    expect(prompt).toContain('HyperFrames');
    expect(prompt).toContain('window.__timelines["main"]');
    expect(prompt).toContain('Whiteboard Explainer');
    const noted = (await app.inject({ method: 'GET', url: `/api/projects/${id}/animation/prompt?note=${encodeURIComponent('Use more red')}`, headers: H })).json().prompt as string;
    expect(noted).toContain('Use more red');
    expect(prompt).not.toContain('Use more red');
    expect(prompt).toContain('["Subah",');
    expect(prompt).toContain('/api/logo/irctc.co.in');
    expect(prompt).toContain('Indian audience');
  });

  it("saves Claude's pasted animation with the script, and marks it stale when the recording changes", async () => {
    const { app, data, id } = await setup();
    await data.updateProject('u1', id, { script: SCRIPT as never });
    const bad = await app.inject({ method: 'POST', url: `/api/projects/${id}/animation/import`, headers: H, payload: { text: 'no html here' } });
    expect(bad.statusCode).toBe(400);
    const ok = await app.inject({ method: 'POST', url: `/api/projects/${id}/animation/import`, headers: H, payload: { text: '```html\n' + HTML + '\n```' } });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().project.script.animation).toMatchObject({ html: HTML, style: 'whiteboard' });
    expect((await app.inject({ method: 'GET', url: `/api/projects/${id}/animation`, headers: H })).json().stale).toBe(false);
    await data.updateProject('u1', id, { editor: { upload: { track: { path: 'u1/x/voice.mp3', fileName: 'v.mp3', mime: 'audio/mpeg', durationSec: 9 }, cuts: [] }, music: null } });
    expect((await app.inject({ method: 'GET', url: `/api/projects/${id}/animation`, headers: H })).json().stale).toBe(true);
    // A storyboard save keeps the animation.
    const saved = (await data.getProject('u1', id))!.script!;
    const put = await app.inject({ method: 'PUT', url: `/api/projects/${id}/script`, headers: H, payload: { script: saved } });
    expect(put.json().project.script.animation.html).toBe(HTML);
    expect((await app.inject({ method: 'GET', url: `/api/projects/${id}/animation`, headers: { authorization: 'Bearer dev:u2' } })).statusCode).toBe(404);
  });

  it('serves the local GSAP build to the preview', async () => {
    const { app } = await setup();
    const res = await app.inject({ method: 'GET', url: '/api/static/gsap.min.js' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('javascript');
    expect(res.body).toContain('GreenSock');
  });
});
