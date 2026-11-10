import { makeAutoObservable, runInAction } from 'mobx';
import { checkHandle, HANDLE_MESSAGES, normalizeHandle, type Profile } from '@motionmind/shared';
import type { RootStore } from './RootStore';
import type { ProfilePatch } from '../services/types';
import { log } from '../lib/logger';

export type HandleStatus = 'idle' | 'invalid' | 'checking' | 'available' | 'taken' | 'error';

export class ProfileStore {
  profile: Profile | null = null;
  loading = false;
  error: string | null = null;

  handleInput = '';
  handleStatus: HandleStatus = 'idle';
  handleMessage = '';
  private checkSeq = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly root: RootStore) {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  get needsOnboarding() {
    return this.profile !== null && (!this.profile.handle || !this.profile.onboardedAt);
  }

  async load() {
    const s = this.root.auth.session;
    if (!s) {
      this.profile = null;
      return;
    }
    this.loading = true;
    try {
      const p = await this.root.services.profiles.get(s.userId);
      runInAction(() => {
        this.profile = p;
        this.error = null;
        if (!this.handleInput && p.handle) this.handleInput = p.handle;
      });
    } catch (e) {
      log.error('profile', `Couldn't load the profile: ${(e as Error).message}`);
      runInAction(() => {
        this.error = (e as Error).message;
      });
    } finally {
      runInAction(() => {
        this.loading = false;
      });
    }
  }

  clear() {
    this.profile = null;
    this.handleInput = '';
    this.handleStatus = 'idle';
  }

  /** Validates instantly, then checks availability after a short pause in typing. */
  setHandleInput(raw: string, debounceMs = 350) {
    this.handleInput = raw;
    if (this.timer) clearTimeout(this.timer);
    const h = normalizeHandle(raw);
    if (!h) {
      this.handleStatus = 'idle';
      this.handleMessage = '';
      return;
    }
    const problem = checkHandle(h);
    if (problem) {
      this.handleStatus = 'invalid';
      this.handleMessage = HANDLE_MESSAGES[problem];
      return;
    }
    if (this.profile?.handle === h) {
      this.handleStatus = 'available';
      this.handleMessage = "That's your current handle.";
      return;
    }
    this.handleStatus = 'checking';
    this.handleMessage = 'Checking…';
    const seq = ++this.checkSeq;
    this.timer = setTimeout(() => void this.checkAvailability(h, seq), debounceMs);
  }

  private async checkAvailability(h: string, seq: number) {
    try {
      const ok = await this.root.services.profiles.isHandleAvailable(h);
      if (seq !== this.checkSeq) return;
      runInAction(() => {
        this.handleStatus = ok ? 'available' : 'taken';
        this.handleMessage = ok ? `@${h} is available.` : `@${h} is taken.`;
      });
    } catch (e) {
      if (seq !== this.checkSeq) return;
      runInAction(() => {
        this.handleStatus = 'error';
        this.handleMessage = `Couldn't check right now: ${(e as Error).message}`;
      });
    }
  }

  async update(patch: ProfilePatch) {
    const s = this.root.auth.session;
    if (!s) throw new Error('You are signed out.');
    const p = await this.root.services.profiles.update(s.userId, patch);
    runInAction(() => {
      this.profile = p;
    });
    return p;
  }

  async completeOnboarding(details: Required<Pick<ProfilePatch, 'displayName' | 'channelName' | 'niche' | 'language'>>) {
    if (this.handleStatus !== 'available') throw new Error('Pick an available handle first.');
    return this.update({ ...details, handle: normalizeHandle(this.handleInput), onboardedAt: new Date().toISOString() });
  }
}
