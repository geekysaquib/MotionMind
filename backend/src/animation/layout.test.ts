import { randomBytes } from 'node:crypto';
import { describe, expect, it } from '@jest/globals';
import { buildApp } from '../app';
import { ConsoleMailer } from '../auth/mailer';
import { SessionTokens } from '../auth/session';
import { DevTokenVerifier } from '../auth/verifiers';
import { MemoryDataRepository } from '../data/repository';
import { MemoryAudioStore } from '../voice/audioStore';
import { layoutFixRequest, parseCheck, type LayoutChecker, type LayoutReport } from './layout';

const secret = randomBytes(32).toString('base64');
const H = { authorization: 'Bearer dev:u1' };
const HTML = '<!doctype html><html><head><script src="https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/gsap.min.js"></script></head><body><div id="root" data-composition-id="main" data-start="0" data-duration="6"></div><script>window.__timelines = window.__timelines || {}; window.__timelines["main"] = gsap.timeline({ paused: true });</script></body></html>';
const SCRIPT = { title: 'T', steps: ['a'], beats: [{ id: 'a', narration: 'Ek do teen.', keywords: [], chapter: 0, card: { eyebrow: 'E', headline: 'H', tone: 'teal', rows: [] } }] };

const finding = (over: Record<string, unknown>) => ({ code: 'content_overlap', severity: 'error', time: 0.2, text: 'PNR 4857 CNF', message: 'Two text blocks overlap and may render unreadable.', heldMs: 3600, ...over });

describe('parseCheck', () => {
  it('reads the JSON after the log lines, keeps errors and warnings once per text, and sorts by time', () => {
    const out = [
      '[INFO] [Compiler] Fetched 11 font faces',
      JSON.stringify({ ok: false, layout: { findings: [finding({ time: 3 }), finding({ time: 0.2 }), finding({ code: 'text_occluded', text: 'WL5', time: 1.04 }), finding({ severity: 'info', text: 'ignored' })] } }, null, 2),
    ].join('\n');
    const r = parseCheck(out);
    expect(r.ok).toBe(false);
    expect(r.total).toBe(2);
    expect(r.issues.map((i) => [i.code, i.text, i.time])).toEqual([['content_overlap', 'PNR 4857 CNF', 0.2], ['text_occluded', 'WL5', 1]]);
    expect(r.issues[0]!.seconds).toBe(3.6);
  });
  it('is ok when nothing was found, and refuses output with no result', () => {
    expect(parseCheck('log\n' + JSON.stringify({ ok: true, layout: { findings: [] } })).ok).toBe(true);
    expect(() => parseCheck('nothing here')).toThrow();
  });
});

describe('layoutFixRequest', () => {
  it('lists each problem in plain words and tells Claude how to fix them', () => {
    const report: LayoutReport = { ok: false, total: 3, issues: [{ code: 'text_occluded', time: 3.2, text: 'PNR 4857', message: 'x', seconds: 2 }, { code: 'content_overlap', time: 5, text: null, message: 'Two text blocks overlap.', seconds: 0.1 }] };
    const text = layoutFixRequest(report);
    expect(text).toContain('At 3.2 s, the text "PNR 4857" is hidden underneath another element (for about 2.0 s).');
    expect(text).toContain('At 5.0 s');
    expect(text).toContain('(1 more of the same kind.)');
    expect(text).toContain('complete HTML file');
  });
});

describe('POST /projects/:id/animation/check', () => {
  async function setup(layoutChecker?: LayoutChecker) {
    const data = new MemoryDataRepository();
    const app = await buildApp({ data, audio: new MemoryAudioStore(), layoutChecker, sessions: new SessionTokens(secret), mailer: new ConsoleMailer(false), verifier: new DevTokenVerifier(), authSecret: secret, webOrigin: 'http://localhost:5173', mode: 'memory' });
    const id = (await app.inject({ method: 'POST', url: '/api/projects', headers: H, payload: { title: 'T', topic: 'T', durationSec: 30, qualityTier: 'draft' } })).json().project.id as string;
    await data.updateProject('u1', id, { script: { ...SCRIPT, animation: { html: HTML, timingKey: 'x', writtenAt: 'now' } } as never });
    return { app, data, id };
  }

  it('answers with the problems and a request to paste into Claude, or nothing to fix', async () => {
    const calls: string[] = [];
    const bad: LayoutReport = { ok: false, total: 1, issues: [{ code: 'text_occluded', time: 1, text: 'Hello', message: 'x', seconds: 1 }] };
    let report = bad;
    const { app, id } = await setup(async (html) => {
      calls.push(html);
      return report;
    });
    const res = await app.inject({ method: 'POST', url: `/api/projects/${id}/animation/check`, headers: H });
    expect(res.statusCode).toBe(200);
    expect(res.json().report.issues).toHaveLength(1);
    expect(res.json().request).toContain('"Hello"');
    expect(calls[0]).toBe(HTML);
    report = { ok: true, total: 0, issues: [] };
    const ok = (await app.inject({ method: 'POST', url: `/api/projects/${id}/animation/check`, headers: H })).json();
    expect(ok.report.ok).toBe(true);
    expect(ok.request).toBeNull();
  });

  it('says it runs on the PC without a checker, needs the animation, and shows a failure plainly', async () => {
    const { app, id } = await setup();
    expect((await app.inject({ method: 'POST', url: `/api/projects/${id}/animation/check`, headers: H })).statusCode).toBe(501);
    const b = await setup(async () => {
      throw new Error('Chrome is missing');
    });
    const failed = await b.app.inject({ method: 'POST', url: `/api/projects/${b.id}/animation/check`, headers: H });
    expect(failed.statusCode).toBe(500);
    expect(failed.json().message).toContain('Chrome is missing');
    const c = await setup(async () => ({ ok: true, total: 0, issues: [] }));
    await c.data.updateProject('u1', c.id, { script: SCRIPT as never });
    expect((await c.app.inject({ method: 'POST', url: `/api/projects/${c.id}/animation/check`, headers: H })).json().error).toBe('no_animation');
    expect((await c.app.inject({ method: 'POST', url: `/api/projects/${c.id}/animation/check`, headers: { authorization: 'Bearer dev:u2' } })).statusCode).toBe(404);
  });
});
