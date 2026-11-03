import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { log } from '../lib/logger';
import { apiRequest } from './http';
import { ServiceError } from './types';

const respond = (status: number, body: unknown) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
const lastEntry = () => log.all().at(-1);

describe('apiRequest', () => {
  afterEach(() => {
    log.clear();
    jest.restoreAllMocks();
  });

  it('sends JSON with the bearer token and returns the body', async () => {
    let seen: RequestInit | undefined;
    const fetchImpl = (async (_url: string, init?: RequestInit) => {
      seen = init;
      return new Response('{"ok":true}', { status: 200 });
    }) as unknown as typeof fetch;
    const out = await apiRequest<{ ok: boolean }>('http://api.test', '/projects', { method: 'POST', body: { title: 'A' }, token: 't1', fetchImpl });
    expect(out).toEqual({ ok: true });
    expect(seen?.headers).toEqual({ 'Content-Type': 'application/json', Authorization: 'Bearer t1' });
    expect(seen?.body).toBe('{"title":"A"}');
  });

  it('turns the server error into a ServiceError with its message and code, and logs a warning', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    const err = await apiRequest('', '/profile', { fetchImpl: respond(409, { error: 'handle_taken', message: 'That handle was just taken.' }) }).catch((e) => e);
    expect(err).toBeInstanceOf(ServiceError);
    expect(err).toMatchObject({ message: 'That handle was just taken.', code: 'handle_taken' });
    expect(lastEntry()).toMatchObject({ level: 'warn', scope: 'api', data: { status: 409, error: 'handle_taken' } });
  });

  it('logs server failures as errors and a 401 as info', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'info').mockImplementation(() => {});
    await apiRequest('', '/keys', { fetchImpl: respond(500, { error: 'internal', message: 'Something went wrong on the server.' }) }).catch(() => {});
    expect(lastEntry()?.level).toBe('error');
    const unauth = (await apiRequest('', '/keys', { fetchImpl: respond(401, {}) }).catch((e: unknown) => e)) as ServiceError;
    expect(unauth.code).toBe('unauthorized');
    expect(lastEntry()?.level).toBe('info');
  });

  it('explains when the API is unreachable', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const down = (async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    const err = await apiRequest('http://localhost:8787', '/projects', { fetchImpl: down }).catch((e) => e);
    expect(err).toMatchObject({ code: 'network', message: "Can't reach the Motion Mind API at http://localhost:8787. Is it running?" });
    expect(lastEntry()).toMatchObject({ level: 'error', msg: 'GET /projects could not reach the server' });
  });

  it("doesn't log calls that send logs", async () => {
    await apiRequest('', '/client-logs', { method: 'POST', body: {}, fetchImpl: respond(500, {}) }).catch(() => {});
    expect(log.all()).toHaveLength(0);
  });

  it('never puts the token in the log', async () => {
    log.setDebug(true);
    jest.spyOn(console, 'debug').mockImplementation(() => {});
    await apiRequest('', '/projects', { token: 'secret-token', fetchImpl: respond(200, {}) });
    log.setDebug(false);
    expect(JSON.stringify(log.all())).not.toContain('secret-token');
  });
});
