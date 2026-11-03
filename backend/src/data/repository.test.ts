import { describe, expect, it } from '@jest/globals';
import { HandleTakenError, MemoryDataRepository } from './repository';

describe('MemoryDataRepository', () => {
  it('creates an account and empty profile once per email', async () => {
    const repo = new MemoryDataRepository();
    const a = await repo.signInUser('a@x.com');
    const again = await repo.signInUser('a@x.com');
    expect(again.id).toBe(a.id);
    expect(await repo.getProfile(a.id)).toMatchObject({ id: a.id, handle: null, language: 'hinglish', onboardedAt: null });
  });

  it('stores, counts attempts on, and deletes login codes', async () => {
    const repo = new MemoryDataRepository();
    await repo.saveCode({ email: 'a@x.com', codeHash: 'h', expiresAt: 1, attempts: 0, createdAt: 0 });
    await repo.addAttempt('a@x.com');
    await repo.addAttempt('a@x.com');
    expect((await repo.getCode('a@x.com'))?.attempts).toBe(2);
    await repo.deleteCode('a@x.com');
    expect(await repo.getCode('a@x.com')).toBeNull();
    await expect(repo.addAttempt('missing@x.com')).resolves.toBeUndefined();
  });

  it('keeps handles unique and reserved names unavailable', async () => {
    const repo = new MemoryDataRepository();
    const a = await repo.signInUser('a@x.com');
    const b = await repo.signInUser('b@x.com');
    await repo.updateProfile(a.id, { handle: 'samjho.studio' });
    expect(await repo.isHandleAvailable('samjho.studio', b.id)).toBe(false);
    expect(await repo.isHandleAvailable('samjho.studio', a.id)).toBe(true);
    expect(await repo.isHandleAvailable('admin', b.id)).toBe(false);
    await expect(repo.updateProfile(b.id, { handle: 'samjho.studio' })).rejects.toBeInstanceOf(HandleTakenError);
  });

  it('scopes projects to their owner and sorts newest first', async () => {
    const repo = new MemoryDataRepository();
    const first = await repo.createProject('u1', { title: 'First', topic: null, durationSec: 60, qualityTier: 'standard' });
    await new Promise((r) => setTimeout(r, 5));
    const second = await repo.createProject('u1', { title: 'Second', topic: 'UPI', durationSec: 30, qualityTier: 'draft' });
    expect(second).toMatchObject({ stage: 'topic', status: 'draft', ownerId: 'u1' });
    expect((await repo.listProjects('u1')).map((p) => p.title)).toEqual(['Second', 'First']);
    expect(await repo.getProject('u2', first.id)).toBeNull();
    expect(await repo.updateProject('u2', first.id, { title: 'hijack' })).toBeNull();
    expect(await repo.removeProject('u2', first.id)).toBe(false);
    expect((await repo.updateProject('u1', first.id, { status: 'completed' }))?.status).toBe('completed');
    expect(await repo.removeProject('u1', first.id)).toBe(true);
  });
});
