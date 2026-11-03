import { describe, expect, it, jest } from '@jest/globals';
import { DEMO_CODE, memoryServices, type Storage } from '../services/memory';
import { RootStore } from './RootStore';

function mem(): Storage {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
}

async function signedUpStore(storage = mem(), email = 'a@x.com') {
  const root = new RootStore(memoryServices(storage, 'http://api.test'));
  await root.auth.init();
  await root.auth.requestCode(email);
  await root.auth.verifyCode(email, DEMO_CODE);
  await root.onSessionChanged();
  return root;
}

describe('account + onboarding flow', () => {
  it('new accounts need a handle before the dashboard', async () => {
    const root = await signedUpStore();
    expect(root.auth.isSignedIn).toBe(true);
    expect(root.profile.needsOnboarding).toBe(true);
  });

  it('validates and checks handle availability', async () => {
    jest.useFakeTimers();
    const storage = mem();
    const first = await signedUpStore(storage, 'first@x.com');
    first.profile.setHandleInput('motion.mind', 0);
    await jest.runAllTimersAsync();
    await first.profile.completeOnboarding({ displayName: 'First', channelName: 'Motion Mind', niche: 'Tech', language: 'hinglish' });

    const second = await signedUpStore(storage, 'second@x.com');
    second.profile.setHandleInput('ad', 0);
    expect(second.profile.handleStatus).toBe('invalid');
    second.profile.setHandleInput('@Motion.Mind', 0);
    expect(second.profile.handleStatus).toBe('checking');
    await jest.runAllTimersAsync();
    expect(second.profile.handleStatus).toBe('taken');
    second.profile.setHandleInput('motionmind.hi', 0);
    await jest.runAllTimersAsync();
    expect(second.profile.handleStatus).toBe('available');
    await second.profile.completeOnboarding({ displayName: 'S', channelName: 'C', niche: 'N', language: 'hi' });
    expect(second.profile.needsOnboarding).toBe(false);
    expect(second.profile.profile?.handle).toBe('motionmind.hi');
    jest.useRealTimers();
  });

  it('refuses to finish onboarding without an available handle', async () => {
    const root = await signedUpStore();
    await expect(root.profile.completeOnboarding({ displayName: 'a', channelName: 'b', niche: 'c', language: 'en' })).rejects.toThrow();
  });

  it('rejects a wrong code and signs the same email back into the same account', async () => {
    const storage = mem();
    const root = await signedUpStore(storage);
    const id = root.auth.session?.userId;
    await root.auth.signOut();
    await expect(root.auth.requestCode('not-an-email')).rejects.toThrow(/valid email/);
    await expect(root.auth.verifyCode('a@x.com', '000000')).rejects.toThrow(/isn't right/);
    await root.auth.verifyCode('a@x.com', DEMO_CODE);
    expect(root.auth.isSignedIn).toBe(true);
    expect(root.auth.session?.userId).toBe(id);
  });
});

describe('projects', () => {
  it('creates, updates, counts and isolates projects', async () => {
    const storage = mem();
    const root = await signedUpStore(storage);
    await root.projects.create({ title: 'Where is my Train', topic: 'offline tracking', durationSec: 60, qualityTier: 'standard' });
    const p = await root.projects.create({ title: 'UPI', topic: null, durationSec: 30, qualityTier: 'draft' });
    await root.projects.update(p.id, { status: 'completed' });
    expect(root.projects.stats).toEqual({ total: 2, completed: 1, drafts: 1, inProgress: 0 });
    expect(root.projects.recent[0]?.id).toBe(p.id);

    await root.auth.signOut();
    expect(root.projects.items).toHaveLength(0);
    await root.auth.verifyCode('b@x.com', DEMO_CODE);
    await root.onSessionChanged();
    expect(root.projects.items).toHaveLength(0);
  });
});
