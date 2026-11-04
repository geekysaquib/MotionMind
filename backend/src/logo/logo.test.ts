import { randomBytes } from 'node:crypto';
import { describe, expect, it } from '@jest/globals';
import { buildApp } from '../app';
import { ConsoleMailer } from '../auth/mailer';
import { SessionTokens } from '../auth/session';
import { DevTokenVerifier } from '../auth/verifiers';
import { MemoryDataRepository } from '../data/repository';
import { MemoryAudioStore } from '../voice/audioStore';
import { cleanDomain, monogram } from './routes';

const secret = randomBytes(32).toString('base64');
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');

async function setup(fetchLogo: (d: string) => Promise<{ type: string; body: Buffer } | null>) {
  return buildApp({ data: new MemoryDataRepository(), audio: new MemoryAudioStore(), fetchLogo, sessions: new SessionTokens(secret), mailer: new ConsoleMailer(false), verifier: new DevTokenVerifier(), authSecret: secret, webOrigin: 'http://localhost:5173', mode: 'memory' });
}

describe('cleanDomain', () => {
  it('reduces a pasted address to a bare host and refuses anything that is not a website name', () => {
    expect(cleanDomain('https://www.IRCTC.co.in/nget?x=1')).toBe('irctc.co.in');
    expect(cleanDomain('paytm.com')).toBe('paytm.com');
    for (const bad of ['localhost', '127.0.0.1', 'a b.com', '../etc/passwd', 'x.c', '', 'http://']) expect(cleanDomain(bad)).toBeNull();
  });
});

describe('GET /api/logo/:domain', () => {
  it('serves the logo a service found, from cache the second time, without signing in', async () => {
    let calls = 0;
    const app = await setup(async () => {
      calls++;
      return { type: 'image/png', body: PNG };
    });
    const a = await app.inject({ method: 'GET', url: '/api/logo/paytm.com' });
    expect(a.statusCode).toBe(200);
    expect(a.headers['content-type']).toBe('image/png');
    expect(a.headers['x-logo']).toBe('found');
    await app.inject({ method: 'GET', url: '/api/logo/paytm.com' });
    expect(calls).toBe(1);
  });

  it('draws the initials when no service knows the site, so the reel never has a hole', async () => {
    const app = await setup(async () => null);
    const res = await app.inject({ method: 'GET', url: '/api/logo/irctc.co.in?name=IRCTC' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('image/svg+xml');
    expect(res.headers['x-logo']).toBe('monogram');
    expect(res.body).toContain('IR');
  });

  it('refuses names that are not websites, and never asks the fetcher about them', async () => {
    let calls = 0;
    const app = await setup(async () => {
      calls++;
      return null;
    });
    expect((await app.inject({ method: 'GET', url: '/api/logo/localhost' })).statusCode).toBe(400);
    expect((await app.inject({ method: 'GET', url: '/api/logo/10.0.0.1' })).statusCode).toBe(400);
    expect(calls).toBe(0);
  });
});

describe('monogram', () => {
  it('uses two initials of a two-word name, the first two letters of one word, and escapes markup', () => {
    expect(monogram('hdfcbank.com', 'HDFC Bank').body.toString()).toContain('>HB<');
    expect(monogram('irctc.co.in', 'IRCTC').body.toString()).toContain('>IR<');
    expect(monogram('x.com', '<b>').body.toString()).not.toContain('<b>');
  });
});
