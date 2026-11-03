import { randomBytes } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { ConsoleMailer } from './accounts/mailer';
import { SessionTokens } from './accounts/session';
import { buildApp } from './app';
import { DevTokenVerifier } from './auth';
import { KeyCipher } from './crypto';
import { MemoryDataRepository } from './data/repository';
import { MemoryKeyRepository } from './keys/repository';
import { KEY_TESTERS } from './providers/testers';

const secret = randomBytes(32).toString('base64');
const A = { authorization: 'Bearer dev:user-a' };
const B = { authorization: 'Bearer dev:user-b' };

async function setup(fetchImpl?: typeof fetch) {
  const keys = new MemoryKeyRepository();
  const mailer = new ConsoleMailer(false);
  const app = await buildApp({
    keys,
    data: new MemoryDataRepository(),
    sessions: new SessionTokens(secret),
    mailer,
    verifier: new DevTokenVerifier(),
    authSecret: secret,
    cipher: new KeyCipher(secret),
    webOrigin: 'http://localhost:5173',
    mode: 'memory',
    fetchImpl,
  });
  return { app, keys, mailer };
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

describe('email code sign-in', () => {
  const email = 'Saquib@Example.com';

  it('emails a code and trades it for a working session', async () => {
    const { app, mailer } = await setup();
    expect((await app.inject({ method: 'POST', url: '/api/auth/request-code', payload: { email } })).statusCode).toBe(200);
    expect(mailer.sent[0]?.to).toBe('saquib@example.com');
    const code = mailer.sent[0]!.code;
    expect(code).toMatch(/^\d{6}$/);

    const res = await app.inject({ method: 'POST', url: '/api/auth/verify-code', payload: { email, code } });
    expect(res.statusCode).toBe(200);
    const { token, user } = res.json();
    expect(user.email).toBe('saquib@example.com');

    // Session tokens are checked by SessionTokens directly; the test app's verifier only knows dev tokens.
    expect(await new SessionTokens(secret).verify(token)).toBe(user.id);
    const again = await app.inject({ method: 'POST', url: '/api/auth/verify-code', payload: { email, code } });
    expect(again.statusCode).toBe(400);
  });

  it('rejects wrong codes and locks out after five tries', async () => {
    const { app, mailer } = await setup();
    await app.inject({ method: 'POST', url: '/api/auth/request-code', payload: { email } });
    const wrong = mailer.sent[0]!.code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) {
      expect((await app.inject({ method: 'POST', url: '/api/auth/verify-code', payload: { email, code: wrong } })).statusCode).toBe(400);
    }
    const locked = await app.inject({ method: 'POST', url: '/api/auth/verify-code', payload: { email, code: mailer.sent[0]!.code } });
    expect(locked.statusCode).toBe(429);
  });

  it('makes you wait before resending', async () => {
    const { app } = await setup();
    await app.inject({ method: 'POST', url: '/api/auth/request-code', payload: { email } });
    expect((await app.inject({ method: 'POST', url: '/api/auth/request-code', payload: { email } })).statusCode).toBe(429);
  });

  it('rejects bad emails and expired or forged tokens', async () => {
    const { app } = await setup();
    expect((await app.inject({ method: 'POST', url: '/api/auth/request-code', payload: { email: 'nope' } })).statusCode).toBe(400);
    const tokens = new SessionTokens(secret, 60);
    const t = tokens.issue('u1', 'a@x.com', 0);
    expect(await tokens.verify(t, 30_000)).toBe('u1');
    expect(await tokens.verify(t, 61_000)).toBeNull();
    expect(await new SessionTokens(randomBytes(32).toString('base64')).verify(t, 30_000)).toBeNull();
  });
});

describe('profile and projects', () => {
  async function signedIn() {
    const ctx = await setup();
    await ctx.app.inject({ method: 'POST', url: '/api/auth/request-code', payload: { email: 'a@x.com' } });
    const res = await ctx.app.inject({ method: 'POST', url: '/api/auth/verify-code', payload: { email: 'a@x.com', code: ctx.mailer.sent[0]!.code } });
    const H = { authorization: `Bearer dev:${res.json().user.id}` };
    return { ...ctx, H };
  }

  it('creates a profile on first sign-in and saves a handle', async () => {
    const { app, H } = await signedIn();
    const profile = (await app.inject({ method: 'GET', url: '/api/profile', headers: H })).json().profile;
    expect(profile.handle).toBeNull();
    const avail = await app.inject({ method: 'GET', url: '/api/handles/motion.mind/available', headers: H });
    expect(avail.json().available).toBe(true);
    const saved = await app.inject({ method: 'PATCH', url: '/api/profile', headers: H, payload: { handle: '@Motion.Mind', displayName: 'Saquib' } });
    expect(saved.json().profile.handle).toBe('motion.mind');
    expect((await app.inject({ method: 'PATCH', url: '/api/profile', headers: H, payload: { handle: 'ad' } })).statusCode).toBe(400);
  });

  it('creates, updates, lists and deletes only your own projects', async () => {
    const { app, H } = await signedIn();
    const created = await app.inject({ method: 'POST', url: '/api/projects', headers: H, payload: { title: 'UPI', topic: null, durationSec: 30, qualityTier: 'draft' } });
    const id = created.json().project.id;
    const updated = await app.inject({ method: 'PATCH', url: `/api/projects/${id}`, headers: H, payload: { status: 'completed' } });
    expect(updated.json().project.status).toBe('completed');
    expect((await app.inject({ method: 'GET', url: '/api/projects', headers: H })).json().projects).toHaveLength(1);
    expect((await app.inject({ method: 'GET', url: '/api/projects', headers: B })).json().projects).toHaveLength(0);
    expect((await app.inject({ method: 'GET', url: `/api/projects/${id}`, headers: B })).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: '/api/projects/not-a-uuid', headers: H })).statusCode).toBe(404);
    expect((await app.inject({ method: 'POST', url: '/api/projects', headers: H, payload: { title: '', topic: null, durationSec: 30, qualityTier: 'draft' } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'DELETE', url: `/api/projects/${id}`, headers: H })).statusCode).toBe(200);
  });
});
