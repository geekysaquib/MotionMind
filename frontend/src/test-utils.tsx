// Helpers for rendering pages in tests: a RootStore on demo (memory) services, inside a router.
import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DEMO_CODE, memoryServices, type Storage } from './services/memory';
import { RootStore, StoreContext } from './stores/RootStore';

export function memStorage(): Storage {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
}

export async function makeStore(opts: { signedIn?: boolean; storage?: Storage } = {}) {
  const store = new RootStore(memoryServices(opts.storage ?? memStorage(), 'http://api.test'));
  await store.auth.init();
  if (opts.signedIn) {
    await store.auth.verifyCode('saquib@example.com', DEMO_CODE);
    await store.onSessionChanged();
  }
  return store;
}

export function renderWithStore(ui: ReactElement, store: RootStore, path = '/') {
  return render(
    <StoreContext.Provider value={store}>
      <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>{ui}</MemoryRouter>
    </StoreContext.Provider>,
  );
}
