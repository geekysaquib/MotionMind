import { randomBytes } from 'node:crypto';
import { describe, expect, it } from '@jest/globals';
import { buildApp } from '../app';
import { ConsoleMailer } from '../auth/mailer';
import { SessionTokens } from '../auth/session';
import { DevTokenVerifier } from '../auth/verifiers';
import { MemoryDataRepository } from '../data/repository';
import type { ReelScript } from './reelSchema';

const secret = randomBytes(32).toString('base64');
const H = { authorization: 'Bearer dev:u1' };

const SCRIPT: ReelScript = {
  title: 'UPI kaise kaam karta hai',
  steps: ['App', 'Bank', 'NPCI'],
  beats: [
    { id: 'hook', narration: 'Ek second mein paisa kaise pahunchta hai?', keywords: ['second'], chapter: 0, card: { eyebrow: 'UPI', headline: 'Ek *second* mein payment', tone: 'teal', rows: [] } },
    { id: 'npci', narration: 'NPCI dono banks ke beech baat karata hai.', keywords: ['npci'], chapter: 3, card: { eyebrow: 'Step 3', headline: '*NPCI* beech mein', tone: 'blue', rows: [{ kind: 'flow', items: ['Your bank', 'NPCI', 'Their bank'] }] } },
  ],
};

const RESEARCH = {
  summary: 'UPI sends a payment request through NPCI to the receiving bank.',
  facts: [
    { claim: 'NPCI runs the UPI switch', status: 'verified' as const, sources: [0, 1] },
    { claim: 'Most payments settle in a few seconds', status: 'estimate' as const, sources: [1] },
  ],
  sources: [
    { title: 'NPCI: UPI product overview', url: 'https://www.npci.org.in/what-we-do/upi/product-overview' },
    { title: 'RBI payments report', url: 'https://www.rbi.org.in/' },
  ],
};

async function setup() {
  const data = new MemoryDataRepository();
  const app = await buildApp({ data, sessions: new SessionTokens(secret), mailer: new ConsoleMailer(false), verifier: new DevTokenVerifier(), authSecret: secret, webOrigin: 'http://localhost:5173', mode: 'memory' });
  return { app, data };
}

