import { randomBytes } from 'node:crypto';
import { describe, expect, it } from '@jest/globals';
import { buildApp } from '../app';
import { ConsoleMailer } from '../auth/mailer';
import { SessionTokens } from '../auth/session';
import { DevTokenVerifier } from '../auth/verifiers';
import { MemoryDataRepository } from '../data/repository';
import { KeyCipher } from '../keys/crypto';
import { MemoryKeyRepository } from '../keys/repository';
import type { ClientLogReport } from './routes';

const secret = randomBytes(32).toString('base64');

async function setup() {
  const reports: ClientLogReport[] = [];
  const app = await buildApp({
    keys: new MemoryKeyRepository(),
    data: new MemoryDataRepository(),
    sessions: new SessionTokens(secret),
    mailer: new ConsoleMailer(false),
    verifier: new DevTokenVerifier(),
    authSecret: secret,
    cipher: new KeyCipher(secret),
    webOrigin: 'http://localhost:5173',
    mode: 'memory',
    clientLogSink: (r) => reports.push(r),
  });
  return { app, reports };
}

const entry = { t: '2026-11-03T10:00:00.000Z', level: 'error', scope: 'api', msg: 'GET /projects failed', data: { status: 500 } };

describe('POST /api/client-logs', () => {
  it('accepts browser errors without sign-in', async () => {
    const { app, reports } = await setup();
    const res = await app.inject({ method: 'POST', url: '/api/client-logs', payload: { entries: [entry], page: '/app' } });
    expect(res.statusCode).toBe(204);
    expect(reports).toEqual([{ entries: [entry], page: '/app', userId: null }]);
  });

  it('records who sent it when signed in', async () => {
    const { app, reports } = await setup();
    await app.inject({ method: 'POST', url: '/api/client-logs', headers: { authorization: 'Bearer dev:u1' }, payload: { entries: [entry] } });
    expect(reports[0]?.userId).toBe('u1');
  });

  it('rejects malformed, empty or oversized reports', async () => {
    const { app, reports } = await setup();
    const post = (payload: unknown) => app.inject({ method: 'POST', url: '/api/client-logs', payload: payload as object });
    expect((await post({ entries: [] })).statusCode).toBe(400);
    expect((await post({ entries: [{ ...entry, level: 'fatal' }] })).statusCode).toBe(400);
    expect((await post({ entries: Array.from({ length: 21 }, () => entry) })).statusCode).toBe(400);
    expect((await post({ entries: [{ ...entry, msg: 'x'.repeat(40_000) }] })).statusCode).toBe(413);
    expect(reports).toHaveLength(0);
  });
});
