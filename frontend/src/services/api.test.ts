import { describe, expect, it } from '@jest/globals';
import { apiServices } from './api';
import type { Storage } from './memory';

function mem(): Storage {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
}

/** A fake API: answers by path, and records what the app sent. */
function fakeApi(routes: Record<string, (init: RequestInit) => [number, unknown]>) {
  const calls: { path: string; init: RequestInit }[] = [];
  const fetchImpl = (async (url: string, init: RequestInit = {}) => {
    const path = url.replace('http://api.test/api', '');
    calls.push({ path, init });
    const [status, body] = routes[`${init.method ?? 'GET'} ${path}`]?.(init) ?? [404, { error: 'not_found' }];
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

describe('apiServices', () => {
  it('signs in with a code, keeps the session and sends it as a bearer token', async () => {
    const api = fakeApi({
      'POST /auth/request-code': () => [200, { ok: true }],
      'POST /auth/verify-code': () => [200, { token: 'tok-1', user: { id: 'u1', email: 'a@x.com' } }],
      'GET /projects': () => [200, { projects: [] }],
    });
    const storage = mem();
    const svc = apiServices(storage, 'http://api.test', api.fetchImpl);
    await svc.auth.requestCode('a@x.com');
    await svc.auth.verifyCode('a@x.com', '123456');
    expect(await svc.auth.getSession()).toEqual({ userId: 'u1', email: 'a@x.com', accessToken: 'tok-1' });
    await svc.projects.list();
    expect((api.calls.at(-1)?.init.headers as Record<string, string>).Authorization).toBe('Bearer tok-1');

    // A reload finds the same session.
    expect(await apiServices(storage, 'http://api.test', api.fetchImpl).auth.getSession()).not.toBeNull();
  });

  it('shows the server message and signs out when the session expires', async () => {
    const api = fakeApi({
      'POST /auth/verify-code': () => [200, { token: 't', user: { id: 'u1', email: 'a@x.com' } }],
      'GET /profile': () => [401, { error: 'unauthorized', message: 'Sign in again.' }],
    });
    const svc = apiServices(mem(), 'http://api.test', api.fetchImpl);
    const events: string[] = [];
    svc.auth.onChange((_s, e) => events.push(e));
    await svc.auth.verifyCode('a@x.com', '123456');
    await expect(svc.profiles.get('u1')).rejects.toThrow('Sign in again.');
    expect(await svc.auth.getSession()).toBeNull();
    expect(events).toEqual(['SIGNED_IN', 'SIGNED_OUT']);
  });

  it('treats a missing project as null', async () => {
    const api = fakeApi({ 'POST /auth/verify-code': () => [200, { token: 't', user: { id: 'u1', email: 'a@x.com' } }] });
    const svc = apiServices(mem(), 'http://api.test', api.fetchImpl);
    await svc.auth.verifyCode('a@x.com', '123456');
    expect(await svc.projects.get('00000000-0000-0000-0000-000000000000')).toBeNull();
  });
});
