import { randomBytes } from 'node:crypto';
import { describe, expect, it } from '@jest/globals';
import { buildApp } from '../app';
import { ConsoleMailer } from '../auth/mailer';
import { SessionTokens } from '../auth/session';
import { DevTokenVerifier } from '../auth/verifiers';
import { MemoryDataRepository } from '../data/repository';
import { ClaudeError, claudeClient, CLAUDE_MODEL, type ClaudeClient } from './claude';
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

async function setup(fake: Partial<ClaudeClient> = {}, serverKey: string | null = 'sk-ant-server-123456') {
  const anthropicApiKey = serverKey ?? undefined;
  const data = new MemoryDataRepository();
  const seen: { apiKey: string }[] = [];
  const app = await buildApp({
    data,
    sessions: new SessionTokens(secret),
    mailer: new ConsoleMailer(false),
    verifier: new DevTokenVerifier(),
    authSecret: secret,
    anthropicApiKey,
    webOrigin: 'http://localhost:5173',
    mode: 'memory',
    claude: (apiKey) => {
      seen.push({ apiKey });
      return {
        ask: async (prompt) => ({ text: `echo: ${prompt}`, model: CLAUDE_MODEL, inputTokens: 10, outputTokens: 5 }),
        writeReel: async () => ({ script: SCRIPT, model: CLAUDE_MODEL }),
        research: async () => ({ research: RESEARCH, model: CLAUDE_MODEL, searches: 3 }),
        ...fake,
      };
    },
  });
  return { app, data, seen };
}

