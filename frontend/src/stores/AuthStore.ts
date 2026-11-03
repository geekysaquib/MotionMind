import { makeAutoObservable, runInAction } from 'mobx';
import type { RootStore } from './RootStore';
import type { Session } from '../services/types';

export class AuthStore {
  session: Session | null = null;
  ready = false;
  /** Set when the user arrives from a password-recovery email. */
  recovering = false;

  constructor(private readonly root: RootStore) {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  get isSignedIn() {
    return this.session !== null;
  }

  async init() {
    const svc = this.root.services.auth;
    svc.onChange((session, event) => {
      runInAction(() => {
        this.session = session;
        if (event === 'PASSWORD_RECOVERY') this.recovering = true;
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

  signUp(email: string, password: string, displayName: string) {
    return this.root.services.auth.signUp(email.trim(), password, displayName.trim());
  }

  signIn(email: string, password: string) {
    return this.root.services.auth.signIn(email.trim(), password);
  }

  sendMagicLink(email: string) {
    return this.root.services.auth.sendMagicLink(email.trim());
  }

  sendPasswordReset(email: string) {
    return this.root.services.auth.sendPasswordReset(email.trim());
  }

  async updatePassword(password: string) {
    await this.root.services.auth.updatePassword(password);
    runInAction(() => {
      this.recovering = false;
    });
  }

  async signOut() {
    await this.root.services.auth.signOut();
    runInAction(() => {
      this.session = null;
    });
    await this.root.onSessionChanged();
  }
}
