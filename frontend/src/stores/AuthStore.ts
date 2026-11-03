import { makeAutoObservable, runInAction } from 'mobx';
import type { RootStore } from './RootStore';
import type { Session } from '../services/types';
import { log } from '../lib/logger';

export class AuthStore {
  session: Session | null = null;
  ready = false;

  constructor(private readonly root: RootStore) {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  get isSignedIn() {
    return this.session !== null;
  }

  async init() {
    const svc = this.root.services.auth;
    svc.onChange((session) => {
      runInAction(() => {
        this.session = session;
      });
      void this.root.onSessionChanged();
    });
    const session = await svc.getSession();
    runInAction(() => {
      this.session = session;
    });
    await this.root.onSessionChanged();
    runInAction(() => {
      this.ready = true;
    });
  }

  async requestCode(email: string) {
    log.info('auth', 'Sign-in code requested');
    await this.root.services.auth.requestCode(email.trim());
  }

  async verifyCode(email: string, code: string) {
    try {
      await this.root.services.auth.verifyCode(email.trim(), code.trim());
      log.info('auth', 'Signed in', { userId: this.session?.userId });
    } catch (e) {
      log.warn('auth', `Sign-in failed: ${(e as Error).message}`);
      throw e;
    }
  }

  async signOut() {
    log.info('auth', 'Signed out');
    await this.root.services.auth.signOut();
    runInAction(() => {
      this.session = null;
    });
    await this.root.onSessionChanged();
  }
}
