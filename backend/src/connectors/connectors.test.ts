import { randomBytes } from 'node:crypto';
import { describe, expect, it } from '@jest/globals';
import { buildApp } from '../app';
import { ConsoleMailer } from '../auth/mailer';
import { SessionTokens } from '../auth/session';
import { DevTokenVerifier } from '../auth/verifiers';
import { MemoryDataRepository } from '../data/repository';
import { checkElevenLabs } from './elevenlabs';

const secret = randomBytes(32).toString('base64');
const H = { authorization: 'Bearer dev:u1' };
const answer = (status: number, body: unknown = {}) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

async function setup(opts: { anthropic?: string; eleven?: string; fetchImpl?: typeof fetch } = {}) {
  return buildApp({
    data: new MemoryDataRepository(),
    sessions: new SessionTokens(secret),
    mailer: new ConsoleMailer(false),
    verifier: new DevTokenVerifier(),
    authSecret: secret,
    webOrigin: 'http://localhost:5173',
    mode: 'memory',
    anthropicApiKey: opts.anthropic,
    elevenLabsApiKey: opts.eleven,
    fetchImpl: opts.fetchImpl,
  });
}

describe('GET /api/connectors', () => {
  it('lists exactly Claude and ElevenLabs, with whether the server has each key', async () => {
    const app = await setup({ anthropic: 'sk-ant-server-123456' });
    const res = await app.inject({ method: 'GET', url: '/api/connectors', headers: H });
    const list = res.json().connectors as { id: string; connected: boolean }[];
    expect(list.map((c) => [c.id, c.connected])).toEqual([
      ['claude', true],
      ['elevenlabs', false],
    ]);
    expect(JSON.stringify(res.json())).not.toContain('sk-ant-server');
  });

  it('needs sign-in', async () => {
    const app = await setup();
    expect((await app.inject({ method: 'GET', url: '/api/connectors' })).statusCode).toBe(401);
  });
});

describe('POST /api/connectors/elevenlabs/test', () => {
  it('says when the server has no ElevenLabs key', async () => {
    const res = await (await setup()).inject({ method: 'POST', url: '/api/connectors/elevenlabs/test', headers: H });
    expect(res.statusCode).toBe(503);
    expect(res.json().error).toBe('elevenlabs_not_configured');
  });

  it('checks the key by listing voices', async () => {
    const fetchImpl = answer(200, { voices: [{ voice_id: 'v1', name: 'Aarav' }, { voice_id: 'v2', name: 'Diya' }] });
    const res = await (await setup({ eleven: 'el-server-key', fetchImpl })).inject({ method: 'POST', url: '/api/connectors/elevenlabs/test', headers: H });
    expect(res.json().result).toEqual({ ok: true, detail: 'Connected. 2 voices available.', voices: [{ id: 'v1', name: 'Aarav' }, { id: 'v2', name: 'Diya' }] });
  });
});

describe('checkElevenLabs', () => {
  it('sends the key and reports rejections, errors and outages without throwing', async () => {
    let seen = '';
    const spy = (async (_u: string, init?: RequestInit) => {
      seen = (init?.headers as Record<string, string>)['xi-api-key'] ?? '';
      return new Response('{"voices":[]}', { status: 200 });
    }) as unknown as typeof fetch;
    expect((await checkElevenLabs('el-key', spy)).detail).toBe('Connected. 0 voices available.');
    expect(seen).toBe('el-key');
    expect((await checkElevenLabs('k', answer(401))).detail).toMatch(/rejected/);
    expect((await checkElevenLabs('k', answer(500))).detail).toMatch(/HTTP 500/);
    const down = (async () => {
      throw new Error('ENOTFOUND');
    }) as unknown as typeof fetch;
    expect((await checkElevenLabs('k', down)).ok).toBe(false);
  });
});
