import { createContext, useContext } from 'react';
import type { Services } from '../services/types';
import { AiModeStore } from './AiModeStore';
import { AuthStore } from './AuthStore';
import { ProfileStore } from './ProfileStore';
import { ProjectStore } from './ProjectStore';
import { ToastStore } from './ToastStore';
import { log } from '../lib/logger';

export class RootStore {
  readonly auth: AuthStore;
  readonly profile: ProfileStore;
  readonly projects: ProjectStore;
  readonly toasts = new ToastStore();
  readonly aiMode = new AiModeStore((mode) => {
    // Saved on the account when signed in; the browser keeps it either way.
    if (this.auth?.session) void this.profile.update({ aiMode: mode }).catch((e) => log.warn('settings', `Couldn't save the AI mode: ${(e as Error).message}`));
  });

  constructor(readonly services: Services) {
    this.auth = new AuthStore(this);
    this.profile = new ProfileStore(this);
    this.projects = new ProjectStore(this);
  }

  async onSessionChanged() {
    if (this.auth.session) {
      await Promise.all([this.profile.load(), this.projects.load()]);
    } else {
      this.profile.clear();
      this.projects.clear();
    }
  }
}

export const StoreContext = createContext<RootStore | null>(null);

export function useStores(): RootStore {
  const s = useContext(StoreContext);
  if (!s) throw new Error('useStores must be used inside <StoreContext.Provider>');
  return s;
}
