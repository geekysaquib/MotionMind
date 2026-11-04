import { afterEach, describe, expect, it } from '@jest/globals';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { observer } from 'mobx-react-lite';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import type { Platform, ReelScript } from '@motionmind/shared';
import type { ClaudeService, RenderJob } from '../../services/claudeHttp';
import { StoreContext } from '../../stores/RootStore';
import { makeStore } from '../../test-utils';
import { ExportStagePage } from './ExportStagePage';

const SCRIPT: ReelScript = { title: 'UPI', steps: ['App'], beats: [{ id: 'a', narration: 'Ek.', keywords: [], chapter: 0, card: { eyebrow: 'UPI', headline: 'Fast', tone: 'teal', rows: [] } }] };

async function setup(available: boolean, jobs: (RenderJob | null)[], platforms: Platform[] = ['instagram'], started: (Platform | undefined)[] = []) {
  const store = await makeStore({ signedIn: true });
  const created = await store.projects.create({ title: 'UPI reel', topic: 'UPI', durationSec: 30, qualityTier: 'draft', platforms });
  store.projects.upsert({ ...created, script: SCRIPT });
  let n = 0;
  store.services.claude = () =>
    ({
      exportStatus: async () => ({ available, job: jobs[Math.min(n++, jobs.length - 1)] ?? null }),
      startExport: async (_id: string, platform?: Platform) => {
        started.push(platform);
        return { job: { id: 'j', status: 'bundling', progress: 0, startedAt: 'now' }, withVoice: false };
      },
    }) as unknown as ClaudeService;
  const Layout = observer(() => <Outlet context={store.projects.byId(created.id)} />);
  await act(async () => {
    render(
      <StoreContext.Provider value={store}>
        <MemoryRouter initialEntries={['/p']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/p" element={<ExportStagePage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </StoreContext.Provider>,
    );
  });
}

describe('ExportStagePage', () => {
  afterEach(async () => {
    await act(async () => {});
    cleanup();
  });

  it('explains that export runs on your PC when the server cannot render', async () => {
    await setup(false, [null]);
    expect(screen.getByText(/Export runs on your PC for now/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Export MP4' })).toBeNull();
  });

  it('starts a render and warns when there is no voiceover', async () => {
    await setup(true, [null]);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Export MP4' }));
    });
    expect(screen.getByText(/Preparing the engine/)).toBeTruthy();
    expect(screen.getByText(/this export is silent/)).toBeTruthy();
  });

  it('shows the finished video with a download link', async () => {
    await setup(true, [{ id: 'j', status: 'done', progress: 1, file: '11111111-1111-1111-1111-111111111111.mp4', startedAt: 'now' }]);
    const link = screen.getByRole('link', { name: /Download MP4/ });
    expect(link.getAttribute('href')).toBe('/api/renders/11111111-1111-1111-1111-111111111111.mp4');
    expect(link.getAttribute('download')).toBe('UPI reel-instagram.mp4');
  });

  it('offers one export per platform and can start both', async () => {
    const started: (Platform | undefined)[] = [];
    await setup(true, [null], ['instagram', 'youtube'], started);
    expect(screen.getByText('Instagram Reels')).toBeTruthy();
    expect(screen.getByText('YouTube Shorts')).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Export both' }));
    });
    expect(started).toEqual(['instagram', 'youtube']);
  });

  it('shows why a render failed', async () => {
    await setup(true, [{ id: 'j', status: 'failed', progress: 0.2, error: 'Chrome could not start', startedAt: 'now' }]);
    expect(screen.getByText(/The render failed: Chrome could not start/)).toBeTruthy();
  });
});
