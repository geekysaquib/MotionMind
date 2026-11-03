import { makeAutoObservable, runInAction } from 'mobx';
import type { RootStore } from './RootStore';
import type { Session } from '../services/types';

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

  requestCode(email: string) {
    return this.root.services.auth.requestCode(email.trim());
  }

  verifyCode(email: string, code: string) {
    return this.root.services.auth.verifyCode(email.trim(), code.trim());
  }

  async signOut() {
    await this.root.services.auth.signOut();
    runInAction(() => {
      this.session = null;
    });
    await this.root.onSessionChanged();
  }
}
