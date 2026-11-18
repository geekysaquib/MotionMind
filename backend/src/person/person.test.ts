import { randomBytes } from 'node:crypto';
import { describe, expect, it } from '@jest/globals';
import { buildApp } from '../app';
import { ConsoleMailer } from '../auth/mailer';
import { SessionTokens } from '../auth/session';
import { DevTokenVerifier } from '../auth/verifiers';
import { MemoryDataRepository } from '../data/repository';
import { MemoryAudioStore } from '../voice/audioStore';
import { cleanTitle, type PersonPhotoFetcher } from './routes';

const secret = randomBytes(32).toString('base64');
const JPG = Buffer.from('ffd8ffe000104a464946', 'hex');

const setup = (fetchPersonPhoto: PersonPhotoFetcher) =>
  buildApp({ data: new MemoryDataRepository(), audio: new MemoryAudioStore(), fetchPersonPhoto, sessions: new SessionTokens(secret), mailer: new ConsoleMailer(false), verifier: new DevTokenVerifier(), authSecret: secret, webOrigin: 'http://localhost:5173', mode: 'memory' });

describe('cleanTitle', () => {
  it('accepts names and refuses anything that could change the address', () => {
    expect(cleanTitle('Jensen_Huang')).toBe('Jensen Huang');
    expect(cleanTitle('A. P. J. Abdul Kalam')).toBe('A. P. J. Abdul Kalam');
    for (const bad of ['', 'x', '../etc/passwd', 'a?b=c', 'http://x.com']) expect(cleanTitle(bad)).toBeNull();
  });
});

describe('GET /api/person/:title', () => {
  it("serves the person's Wikipedia photo without signing in, cached, and initials when there is none", async () => {
    const asked: string[] = [];
    const app = await setup(async (title, lang) => {
      asked.push(`${lang}:${title}`);
      return title === 'Jensen Huang' ? { type: 'image/jpeg', body: JPG } : null;
    });
    const res = await app.inject({ method: 'GET', url: '/api/person/Jensen%20Huang' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('image/jpeg');
    expect(res.headers['x-photo']).toBe('wikipedia');
    await app.inject({ method: 'GET', url: '/api/person/Jensen%20Huang' });
    expect(asked).toEqual(['en:Jensen Huang']);

    const none = await app.inject({ method: 'GET', url: '/api/person/Nobody%20Known?lang=hi' });
    expect(none.headers['x-photo']).toBe('monogram');
    expect(none.headers['content-type']).toBe('image/svg+xml');
    expect(asked).toEqual(['en:Jensen Huang', 'hi:Nobody Known', 'en:Nobody Known']);

    expect((await app.inject({ method: 'GET', url: '/api/person/%2E%2E%2Fsecret' })).statusCode).toBe(400);
  });
});
