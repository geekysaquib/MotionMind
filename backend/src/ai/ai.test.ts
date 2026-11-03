import { randomBytes } from 'node:crypto';
import { describe, expect, it } from '@jest/globals';
import { buildApp } from '../app';
import { ConsoleMailer } from '../auth/mailer';
import { SessionTokens } from '../auth/session';
import { DevTokenVerifier } from '../auth/verifiers';
import { MemoryDataRepository } from '../data/repository';
import { KeyCipher } from '../keys/crypto';
import { MemoryKeyRepository } from '../keys/repository';
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

async function setup(fake: Partial<ClaudeClient> = {}) {
  const keys = new MemoryKeyRepository();
  const data = new MemoryDataRepository();
  const seen: { apiKey: string }[] = [];
  const app = await buildApp({
    keys,
    data,
    sessions: new SessionTokens(secret),
    mailer: new ConsoleMailer(false),
    verifier: new DevTokenVerifier(),
    authSecret: secret,
    cipher: new KeyCipher(secret),
    webOrigin: 'http://localhost:5173',
    mode: 'memory',
    claude: (apiKey) => {
      seen.push({ apiKey });
      return {
        ask: async (prompt) => ({ text: `echo: ${prompt}`, model: CLAUDE_MODEL, inputTokens: 10, outputTokens: 5 }),
        writeReel: async () => ({ script: SCRIPT, model: CLAUDE_MODEL }),
        ...fake,
      };
    },
  });
  const connect = () => app.inject({ method: 'PUT', url: '/api/keys/anthropic', headers: H, payload: { apiKey: 'sk-ant-test-123456' } });
  return { app, data, seen, connect };
}

describe('Claude routes', () => {
  it('reports whether Claude is connected', async () => {
    const { app, connect } = await setup();
    expect((await app.inject({ method: 'GET', url: '/api/claude/status', headers: H })).json()).toEqual({ connected: false, model: CLAUDE_MODEL, last4: null, working: null });
    await connect();
    expect((await app.inject({ method: 'GET', url: '/api/claude/status', headers: H })).json()).toMatchObject({ connected: true, last4: '3456' });
  });

  it('asks Claude with the decrypted key of the signed-in user', async () => {
    const { app, seen, connect } = await setup();
    const before = await app.inject({ method: 'POST', url: '/api/claude/ask', headers: H, payload: { prompt: 'hi' } });
    expect(before.statusCode).toBe(409);
    expect(before.json().message).toMatch(/Connect Claude first/);
    await connect();
    const res = await app.inject({ method: 'POST', url: '/api/claude/ask', headers: H, payload: { prompt: 'hi' } });
    expect(res.statusCode).toBe(200);
    expect(res.json().reply).toMatchObject({ text: 'echo: hi', model: CLAUDE_MODEL });
    expect(seen).toEqual([{ apiKey: 'sk-ant-test-123456' }]);
    expect((await app.inject({ method: 'POST', url: '/api/claude/ask', headers: H, payload: { prompt: '  ' } })).statusCode).toBe(400);
  });

  it('passes Claude errors through with their status and message', async () => {
    const { app, connect } = await setup({
      ask: async () => {
        throw new ClaudeError('Claude rejected the API key. Check it in Settings > Claude.', 'claude_key_rejected', 400);
      },
    });
    await connect();
    const res = await app.inject({ method: 'POST', url: '/api/claude/ask', headers: H, payload: { prompt: 'hi' } });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'claude_key_rejected', message: 'Claude rejected the API key. Check it in Settings > Claude.' });
    expect((await app.inject({ method: 'GET', url: '/api/claude/status', headers: H })).json().working).toBe(false);
  });

  it('writes and saves a reel script for a project, and moves it to the Script stage', async () => {
    const { app, connect } = await setup();
    await connect();
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
    const { app, connect } = await setup();
    await connect();
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
    await expect(claudeClient('bad', api.fetchImpl).ask('hello')).rejects.toMatchObject({ code: 'claude_key_rejected', status: 400 });
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
