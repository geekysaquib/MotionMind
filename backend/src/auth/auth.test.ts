import { randomBytes } from 'node:crypto';
import { describe, expect, it } from '@jest/globals';
import { ConsoleMailer } from './mailer';
import { codeMatches, hashCode, newCode } from './otp';
import { SessionTokens } from './session';
import { AnyVerifier, DevTokenVerifier } from './verifiers';

const secret = randomBytes(32).toString('base64');

describe('login codes', () => {
  it('are always 6 digits, including leading zeros', () => {
    for (let i = 0; i < 200; i++) expect(newCode()).toMatch(/^\d{6}$/);
  });

  it('match only the same email, code and secret', () => {
    const h = hashCode(secret, 'a@x.com', '012345');
    expect(h).not.toContain('012345');
    expect(codeMatches(secret, 'a@x.com', '012345', h)).toBe(true);
    expect(codeMatches(secret, 'a@x.com', '012346', h)).toBe(false);
    expect(codeMatches(secret, 'b@x.com', '012345', h)).toBe(false);
    expect(codeMatches(randomBytes(32).toString('base64'), 'a@x.com', '012345', h)).toBe(false);
    expect(codeMatches(secret, 'a@x.com', '012345', 'short')).toBe(false);
  });
});

describe('SessionTokens', () => {
  const tokens = new SessionTokens(secret, 3600);

  it('round-trips the user id until it expires', async () => {
    const t = tokens.issue('user-1', 'a@x.com', 1_000_000);
    expect(t.split('.')).toHaveLength(3);
    expect(await tokens.verify(t, 1_000_000 + 3599_000)).toBe('user-1');
    expect(await tokens.verify(t, 1_000_000 + 3601_000)).toBeNull();
  });

  it('rejects tampered, foreign and malformed tokens', async () => {
    const t = tokens.issue('user-1', 'a@x.com');
    const [h, , s] = t.split('.');
    const forgedBody = Buffer.from(JSON.stringify({ sub: 'admin', exp: 9999999999 })).toString('base64url');
    expect(await tokens.verify(`${h}.${forgedBody}.${s}`)).toBeNull();
    expect(await new SessionTokens(randomBytes(32).toString('base64')).verify(t)).toBeNull();
    for (const bad of ['', 'abc', 'a.b', 'a.b.c', `${h}.!!!.${s}`]) expect(await tokens.verify(bad)).toBeNull();
  });
});

describe('verifiers', () => {
  it('DevTokenVerifier accepts only dev:<id>', async () => {
    const v = new DevTokenVerifier();
    expect(await v.verify('dev:u1')).toBe('u1');
    expect(await v.verify('dev:')).toBeNull();
    expect(await v.verify('u1')).toBeNull();
  });

  it('AnyVerifier tries each in turn', async () => {
    const tokens = new SessionTokens(secret);
    const v = new AnyVerifier([tokens, new DevTokenVerifier()]);
    expect(await v.verify(tokens.issue('real', 'a@x.com'))).toBe('real');
    expect(await v.verify('dev:demo')).toBe('demo');
    expect(await v.verify('nonsense')).toBeNull();
  });
});

describe('ConsoleMailer', () => {
  it('keeps what it would have sent', async () => {
    const m = new ConsoleMailer(false);
    await m.sendLoginCode('a@x.com', '123456');
    expect(m.sent).toEqual([{ to: 'a@x.com', code: '123456' }]);
  });
});
