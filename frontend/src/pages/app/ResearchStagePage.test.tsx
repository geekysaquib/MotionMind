import { afterEach, describe, expect, it } from '@jest/globals';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { observer } from 'mobx-react-lite';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import type { Project, ResearchReport } from '@motionmind/shared';
import type { ClaudeService } from '../../services/claudeHttp';
import { StoreContext } from '../../stores/RootStore';
import { makeStore } from '../../test-utils';
import { ResearchStagePage } from './ResearchStagePage';

const REPORT: ResearchReport = {
  summary: 'The app reads which mobile tower your phone is connected to.',
  facts: [
    { claim: 'Phones report the connected cell tower ID', status: 'verified', sources: [0] },
    { claim: 'The tower map is about 8 MB', status: 'estimate', sources: [] },
  ],
  sources: [{ title: 'Engineering blog', url: 'https://example.com/blog' }],
  approvedAt: null,
  model: 'claude-opus-5-5',
};

async function setup() {
  const store = await makeStore({ signedIn: true });
  const project = await store.projects.create({ title: 'WIMT', topic: 'Where is my Train offline', durationSec: 60, qualityTier: 'standard' });
  const withResearch = (approvedAt: string | null): Project => ({ ...store.projects.byId(project.id)!, research: { ...REPORT, approvedAt } });
  store.services.claude = () =>
    ({
      research: async () => withResearch(null),
      approveResearch: async () => withResearch('2026-11-04T10:00:00Z'),
      researchPrompt: async () => 'P',
      importResearch: async () => withResearch(null),
    }) as unknown as ClaudeService;
  // Like ProjectLayout: re-renders when the project in the store changes.
  const Layout = observer(() => <Outlet context={store.projects.byId(project.id)} />);
  await act(async () => {
    render(
      <StoreContext.Provider value={store}>
        <MemoryRouter initialEntries={['/p']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/p" element={<ResearchStagePage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </StoreContext.Provider>,
    );
  });
  return { store, project };
}

describe('ResearchStagePage', () => {
  afterEach(async () => {
    await act(async () => {});
    cleanup();
  });

  it('researches with Claude and shows facts with status and sources, then approves', async () => {
    const { store, project } = await setup();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Research with Claude' }));
    });
    expect(screen.getByText(REPORT.summary)).toBeTruthy();
    expect(screen.getByText('Verified')).toBeTruthy();
    expect(screen.getByText('Estimate')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Engineering blog/ }).getAttribute('href')).toBe('https://example.com/blog');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Approve research' }));
    });
    expect(screen.getByText('Approved')).toBeTruthy();
    expect(store.projects.byId(project.id)?.research?.approvedAt).toBeTruthy();
  });

  it('offers the claude.ai route too', async () => {
    await setup();
    expect(screen.getByText('Or research it in claude.ai')).toBeTruthy();
    expect(screen.getByText(/Turn on web search/)).toBeTruthy();
  });
});
