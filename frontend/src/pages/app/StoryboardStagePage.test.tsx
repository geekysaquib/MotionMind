import { afterEach, describe, expect, it } from '@jest/globals';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { observer } from 'mobx-react-lite';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import type { Project, ReelScript } from '@motionmind/shared';
import type { ClaudeService } from '../../services/claudeHttp';
import { StoreContext } from '../../stores/RootStore';
import { makeStore } from '../../test-utils';
import { StoryboardStagePage } from './StoryboardStagePage';

const SCRIPT: ReelScript = {
  title: 'UPI',
  steps: ['App', 'NPCI'],
  model: 'claude-opus-5-5',
  beats: [
    { id: 'a', narration: 'Ek second mein payment.', keywords: ['second'], chapter: 0, card: { eyebrow: 'UPI', headline: '*Fast* payments', tone: 'teal', rows: [] } },
    { id: 'b', narration: 'NPCI beech mein hai.', keywords: ['npci'], chapter: 2, card: { eyebrow: 'Step 2', headline: '*NPCI* switch', tone: 'blue', rows: [] } },
  ],
};

async function setup() {
  const store = await makeStore({ signedIn: true });
  const created = await store.projects.create({ title: 'UPI', topic: 'How UPI works', durationSec: 30, qualityTier: 'draft' });
  const withScript: Project = { ...created, script: SCRIPT };
  store.projects.items = [withScript];
  const saved: ReelScript[] = [];
  store.services.claude = () =>
    ({
      saveScript: async (_id: string, script: ReelScript) => {
        saved.push(script);
        return { ...withScript, script, stage: 'storyboard' } as Project;
      },
    }) as unknown as ClaudeService;
  const Layout = observer(() => <Outlet context={store.projects.byId(created.id)} />);
  await act(async () => {
    render(
      <StoreContext.Provider value={store}>
        <MemoryRouter initialEntries={['/p']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/p" element={<StoryboardStagePage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </StoreContext.Provider>,
    );
  });
  return { saved };
}

describe('StoryboardStagePage', () => {
  afterEach(async () => {
    await act(async () => {});
    cleanup();
  });

  it('edits, reorders and saves the scenes', async () => {
    const { saved } = await setup();
    const save = screen.getByRole('button', { name: 'Save storyboard' }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);

    fireEvent.change(screen.getAllByLabelText(/Narration/)[0]!, { target: { value: 'Ek pal mein payment.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Move scene 2 up' }));
    fireEvent.click(screen.getByRole('button', { name: 'Amber for scene 1' }));
    expect(screen.getByText('(unsaved changes)')).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save storyboard' }));
    });
    const script = saved[0]!;
    expect(script.beats.map((b) => b.id)).toEqual(['b', 'a']);
    expect(script.beats[0]!.card.tone).toBe('amber');
    expect(script.beats[1]!.narration).toBe('Ek pal mein payment.');
    // 'second' is no longer in the narration, so it is no longer highlighted
    expect(script.beats[1]!.keywords).toEqual([]);
  });

  it('adds and deletes scenes, and can undo', async () => {
    await setup();
    fireEvent.click(screen.getByRole('button', { name: 'Add a scene after 1' }));
    expect(screen.getByText('Scene 3')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Delete scene 2' }));
    expect(screen.queryByText('Scene 3')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Undo changes' }));
    expect(screen.getAllByLabelText(/Narration/)[1]).toHaveProperty('value', 'NPCI beech mein hai.');
  });
});
