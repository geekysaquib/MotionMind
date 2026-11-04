import { afterEach, describe, expect, it } from '@jest/globals';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { observer } from 'mobx-react-lite';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import type { Project, ReelScript } from '@motionmind/shared';
import type { ClaudeService } from '../../services/claudeHttp';
import { StoreContext } from '../../stores/RootStore';
import { makeStore } from '../../test-utils';
import { GraphicsStagePage } from './GraphicsStagePage';

const scene = (id: string, kind: 'phone' | 'bank') => ({ props: [{ id, kind, label: id }], links: [], effect: 'none' as const, focus: id });
const SCRIPT: ReelScript = {
  title: 'UPI',
  world: 'iso',
  steps: ['App'],
  beats: [
    { id: 'a', narration: 'Ek second mein payment.', keywords: [], chapter: 0, card: { eyebrow: 'UPI', headline: 'Fast', tone: 'teal', rows: [] }, scene: scene('you', 'phone') },
    { id: 'b', narration: 'NPCI beech mein hai.', keywords: [], chapter: 1, card: { eyebrow: 'NPCI', headline: 'Switch', tone: 'blue', rows: [] }, scene: scene('bank', 'bank') },
  ],
};

async function setup() {
  const store = await makeStore({ signedIn: true });
  const created = await store.projects.create({ title: 'UPI', topic: 'UPI', durationSec: 30, qualityTier: 'draft' });
  store.projects.upsert({ ...created, script: SCRIPT });
  const saved: ReelScript[] = [];
  store.services.claude = () =>
    ({
      saveScript: async (_id: string, script: ReelScript) => {
        saved.push(script);
        return { ...store.projects.byId(created.id)!, script } as Project;
      },
    }) as unknown as ClaudeService;
  const Layout = observer(() => <Outlet context={store.projects.byId(created.id)} />);
  await act(async () => {
    render(
      <StoreContext.Provider value={store}>
        <MemoryRouter initialEntries={['/p']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/p" element={<GraphicsStagePage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </StoreContext.Provider>,
    );
  });
  return { saved };
}

describe('GraphicsStagePage object positions', () => {
  afterEach(async () => {
    await act(async () => {});
    cleanup();
  });

  it('locks the current arrangement, then goes back to automatic', async () => {
    const { saved } = await setup();
    expect(screen.getByText(/Object positions: automatic/)).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Lock these positions' }));
    });
    expect(Object.keys(saved[0]!.layout!).sort()).toEqual(['bank', 'you']);
    expect(screen.getByText(/Object positions: locked/)).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Arrange automatically' }));
    });
    expect(saved[1]!.layout).toBeUndefined();
    expect(screen.getByText(/Object positions: automatic/)).toBeTruthy();
  });
});
