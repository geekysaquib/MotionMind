import { describe, expect, it, vi } from 'vitest';
import { memoryServices, type Storage } from '../services/memory';
import { RootStore } from './RootStore';

function mem(): Storage {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
}

async function signedUpStore(storage = mem(), email = 'a@x.com') {
  const root = new RootStore(memoryServices(storage, 'http://api.test'));
  await root.auth.init();
  await root.auth.signUp(email, 'password123', 'Saquib');
  await root.onSessionChanged();
  return root;
}

describe('account + onboarding flow', () => {
  it('new accounts need a handle before the dashboard', async () => {
    const root = await signedUpStore();
    expect(root.auth.isSignedIn).toBe(true);
    expect(root.profile.profile?.displayName).toBe('Saquib');
    expect(root.profile.needsOnboarding).toBe(true);
  });

  it('validates and checks handle availability', async () => {
    vi.useFakeTimers();
    const storage = mem();
    const first = await signedUpStore(storage, 'first@x.com');
    first.profile.setHandleInput('motion.mind', 0);
    await vi.runAllTimersAsync();
    await first.profile.completeOnboarding({ displayName: 'First', channelName: 'Motion Mind', niche: 'Tech', language: 'hinglish' });

    const second = await signedUpStore(storage, 'second@x.com');
    second.profile.setHandleInput('ad', 0);
    expect(second.profile.handleStatus).toBe('invalid');
    second.profile.setHandleInput('@Motion.Mind', 0);
    expect(second.profile.handleStatus).toBe('checking');
    await vi.runAllTimersAsync();
    expect(second.profile.handleStatus).toBe('taken');
    second.profile.setHandleInput('motionmind.hi', 0);
    await vi.runAllTimersAsync();
    expect(second.profile.handleStatus).toBe('available');
    await second.profile.completeOnboarding({ displayName: 'S', channelName: 'C', niche: 'N', language: 'hi' });
    expect(second.profile.needsOnboarding).toBe(false);
    expect(second.profile.profile?.handle).toBe('motionmind.hi');
    vi.useRealTimers();
  });

  it('refuses to finish onboarding without an available handle', async () => {
    const root = await signedUpStore();
    await expect(root.profile.completeOnboarding({ displayName: 'a', channelName: 'b', niche: 'c', language: 'en' })).rejects.toThrow();
  });

  it('rejects duplicate email and wrong password', async () => {
    const storage = mem();
    const root = await signedUpStore(storage);
    await root.auth.signOut();
    await expect(root.auth.signUp('a@x.com', 'password123', 'X')).rejects.toThrow(/already exists/);
    await expect(root.auth.signIn('a@x.com', 'nope')).rejects.toThrow(/Invalid/);
    await root.auth.signIn('a@x.com', 'password123');
    expect(root.auth.isSignedIn).toBe(true);
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
    await root.auth.signUp('b@x.com', 'password123', 'B');
    await root.onSessionChanged();
    expect(root.projects.items).toHaveLength(0);
  });
});
