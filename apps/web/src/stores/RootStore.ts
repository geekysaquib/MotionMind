import { createContext, useContext } from 'react';
import type { Services } from '../services/types';
import { AuthStore } from './AuthStore';
import { KeysStore } from './KeysStore';
import { ProfileStore } from './ProfileStore';
import { ProjectStore } from './ProjectStore';
import { ToastStore } from './ToastStore';

export class RootStore {
  readonly auth: AuthStore;
  readonly profile: ProfileStore;
  readonly projects: ProjectStore;
  readonly keys: KeysStore;
  readonly toasts = new ToastStore();

  constructor(readonly services: Services) {
    this.auth = new AuthStore(this);
    this.profile = new ProfileStore(this);
    this.projects = new ProjectStore(this);
    this.keys = new KeysStore(this);
  }

  async onSessionChanged() {
    if (this.auth.session) {
      await Promise.all([this.profile.load(), this.projects.load()]);
    } else {
      this.profile.clear();
      this.projects.clear();
      this.keys.clear();
    }
  }
}

export const StoreContext = createContext<RootStore | null>(null);

export function useStores(): RootStore {
  const s = useContext(StoreContext);
  if (!s) throw new Error('useStores must be used inside <StoreContext.Provider>');
  return s;
}
