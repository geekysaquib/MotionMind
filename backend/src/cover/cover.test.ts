import { randomBytes } from 'node:crypto';
import { describe, expect, it } from '@jest/globals';
import type { CoverSettings, ReelScript } from '@motionmind/shared';
import { buildApp } from '../app';
import { ConsoleMailer } from '../auth/mailer';
import { SessionTokens } from '../auth/session';
import { DevTokenVerifier } from '../auth/verifiers';
import { MemoryDataRepository } from '../data/repository';
import { MemoryAudioStore } from '../voice/audioStore';
import type { Renderer } from '../export/renderer';

const secret = randomBytes(32).toString('base64');
const H = { authorization: 'Bearer dev:user-a' };
const B = { authorization: 'Bearer dev:user-b' };
const beat = (id: string) => ({ id, narration: 'Ek second.', keywords: [], chapter: 0, card: { eyebrow: 'UPI', headline: 'Fast', tone: 'teal' as const, rows: [] } });
const SCRIPT: ReelScript = { title: 'How UPI works', steps: ['App'], beats: [beat('a'), beat('b')], animation: { html: '<!doctype html><html></html>', timingKey: 'x', writtenAt: 'now' } };
const COVER: CoverSettings = { scene: 1, headline: 'How *UPI* works', kicker: 'Explained', style: 'center', size: 'feed', tone: 'purple', brand: true };

class FakeRenderer implements Renderer {
  stills: { html: string; at: number }[] = [];
  start(): never {
    throw new Error('not used');
  }
  latest() {
    return null;
  }
  filePath() {
    return null;
  }
  async still(html: string, at: number) {
    this.stills.push({ html, at });
    return '11111111-1111-1111-1111-111111111111.png';
  }
}

async function setup(renderer?: Renderer, withScript = true) {
  const data = new MemoryDataRepository();
  const app = await buildApp({ data, audio: new MemoryAudioStore(), renderer, sessions: new SessionTokens(secret), mailer: new ConsoleMailer(false), verifier: new DevTokenVerifier(), authSecret: secret, webOrigin: 'http://localhost:5173', mode: 'memory' });
  const created = await app.inject({ method: 'POST', url: '/api/projects', headers: H, payload: { title: 'UPI', topic: 'UPI', durationSec: 30, qualityTier: 'draft' } });
  const project = created.json().project as { id: string; ownerId: string };
  if (withScript) await data.updateProject(project.ownerId, project.id, { script: SCRIPT, stage: 'storyboard' });
  return { app, id: project.id, data, ownerId: project.ownerId };
}

describe('cover settings', () => {
  it('are saved with the script without counting as a storyboard edit, and survive a storyboard save', async () => {
    const { app, id } = await setup();
    const res = await app.inject({ method: 'PUT', url: `/api/projects/${id}/cover`, headers: H, payload: { cover: COVER } });
    expect(res.statusCode).toBe(200);
    const saved = res.json().project;
    expect(saved.script.cover).toEqual(COVER);
    expect(saved.script.editedAt).toBeUndefined();
    expect(saved.stage).toBe('storyboard');
    // The storyboard saves the whole script; the cover must come through it.
    const sb = await app.inject({ method: 'PUT', url: `/api/projects/${id}/script`, headers: H, payload: { script: saved.script } });
    expect(sb.statusCode).toBe(200);
    expect(sb.json().project.script.cover).toEqual(COVER);
  });

  it('refuse a missing headline, an unknown style or size, a scene that does not exist, and other users', async () => {
    const { app, id } = await setup();
    const put = (cover: unknown, headers = H) => app.inject({ method: 'PUT', url: `/api/projects/${id}/cover`, headers, payload: { cover } });
    expect((await put({ ...COVER, headline: '  ' })).json().message).toBe('Write a headline for the cover.');
    expect((await put({ ...COVER, style: 'wild' })).statusCode).toBe(400);
    expect((await put({ ...COVER, size: 'huge' })).statusCode).toBe(400);
    expect((await put({ ...COVER, scene: 5 })).json().message).toBe("That scene doesn't exist.");
    expect((await put(COVER, B)).statusCode).toBe(404);
    const empty = await setup(undefined, false);
    expect((await empty.app.inject({ method: 'PUT', url: `/api/projects/${empty.id}/cover`, headers: H, payload: { cover: COVER } })).json().error).toBe('no_script');
  });
});

describe('cover render', () => {
  it("takes a frame of Claude's animation late in the chosen scene, and returns its link", async () => {
    const renderer = new FakeRenderer();
    const { app, id } = await setup(renderer);
    const png = await app.inject({ method: 'POST', url: `/api/projects/${id}/cover/render`, headers: H, payload: { cover: COVER } });
    expect(png.statusCode).toBe(200);
    expect(png.json()).toEqual({ file: '11111111-1111-1111-1111-111111111111.png', url: '/api/renders/11111111-1111-1111-1111-111111111111.png' });
    expect(renderer.stills).toHaveLength(1);
    expect(renderer.stills[0]!.html).toContain('<html>');
    // Each scene ('Ek second.', no voice) is estimated at 2 / 2.7 + 0.6 s; scene 2 at 80% of its length.
    const len = 2 / 2.7 + 0.6;
    expect(renderer.stills[0]!.at).toBeCloseTo(len + len * 0.8, 1);
  });

  it('needs the animation first', async () => {
    const renderer = new FakeRenderer();
    const { app, id, data, ownerId } = await setup(renderer);
    await data.updateProject(ownerId, id, { script: { ...SCRIPT, animation: undefined } });
    const res = await app.inject({ method: 'POST', url: `/api/projects/${id}/cover/render`, headers: H, payload: { cover: COVER } });
    expect(res.json().error).toBe('no_animation');
  });

  it('says it runs on the PC when there is no renderer, and validates what it is given', async () => {
    const none = await setup();
    const res = await none.app.inject({ method: 'POST', url: `/api/projects/${none.id}/cover/render`, headers: H, payload: { cover: COVER } });
    expect(res.statusCode).toBe(501);
    expect(res.json().message).toMatch(/runs on your PC/);
    const { app, id } = await setup(new FakeRenderer());
    expect((await app.inject({ method: 'POST', url: `/api/projects/${id}/cover/render`, headers: H, payload: { cover: { ...COVER, scene: 9 } } })).statusCode).toBe(400);

    expect((await app.inject({ method: 'POST', url: `/api/projects/${id}/cover/render`, payload: { cover: COVER } })).statusCode).toBe(401);
  });

  it('answers with a clear message when the renderer fails', async () => {
    const renderer = new FakeRenderer();
    renderer.still = async () => {
      throw new Error('Chrome did not start\nstack...');
    };
    const { app, id } = await setup(renderer);
    const res = await app.inject({ method: 'POST', url: `/api/projects/${id}/cover/render`, headers: H, payload: { cover: COVER } });
    expect(res.statusCode).toBe(500);
    expect(res.json().message).toBe('The cover could not be made: Chrome did not start');
  });
});
