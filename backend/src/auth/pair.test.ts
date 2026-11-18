import { randomBytes } from 'node:crypto';
import { describe, expect, it } from '@jest/globals';
import { buildApp } from '../app';
import { ConsoleMailer } from './mailer';
import { SessionTokens } from './session';
import { MemoryDataRepository } from '../data/repository';
import { PairCodes } from './pair';

const secret = randomBytes(32).toString('base64');

async function setup() {
  const sessions = new SessionTokens(secret);
  const app = await buildApp({ data: new MemoryDataRepository(), sessions, mailer: new ConsoleMailer(false), authSecret: secret, webOrigin: 'http://localhost:5173', mode: 'memory', lanAddresses: () => ['192.168.1.20'] });
  return { app, token: sessions.issue('user-a', 'a@example.com'), sessions };
}

describe('phone pairing', () => {
  it('gives the PC a QR code for the Terminal, and the phone a session of the same account, once', async () => {
    const { app, token, sessions } = await setup();
    expect((await app.inject({ method: 'POST', url: '/api/auth/pair-code', payload: {} })).statusCode).toBe(401);

    const made = await app.inject({ method: 'POST', url: '/api/auth/pair-code', headers: { authorization: `Bearer ${token}` }, payload: { webPort: 5173 } });
    expect(made.statusCode).toBe(200);
    const { code, urls, qr } = made.json() as { code: string; urls: string[]; qr: string };
    expect(urls).toEqual([`http://192.168.1.20:5173/t/pair#${code}`]);
    expect(qr).toContain('<svg');

    const paired = await app.inject({ method: 'POST', url: '/api/auth/pair', payload: { code } });
    expect(paired.statusCode).toBe(200);
    expect(paired.json().user).toEqual({ id: 'user-a', email: 'a@example.com' });
    expect(await sessions.verify(paired.json().token)).toBe('user-a');

    // One use only.
    const again = await app.inject({ method: 'POST', url: '/api/auth/pair', payload: { code } });
    expect(again.json().error).toBe('pair_expired');
  });

  it('refuses an expired code', () => {
    const codes = new PairCodes();
    const { code } = codes.issue('u', 'e', 0);
    expect(codes.take(code, 6 * 60_000)).toBeNull();
  });
});
