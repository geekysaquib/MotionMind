import { randomBytes } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from './app';
import { DevTokenVerifier } from './auth';
import { KeyCipher } from './crypto';
import { MemoryKeyRepository } from './keys/repository';
import { KEY_TESTERS } from './providers/testers';

const secret = randomBytes(32).toString('base64');
const A = { authorization: 'Bearer dev:user-a' };
const B = { authorization: 'Bearer dev:user-b' };

async function setup(fetchImpl?: typeof fetch) {
  const keys = new MemoryKeyRepository();
  const app = await buildApp({ keys, verifier: new DevTokenVerifier(), cipher: new KeyCipher(secret), webOrigin: 'http://localhost:5173', mode: 'memory', fetchImpl });
  return { app, keys };
}

describe('API keys', () => {
  let ctx: Awaited<ReturnType<typeof setup>>;
  beforeEach(async () => {
    ctx = await setup();
  });

  it('rejects requests without a token', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/api/keys' });
    expect(res.statusCode).toBe(401);
  });

  it('stores a key encrypted and never returns it', async () => {
    const key = 'sk_test_1234567890abcd';
    const put = await ctx.app.inject({ method: 'PUT', url: '/api/keys/elevenlabs', headers: A, payload: { apiKey: key } });
    expect(put.statusCode).toBe(200);
    expect(put.body).not.toContain(key);
    expect(put.json().key.last4).toBe('abcd');
    const stored = await ctx.keys.get('user-a', 'elevenlabs');
    expect(stored?.ciphertext).not.toContain(key);
    const list = await ctx.app.inject({ method: 'GET', url: '/api/keys', headers: A });
    expect(list.body).not.toContain(key);
    expect(list.json().keys).toHaveLength(1);
  });

  it('isolates users', async () => {
    await ctx.app.inject({ method: 'PUT', url: '/api/keys/openai', headers: A, payload: { apiKey: 'sk-aaaaaaaaaaaa' } });
    const list = await ctx.app.inject({ method: 'GET', url: '/api/keys', headers: B });
    expect(list.json().keys).toHaveLength(0);
  });

  it('cannot decrypt a row copied to another user', async () => {
    const cipher = new KeyCipher(secret);
    const sealed = cipher.seal('sk-secret', 'user-a:openai');
    expect(() => cipher.open(sealed, 'user-b:openai')).toThrow();
  });

  it('validates provider and key', async () => {
    expect((await ctx.app.inject({ method: 'PUT', url: '/api/keys/nope', headers: A, payload: { apiKey: 'x'.repeat(20) } })).statusCode).toBe(404);
    expect((await ctx.app.inject({ method: 'PUT', url: '/api/keys/openai', headers: A, payload: { apiKey: 'short' } })).statusCode).toBe(400);
  });

  it('deletes a key', async () => {
    await ctx.app.inject({ method: 'PUT', url: '/api/keys/openai', headers: A, payload: { apiKey: 'sk-aaaaaaaaaaaa' } });
    expect((await ctx.app.inject({ method: 'DELETE', url: '/api/keys/openai', headers: A })).statusCode).toBe(200);
    expect((await ctx.app.inject({ method: 'DELETE', url: '/api/keys/openai', headers: A })).statusCode).toBe(404);
  });
});

describe('key testing', () => {
  it('calls the provider with the decrypted key and records the result', async () => {
    let seen = '';
    const fakeFetch = (async (_url: string, init?: RequestInit) => {
      seen = (init?.headers as Record<string, string>)['xi-api-key'] ?? '';
      return new Response('{}', { status: 200 });
    }) as unknown as typeof fetch;
    const { app, keys } = await setup(fakeFetch);
    await app.inject({ method: 'PUT', url: '/api/keys/elevenlabs', headers: A, payload: { apiKey: 'sk_live_9999999999' } });
    const res = await app.inject({ method: 'POST', url: '/api/keys/elevenlabs/test', headers: A });
    expect(res.json().result.ok).toBe(true);
    expect(seen).toBe('sk_live_9999999999');
    expect((await keys.get('user-a', 'elevenlabs'))?.lastTestOk).toBe(true);
  });

  it('reports a rejected key', async () => {
    const fakeFetch = (async () => new Response('{}', { status: 401 })) as unknown as typeof fetch;
    const res = await KEY_TESTERS.openai!('sk-bad', fakeFetch);
    expect(res).toEqual({ ok: false, detail: 'The provider rejected this key.' });
  });

  it('says honestly when a provider has no free test', async () => {
    const { app } = await setup();
    await app.inject({ method: 'PUT', url: '/api/keys/tavily', headers: A, payload: { apiKey: 'tvly-aaaaaaaaaaaa' } });
    const res = await app.inject({ method: 'POST', url: '/api/keys/tavily/test', headers: A });
    expect(res.json().tested).toBe(false);
  });
});