describe('Claude routes', () => {
  it('report whether Claude is set up on the server', async () => {
    expect((await (await setup()).app.inject({ method: 'GET', url: '/api/claude/status', headers: H })).json()).toEqual({ connected: true, model: CLAUDE_MODEL });
    expect((await (await setup({}, null)).app.inject({ method: 'GET', url: '/api/claude/status', headers: H })).json()).toEqual({ connected: false, model: CLAUDE_MODEL });
  });

  it("ask Claude with the server's key, never a user's", async () => {
    const { app, seen } = await setup();
    const res = await app.inject({ method: 'POST', url: '/api/claude/ask', headers: H, payload: { prompt: 'hi' } });
    expect(res.statusCode).toBe(200);
    expect(res.json().reply).toMatchObject({ text: 'echo: hi', model: CLAUDE_MODEL });
    await app.inject({ method: 'POST', url: '/api/claude/ask', headers: { authorization: 'Bearer dev:u2' }, payload: { prompt: 'again' } });
    expect(seen).toEqual([{ apiKey: 'sk-ant-server-123456' }]);
    expect((await app.inject({ method: 'POST', url: '/api/claude/ask', headers: H, payload: { prompt: '  ' } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/api/claude/ask', payload: { prompt: 'hi' } })).statusCode).toBe(401);
  });

  it('say clearly when the server has no Anthropic key', async () => {
    const { app } = await setup({}, null);
    const res = await app.inject({ method: 'POST', url: '/api/claude/ask', headers: H, payload: { prompt: 'hi' } });
    expect(res.statusCode).toBe(503);
    expect(res.json().error).toBe('claude_not_configured');
  });

  it('pass Claude errors through with their status and message', async () => {
    const { app } = await setup({
      ask: async () => {
        throw new ClaudeError("The server's Anthropic API key was rejected. Check ANTHROPIC_API_KEY.", 'claude_key_rejected', 502);
      },
    });
    const res = await app.inject({ method: 'POST', url: '/api/claude/ask', headers: H, payload: { prompt: 'hi' } });
    expect(res.statusCode).toBe(502);
    expect(res.json().error).toBe('claude_key_rejected');
  });

  it('write and save a reel script for a project, and move it to the Script stage', async () => {
    const { app } = await setup();
    const created = await app.inject({ method: 'POST', url: '/api/projects', headers: H, payload: { title: 'UPI', topic: 'How UPI works', durationSec: 60, qualityTier: 'standard' } });
    const id = created.json().project.id;
    const res = await app.inject({ method: 'POST', url: `/api/projects/${id}/script`, headers: H });
    expect(res.statusCode).toBe(200);
    const project = res.json().project;
    expect(project).toMatchObject({ stage: 'script', status: 'in_progress' });
    expect(project.script).toMatchObject({ title: SCRIPT.title, model: CLAUDE_MODEL, beats: SCRIPT.beats });
    expect(project.script.writtenAt).toEqual(expect.any(String));
    const again = await app.inject({ method: 'GET', url: `/api/projects/${id}`, headers: H });
    expect(again.json().project.script.title).toBe(SCRIPT.title);
  });

  it("won't write a script without a topic, for someone else's project, or a bad id", async () => {
    const { app } = await setup();
    const created = await app.inject({ method: 'POST', url: '/api/projects', headers: H, payload: { title: 'Empty', topic: null, durationSec: 30, qualityTier: 'draft' } });
    const id = created.json().project.id;
    expect((await app.inject({ method: 'POST', url: `/api/projects/${id}/script`, headers: H })).json().error).toBe('no_topic');
    expect((await app.inject({ method: 'POST', url: `/api/projects/${id}/script`, headers: { authorization: 'Bearer dev:u2' } })).statusCode).toBe(404);
    expect((await app.inject({ method: 'POST', url: '/api/projects/nope/script', headers: H })).statusCode).toBe(404);
  });
});

describe('claudeClient (real SDK, fake network)', () => {
  function fakeAnthropic(status: number, body: unknown) {
    const calls: { url: string; headers: Headers; body: Record<string, unknown> }[] = [];
    const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
      const req = new Request(input, init);
      calls.push({ url: req.url, headers: req.headers, body: JSON.parse((await req.text()) || '{}') });
      return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'request-id': 'req_1' } });
    }) as unknown as typeof fetch;
    return { fetchImpl, calls };
  }
  const message = (content: unknown[], stop = 'end_turn') => ({
    id: 'msg_1',
    type: 'message',
    role: 'assistant',
    model: CLAUDE_MODEL,
    content,
    stop_reason: stop,
    stop_sequence: null,
    usage: { input_tokens: 12, output_tokens: 7 },
  });

  it('sends the key, model and fallback beta, and returns the text', async () => {
    const api = fakeAnthropic(200, message([{ type: 'text', text: 'Connected to Motion Mind.' }]));
    const reply = await claudeClient('sk-ant-xyz', api.fetchImpl).ask('hello');
    expect(reply).toEqual({ text: 'Connected to Motion Mind.', model: CLAUDE_MODEL, inputTokens: 12, outputTokens: 7 });
    const call = api.calls[0]!;
    expect(call.url).toContain('/v1/messages');
    // The SDK sends the key as x-api-key or as a bearer token depending on its version.
    expect([call.headers.get('x-api-key'), call.headers.get('authorization')]).toContainEqual(expect.stringContaining('sk-ant-xyz'));
    expect(call.headers.get('anthropic-beta')).toContain('server-side-fallback-2026-07-01');
    expect(call.body).toMatchObject({ model: CLAUDE_MODEL, fallbacks: 'default' });
  });

  it('turns a rejected key into a clear error', async () => {
    const api = fakeAnthropic(401, { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } });
    await expect(claudeClient('bad', api.fetchImpl).ask('hello')).rejects.toMatchObject({ code: 'claude_key_rejected', status: 502 });
  });

  it('reports a refusal instead of returning empty text', async () => {
    const api = fakeAnthropic(200, message([], 'refusal'));
    await expect(claudeClient('k', api.fetchImpl).ask('x')).rejects.toMatchObject({ code: 'claude_refused' });
  });

  it('parses a structured reel script', async () => {
    const api = fakeAnthropic(200, message([{ type: 'text', text: JSON.stringify(SCRIPT) }]));
    const out = await claudeClient('k', api.fetchImpl).writeReel({ topic: 'How UPI works', durationSec: 60, language: 'hinglish', niche: 'Tech', channelName: 'Samjho' });
    expect(out.script).toEqual(SCRIPT);
    const body = api.calls[0]!.body as { output_config: { format: { type: string } }; messages: { content: string }[] };
    expect(body.output_config.format.type).toBe('json_schema');
    expect(body.messages[0]!.content).toContain('How UPI works');
    expect(body.messages[0]!.content).toContain('Hinglish');
  });
});

