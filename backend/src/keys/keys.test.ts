import { randomBytes } from 'node:crypto';
import { describe, expect, it } from '@jest/globals';
import { KeyCipher, last4 } from './crypto';
import { MemoryKeyRepository, toSummary } from './repository';
import { KEY_TESTERS } from './testers';

describe('KeyCipher', () => {
  const cipher = new KeyCipher(randomBytes(32).toString('base64'));

  it('encrypts with a fresh IV every time and decrypts back', () => {
    const a = cipher.seal('sk-secret', 'u1:openai');
    const b = cipher.seal('sk-secret', 'u1:openai');
    expect(a.ciphertext).not.toBe(b.ciphertext);
    expect(a.iv).not.toBe(b.iv);
    expect(cipher.open(a, 'u1:openai')).toBe('sk-secret');
  });

  it('refuses tampered data or the wrong owner', () => {
    const sealed = cipher.seal('sk-secret', 'u1:openai');
    expect(() => cipher.open(sealed, 'u2:openai')).toThrow();
    const flipped = Buffer.from(sealed.ciphertext, 'base64');
    flipped[0] = (flipped[0] ?? 0) ^ 1;
    expect(() => cipher.open({ ...sealed, ciphertext: flipped.toString('base64') }, 'u1:openai')).toThrow();
    expect(() => new KeyCipher(randomBytes(32).toString('base64')).open(sealed, 'u1:openai')).toThrow();
  });

  it('needs a 32-byte secret', () => {
    expect(() => new KeyCipher(randomBytes(16).toString('base64'))).toThrow('32 bytes');
  });

  it('last4 shows only the end of a key', () => {
    expect(last4('sk-1234567890abcd')).toBe('abcd');
  });
});

describe('MemoryKeyRepository', () => {
  it('upserts per user and provider, and summaries never include secrets', async () => {
    const repo = new MemoryKeyRepository();
    const base = { ciphertext: 'c', iv: 'i', authTag: 't', last4: 'abcd' };
    await repo.upsert({ userId: 'u1', provider: 'openai', ...base });
    await repo.upsert({ userId: 'u1', provider: 'openai', ...base, last4: 'wxyz' });
    await repo.upsert({ userId: 'u2', provider: 'openai', ...base });
    const mine = await repo.list('u1');
    expect(mine).toHaveLength(1);
    expect(toSummary(mine[0]!)).toEqual({ provider: 'openai', last4: 'wxyz', updatedAt: expect.any(String), lastTestedAt: null, lastTestOk: null });
    await repo.markTested('u1', 'openai', true);
    expect((await repo.get('u1', 'openai'))?.lastTestOk).toBe(true);
    expect(await repo.remove('u1', 'openai')).toBe(true);
    expect(await repo.remove('u1', 'openai')).toBe(false);
  });
});

describe('provider key testers', () => {
  const answer = (status: number) => (async () => new Response('{}', { status })) as unknown as typeof fetch;

  it('report accepted, rejected and unexpected answers', async () => {
    const tester = KEY_TESTERS.openai!;
    expect((await tester('sk', answer(200))).ok).toBe(true);
    expect(await tester('sk', answer(403))).toEqual({ ok: false, detail: 'The provider rejected this key.' });
    expect(await tester('sk', answer(500))).toEqual({ ok: false, detail: 'The provider answered with HTTP 500.' });
  });

  it('report a network failure instead of throwing', async () => {
    const down = (async () => {
      throw new Error('ECONNRESET');
    }) as unknown as typeof fetch;
    const res = await KEY_TESTERS.openai!('sk', down);
    expect(res.ok).toBe(false);
  });
});