describe('script from claude.ai', () => {
  async function projectId(app: Awaited<ReturnType<typeof setup>>['app']) {
    const created = await app.inject({ method: 'POST', url: '/api/projects', headers: H, payload: { title: 'UPI', topic: 'How UPI works', durationSec: 45, qualityTier: 'standard' } });
    return created.json().project.id as string;
  }

  it('gives a ready-to-copy prompt with the topic, length and JSON format', async () => {
    const { app } = await setup();
    const id = await projectId(app);
    const res = await app.inject({ method: 'GET', url: `/api/projects/${id}/script/prompt`, headers: H });
    expect(res.statusCode).toBe(200);
    const prompt = res.json().prompt as string;
    expect(prompt).toContain('Write a reel about: How UPI works');
    expect(prompt).toContain('about 45 seconds');
    expect(prompt).toContain('Answer with only one JSON object');
    expect(prompt).toContain('"beats"');
  });

  it('imports a pasted answer, fenced or not, and saves it like a written script', async () => {
    const { app } = await setup();
    const id = await projectId(app);
    const pasted = `Here is your reel:\n\`\`\`json\n${JSON.stringify(SCRIPT, null, 2)}\n\`\`\`\nHope it helps!`;
    const res = await app.inject({ method: 'POST', url: `/api/projects/${id}/script/import`, headers: H, payload: { text: pasted } });
    expect(res.statusCode).toBe(200);
    expect(res.json().project).toMatchObject({ stage: 'script', script: { title: SCRIPT.title, model: 'claude.ai (pasted)', beats: SCRIPT.beats } });
  });

  it('explains what is wrong with a bad paste and saves nothing', async () => {
    const { app } = await setup();
    const id = await projectId(app);
    const post = (text: string) => app.inject({ method: 'POST', url: `/api/projects/${id}/script/import`, headers: H, payload: { text } });
    expect((await post('sorry, I cannot help')).json().message).toMatch(/doesn't look like a script/);
    expect((await post('{"title": "x", ')).json().message).toMatch(/whole answer|isn't complete/);
    expect((await post(JSON.stringify({ title: 'x', steps: [] }))).json().message).toMatch(/missing something.*beats/);
    expect((await post(JSON.stringify({ ...SCRIPT, beats: [] }))).json().message).toMatch(/no beats/);
    const project = await app.inject({ method: 'GET', url: `/api/projects/${id}`, headers: H });
    expect(project.json().project.script).toBeNull();
  });
});

describe('research', () => {
  async function projectId(app: Awaited<ReturnType<typeof setup>>['app']) {
    const created = await app.inject({ method: 'POST', url: '/api/projects', headers: H, payload: { title: 'UPI', topic: 'How UPI works', durationSec: 60, qualityTier: 'standard' } });
    return created.json().project.id as string;
  }

  it('feeds only approved research into the script prompt', async () => {
    const { app } = await setup();
    const id = await projectId(app);
    await app.inject({ method: 'POST', url: `/api/projects/${id}/research/import`, headers: H, payload: { text: JSON.stringify(RESEARCH) } });
    const prompt = async () => (await app.inject({ method: 'GET', url: `/api/projects/${id}/script/prompt`, headers: H })).json().prompt as string;
    expect(await prompt()).not.toContain(RESEARCH.summary);
    const approved = await app.inject({ method: 'POST', url: `/api/projects/${id}/research/approve`, headers: H });
    expect(approved.json().project.research.approvedAt).toEqual(expect.any(String));
    const after = await prompt();
    expect(after).toContain(RESEARCH.summary);
    expect(after).toContain('NPCI runs the UPI switch (verified)');
  });

  it('works through claude.ai: prompt, paste, approve', async () => {
    const { app } = await setup();
    const id = await projectId(app);
    const prompt = (await app.inject({ method: 'GET', url: `/api/projects/${id}/research/prompt`, headers: H })).json().prompt as string;
    expect(prompt).toContain('Research this topic for a reel: How UPI works');
    expect(prompt).toContain('"facts"');
    expect(prompt).not.toContain('EXTRA INSTRUCTIONS');
    const withNote = (await app.inject({ method: 'GET', url: `/api/projects/${id}/research/prompt?note=${encodeURIComponent('Focus on the 2023 rules.')}`, headers: H })).json().prompt as string;
    expect(withNote).toContain(prompt);
    expect(withNote).toContain('EXTRA INSTRUCTIONS FROM THE CREATOR');
    expect(withNote.trimEnd().endsWith('Focus on the 2023 rules.')).toBe(true);
    const script = (await app.inject({ method: 'GET', url: `/api/projects/${id}/script/prompt?note=${encodeURIComponent('Keep it under 40 seconds')}`, headers: H })).json().prompt as string;
    expect(script).toContain('Keep it under 40 seconds');
    const pasted = { ...RESEARCH, facts: [...RESEARCH.facts, { claim: 'Bad index', status: 'single_source', sources: [7] }] };
    const res = await app.inject({ method: 'POST', url: `/api/projects/${id}/research/import`, headers: H, payload: { text: `Sure!\n${JSON.stringify(pasted)}` } });
    expect(res.statusCode).toBe(200);
    expect(res.json().project.research.model).toBe('claude.ai (pasted)');
    expect(res.json().project.research.facts[2].sources).toEqual([]);
    const bad = await app.inject({ method: 'POST', url: `/api/projects/${id}/research/import`, headers: H, payload: { text: '{"summary":"x","facts":[],"sources":[]}' } });
    expect(bad.json().message).toMatch(/no facts/);
  });

  it("can't approve research that doesn't exist", async () => {
    const { app } = await setup();
    const id = await projectId(app);
    expect((await app.inject({ method: 'POST', url: `/api/projects/${id}/research/approve`, headers: H })).json().error).toBe('no_research');
  });
});

describe('storyboard edits', () => {
  it('saves an edited script, keeps who wrote it, marks it edited and moves to Storyboard', async () => {
    const { app } = await setup();
    const created = await app.inject({ method: 'POST', url: '/api/projects', headers: H, payload: { title: 'UPI', topic: 'How UPI works', durationSec: 60, qualityTier: 'standard' } });
    const id = created.json().project.id;
    await app.inject({ method: 'POST', url: `/api/projects/${id}/script/import`, headers: H, payload: { text: JSON.stringify(SCRIPT) } });
    const edited = { ...SCRIPT, title: 'UPI in 1 second', beats: [SCRIPT.beats[1], SCRIPT.beats[0]] };
    const res = await app.inject({ method: 'PUT', url: `/api/projects/${id}/script`, headers: H, payload: { script: edited } });
    expect(res.statusCode).toBe(200);
    expect(res.json().project).toMatchObject({ stage: 'storyboard', script: { title: 'UPI in 1 second', model: 'claude.ai (pasted)', editedAt: expect.any(String) } });
    expect(res.json().project.script.beats[0].id).toBe('npci');
  });

  it('keeps the picked style on the storyboard and through a rewrite, and refuses an unknown one', async () => {
    const { app } = await setup();
    const created = await app.inject({ method: 'POST', url: '/api/projects', headers: H, payload: { title: 'UPI', topic: 'x', durationSec: 60, qualityTier: 'standard' } });
    const id = created.json().project.id;
    await app.inject({ method: 'POST', url: `/api/projects/${id}/script/import`, headers: H, payload: { text: JSON.stringify(SCRIPT) } });
    const picked = await app.inject({ method: 'PUT', url: `/api/projects/${id}/style`, headers: H, payload: { style: 'whiteboard' } });
    expect(picked.statusCode).toBe(200);
    expect(picked.json().project).toMatchObject({ stage: 'script', script: { style: 'whiteboard' } });
    expect(picked.json().project.script.editedAt).toBeUndefined();
    expect((await app.inject({ method: 'PUT', url: `/api/projects/${id}/style`, headers: H, payload: { style: 'vaporwave' } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'PUT', url: `/api/projects/${id}/style`, headers: { authorization: 'Bearer dev:u2' }, payload: { style: 'newsroom' } })).statusCode).toBe(404);
    const saved = await app.inject({ method: 'PUT', url: `/api/projects/${id}/script`, headers: H, payload: { script: { ...SCRIPT, style: 'newsroom' } } });
    expect(saved.json().project.script.style).toBe('newsroom');
    const rewritten = await app.inject({ method: 'POST', url: `/api/projects/${id}/script/import`, headers: H, payload: { text: JSON.stringify(SCRIPT) } });
    expect(rewritten.json().project.script.style).toBe('newsroom');
  });

  it('rejects a broken or empty storyboard and other people\'s projects', async () => {
    const { app } = await setup();
    const created = await app.inject({ method: 'POST', url: '/api/projects', headers: H, payload: { title: 'UPI', topic: 'x', durationSec: 60, qualityTier: 'standard' } });
    const id = created.json().project.id;
    const put = (script: unknown, headers = H) => app.inject({ method: 'PUT', url: `/api/projects/${id}/script`, headers, payload: { script } });
    expect((await put({ ...SCRIPT, beats: [{ ...SCRIPT.beats[0], card: { ...SCRIPT.beats[0]!.card, tone: 'pink' } }] })).json().message).toMatch(/storyboard has a problem/);
    expect((await put({ ...SCRIPT, beats: [] })).json().message).toBe('Keep at least one beat.');
    expect((await put(SCRIPT, { authorization: 'Bearer dev:u2' })).statusCode).toBe(404);
  });
});

describe('Script prompt and older scripts', () => {
  it('still load: the old 3D fields (world, theme, scene, shot) are dropped', async () => {
    const { parsePastedScript } = await import('./reelPrompt');
    const old = { ...SCRIPT, world: 'iso', theme: 'lab', beats: SCRIPT.beats.map((b) => ({ ...b, shot: 'tower', scene: { props: [{ id: 'you', kind: 'phone' }] } })) };
    const parsed = parsePastedScript(JSON.stringify(old)) as Record<string, unknown> & { beats: Record<string, unknown>[] };
    expect(parsed.world).toBeUndefined();
    expect(parsed.theme).toBeUndefined();
    expect(parsed.beats[0]!.scene).toBeUndefined();
    expect(parsed.beats[0]!.shot).toBeUndefined();
  });

  it('writes for an Indian audience, in the default style when none was picked', async () => {
    const { manualReelPrompt } = await import('./reelPrompt');
    const prompt = manualReelPrompt({ topic: 'UPI', durationSec: 30, language: 'en', niche: null, channelName: null });
    expect(prompt).toContain('Your audience is Indian');
    expect(prompt).toContain('₹');
    expect(prompt).toContain('"Live Map" style');
    expect(prompt).not.toContain('isometric');
  });

  it('writes the claude.ai prompt for the style picked before the script, and saves the pasted script with it', async () => {
    const { app } = await setup();
    const created = await app.inject({ method: 'POST', url: '/api/projects', headers: H, payload: { title: 'Tatkal', topic: 'IRCTC Tatkal backend', durationSec: 45, qualityTier: 'standard' } });
    const id = created.json().project.id;
    const prompt = (await app.inject({ method: 'GET', url: `/api/projects/${id}/script/prompt?style=whiteboard`, headers: H })).json().prompt as string;
    expect(prompt).toContain('"Whiteboard" style');
    expect(prompt).toContain('marker');
    expect((await app.inject({ method: 'GET', url: `/api/projects/${id}/script/prompt?style=nope`, headers: H })).json().prompt).toContain('"Live Map" style');
    const designed = {
      ...SCRIPT,
      beats: SCRIPT.beats.map((b) => ({
        ...b,
        visual: { elements: [{ id: 'lb', kind: 'card', label: 'Load balancer', icon: 'split', x: 50, y: 40, on: 'npci' }, { id: 'db', kind: 'stamp', label: 'Confirmed' }], links: [{ from: 'lb', to: 'db', label: 'book' }] },
      })),
    };
    const res = await app.inject({ method: 'POST', url: `/api/projects/${id}/script/import`, headers: H, payload: { text: JSON.stringify(designed), style: 'whiteboard' } });
    expect(res.statusCode).toBe(200);
    expect(res.json().project.script.style).toBe('whiteboard');
    // Fields of the old scene designer are dropped.
    expect(res.json().project.script.beats[0].visual).toBeUndefined();
  });
});