describe('script from claude.ai (no API key)', () => {
  async function projectId(app: Awaited<ReturnType<typeof setup>>['app']) {
    const created = await app.inject({ method: 'POST', url: '/api/projects', headers: H, payload: { title: 'UPI', topic: 'How UPI works', durationSec: 45, qualityTier: 'standard' } });
    return created.json().project.id as string;
  }

  it('gives a ready-to-copy prompt with the topic, length and JSON format, even without a server key', async () => {
    const { app } = await setup({}, null);
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
    const { app } = await setup({}, null);
    const id = await projectId(app);
    const pasted = `Here is your reel:\n\`\`\`json\n${JSON.stringify(SCRIPT, null, 2)}\n\`\`\`\nHope it helps!`;
    const res = await app.inject({ method: 'POST', url: `/api/projects/${id}/script/import`, headers: H, payload: { text: pasted } });
    expect(res.statusCode).toBe(200);
    expect(res.json().project).toMatchObject({ stage: 'script', script: { title: SCRIPT.title, model: 'claude.ai (pasted)', beats: SCRIPT.beats } });
  });

  it('explains what is wrong with a bad paste and saves nothing', async () => {
    const { app } = await setup({}, null);
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

  it('researches with Claude, saves facts and sources unapproved, and moves to the Research stage', async () => {
    const { app } = await setup();
    const id = await projectId(app);
    const res = await app.inject({ method: 'POST', url: `/api/projects/${id}/research`, headers: H });
    expect(res.statusCode).toBe(200);
    expect(res.json().project).toMatchObject({ stage: 'research', research: { summary: RESEARCH.summary, approvedAt: null, model: CLAUDE_MODEL } });
    expect(res.json().project.research.sources).toHaveLength(2);
  });

  it('feeds only approved research into the script', async () => {
    const briefs: unknown[] = [];
    const { app } = await setup({
      writeReel: async (brief) => {
        briefs.push(brief.research ?? null);
        return { script: SCRIPT, model: CLAUDE_MODEL };
      },
    });
    const id = await projectId(app);
    await app.inject({ method: 'POST', url: `/api/projects/${id}/research`, headers: H });
    await app.inject({ method: 'POST', url: `/api/projects/${id}/script`, headers: H });
    expect(briefs[0]).toBeNull();
    const approved = await app.inject({ method: 'POST', url: `/api/projects/${id}/research/approve`, headers: H });
    expect(approved.json().project.research.approvedAt).toEqual(expect.any(String));
    await app.inject({ method: 'POST', url: `/api/projects/${id}/script`, headers: H });
    expect(briefs[1]).toMatchObject({ summary: RESEARCH.summary });
  });

  it('works without a server key through claude.ai: prompt, paste, approve', async () => {
    const { app } = await setup({}, null);
    const id = await projectId(app);
    expect((await app.inject({ method: 'POST', url: `/api/projects/${id}/research`, headers: H })).statusCode).toBe(503);
    const prompt = (await app.inject({ method: 'GET', url: `/api/projects/${id}/research/prompt`, headers: H })).json().prompt as string;
    expect(prompt).toContain('Research this topic for a reel: How UPI works');
    expect(prompt).toContain('"facts"');
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

describe('claudeClient.research (real SDK, fake network)', () => {
  it('resumes a paused turn and parses the final JSON answer', async () => {
    const bodies: Record<string, unknown>[] = [];
    let call = 0;
    const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
      const req = new Request(input, init);
      bodies.push(JSON.parse(await req.text()));
      call++;
      const msg = (content: unknown[], stop: string) => ({ id: `m${call}`, type: 'message', role: 'assistant', model: CLAUDE_MODEL, content, stop_reason: stop, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } });
      const body =
        call === 1
          ? msg([{ type: 'server_tool_use', id: 'srv_1', name: 'web_search', input: { query: 'UPI NPCI' } }], 'pause_turn')
          : msg([{ type: 'text', text: '```json\n' + JSON.stringify(RESEARCH) + '\n```' }], 'end_turn');
      return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as unknown as typeof fetch;
    const out = await claudeClient('k', fetchImpl).research({ topic: 'How UPI works' });
    expect(out.research.summary).toBe(RESEARCH.summary);
    expect(out.searches).toBe(1);
    expect(bodies).toHaveLength(2);
    expect((bodies[0]!.tools as { type: string }[])[0]!.type).toBe('web_search_20260209');
    expect((bodies[1]!.messages as unknown[]).length).toBe(2);
  });
});

describe('storyboard edits', () => {
  it('saves an edited script, keeps who wrote it, marks it edited and moves to Storyboard', async () => {
    const { app } = await setup();
    const created = await app.inject({ method: 'POST', url: '/api/projects', headers: H, payload: { title: 'UPI', topic: 'How UPI works', durationSec: 60, qualityTier: 'standard' } });
    const id = created.json().project.id;
    await app.inject({ method: 'POST', url: `/api/projects/${id}/script`, headers: H });
    const edited = { ...SCRIPT, title: 'UPI in 1 second', beats: [SCRIPT.beats[1], SCRIPT.beats[0]] };
    const res = await app.inject({ method: 'PUT', url: `/api/projects/${id}/script`, headers: H, payload: { script: edited } });
    expect(res.statusCode).toBe(200);
    expect(res.json().project).toMatchObject({ stage: 'storyboard', script: { title: 'UPI in 1 second', model: CLAUDE_MODEL, editedAt: expect.any(String) } });
    expect(res.json().project.script.beats[0].id).toBe('npci');
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

describe('3D scenes in the script format', () => {
  it('accepts an iso script with scenes, and a train script with shots and effects', async () => {
    const { parsePastedScript } = await import('./reelPrompt');
    const iso = { ...SCRIPT, world: 'iso', beats: SCRIPT.beats.map((b, i) => ({ ...b, scene: { props: [{ id: 'you', kind: 'phone', label: 'You' }, { id: `b${i}`, kind: 'bank' }], links: [{ from: 'you', to: `b${i}`, label: 'Request' }], effect: 'rings', focus: 'you' } })) };
    expect(parsePastedScript(JSON.stringify(iso)).beats[0]!.scene!.props[1]!.kind).toBe('bank');
    const train = { ...SCRIPT, world: 'train', beats: SCRIPT.beats.map((b) => ({ ...b, shot: 'tower', events: ['rings', 'towerIds'] })) };
    expect(parsePastedScript(JSON.stringify(train)).beats[0]!.shot).toBe('tower');
  });

  it('keeps custom objects (icon, shape, colour) and the world theme', async () => {
    const { parsePastedScript } = await import('./reelPrompt');
    const scene = { props: [{ id: 'v', kind: 'custom', label: 'Virus', icon: '🦠', shape: 'round', tone: 'red' }], effect: 'pulse', focus: 'v' };
    const script = { ...SCRIPT, world: 'iso', theme: 'lab', beats: SCRIPT.beats.map((b) => ({ ...b, scene })) };
    const parsed = parsePastedScript(JSON.stringify(script));
    expect(parsed.theme).toBe('lab');
    expect(parsed.beats[0]!.scene!.props[0]).toEqual({ id: 'v', kind: 'custom', label: 'Virus', icon: '🦠', shape: 'round', tone: 'red' });
  });

  it('rejects objects the 3D kit cannot draw', async () => {
    const { parsePastedScript } = await import('./reelPrompt');
    const bad = { ...SCRIPT, beats: [{ ...SCRIPT.beats[0], scene: { props: [{ id: 'x', kind: 'dragon' }] } }] };
    expect(() => parsePastedScript(JSON.stringify(bad))).toThrow(/missing something/);
  });

  it('tells Claude about both worlds in the prompt', async () => {
    const { manualReelPrompt } = await import('./reelPrompt');
    const prompt = manualReelPrompt({ topic: 'UPI', durationSec: 30, language: 'en', niche: null, channelName: null });
    expect(prompt).toContain('"train" only for topics about trains');
    expect(prompt).toContain('satellite');
  });
});
