import { randomBytes } from 'node:crypto';
import { describe, expect, it } from '@jest/globals';
import { ConsoleMailer } from './auth/mailer';
import { SessionTokens } from './auth/session';
import { buildApp } from './app';
import { DevTokenVerifier } from './auth/verifiers';
import { MemoryDataRepository } from './data/repository';

const secret = randomBytes(32).toString('base64');
const A = { authorization: 'Bearer dev:user-a' };
const B = { authorization: 'Bearer dev:user-b' };

async function setup() {
  const mailer = new ConsoleMailer(false);
  const app = await buildApp({
    data: new MemoryDataRepository(),
    sessions: new SessionTokens(secret),
    mailer,
    verifier: new DevTokenVerifier(),
    authSecret: secret,
    webOrigin: 'http://localhost:5173',
    mode: 'memory',
  });
  return { app, mailer };
}

describe('signed-in routes', () => {
  it('reject requests without a valid token', async () => {
    const { app } = await setup();
    expect((await app.inject({ method: 'GET', url: '/api/projects' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/api/profile', headers: { authorization: 'Bearer nope' } })).statusCode).toBe(401);
  });

  it('no longer offer per-user API keys', async () => {
    const { app } = await setup();
    expect((await app.inject({ method: 'GET', url: '/api/keys', headers: A })).statusCode).toBe(404);
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

  it('keeps how you work with AI on your account, and refuses anything else', async () => {
    const { app, H } = await signedIn();
    expect((await app.inject({ method: 'GET', url: '/api/profile', headers: H })).json().profile.aiMode).toBeNull();
    const saved = await app.inject({ method: 'PATCH', url: '/api/profile', headers: H, payload: { aiMode: 'keys' } });
    expect(saved.json().profile.aiMode).toBe('keys');
    expect((await app.inject({ method: 'GET', url: '/api/profile', headers: H })).json().profile.aiMode).toBe('keys');
    expect((await app.inject({ method: 'PATCH', url: '/api/profile', headers: H, payload: { aiMode: 'magic' } })).statusCode).toBe(400);
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

describe('error responses', () => {
  it('keeps 4xx for malformed requests instead of turning them into 500s', async () => {
    const { app } = await setup();
    const res = await app.inject({ method: 'POST', url: '/api/auth/request-code', headers: { 'content-type': 'application/json' }, payload: '{not json' });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: expect.any(String), message: expect.any(String) });
  });
});
