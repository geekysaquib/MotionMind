import { afterEach, describe, expect, it } from '@jest/globals';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { DEFAULT_FOOTAGE_SETTINGS, type FootageEdit } from '@motionmind/shared';
import type { FootageSave, FootageService, FootageView } from '../../services/footageHttp';
import { StoreContext } from '../../stores/RootStore';
import { makeStore } from '../../test-utils';
import { FootageEditPage } from './FootageEditPage';
import { FootagePage } from './FootagePage';

afterEach(cleanup);

const EDIT: FootageEdit = {
  id: 'e1',
  ownerId: 'u',
  name: 'Morning vlog',
  fileName: 'morning.mp4',
  createdAt: '2026-11-05T10:00:00Z',
  updatedAt: '2026-11-05T10:00:00Z',
  source: { file: 'source.mp4', durationSec: 10, width: 1080, height: 1920, hasAudio: true },
  settings: { ...DEFAULT_FOOTAGE_SETTINGS },
  silences: [{ start: 3, end: 5 }],
  segments: [
    { start: 0, end: 3.05, keep: true },
    { start: 4.95, end: 10, keep: true },
  ],
  words: [
    { text: 'Good', start: 0.5, end: 0.8 },
    { text: 'morning', start: 0.9, end: 1.4 },
    { text: 'everyone', start: 6, end: 6.5 },
  ],
  transcriptNote: null,
  approvedAt: null,
  job: { kind: 'analyze', status: 'done', progress: 1, step: 'Done', startedAt: 'x' },
  output: null,
};

async function setup(path: string, overrides: Partial<FootageService> = {}) {
  const store = await makeStore({ signedIn: true });
  let current: FootageView = { edit: structuredClone(EDIT), sourceUrl: '/api/footage-files/e1/source.mp4', outputUrl: null };
  const saves: FootageSave[] = [];
  const exports: string[] = [];
  const service: FootageService = {
    tools: async () => ({ available: true, tools: { ffmpeg: { ready: true, detail: 'ffmpeg 7.1' }, whisper: { ready: false, detail: 'whisper.cpp is not installed' }, ytDlp: { ready: true, detail: '2026' } } }),
    list: async () => ({ available: true, edits: [current] }),
    upload: async () => current,
    get: async () => current,
    save: async (_id, body) => {
      saves.push(body);
      current = { ...current, edit: { ...current.edit, segments: body.segments, approvedAt: body.approved ? 'now' : null } };
      return current;
    },
    analyze: async () => current,
    exportReel: async (id) => {
      exports.push(id);
      return current;
    },
    remove: async () => undefined,
    ...overrides,
  };
  store.services.footage = () => service;
  await act(async () => {
    render(
      <StoreContext.Provider value={store}>
        <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/app/footage" element={<FootagePage />} />
            <Route path="/app/footage/:id" element={<FootageEditPage />} />
          </Routes>
        </MemoryRouter>
      </StoreContext.Provider>,
    );
  });
  return { saves, exports };
}

describe('FootagePage', () => {
  it('lists the edits and which tools are ready', async () => {
    await setup('/app/footage');
    expect(await screen.findByText('Morning vlog')).toBeTruthy();
    expect(screen.getByText('whisper.cpp is not installed')).toBeTruthy();
    expect(screen.getByText(/0:10 raw/)).toBeTruthy();
  });
});

describe('FootageEditPage', () => {
  it('shows each take with its words, and approves the storyboard with a dropped take', async () => {
    const { saves, exports } = await setup('/app/footage/e1');
    expect(await screen.findByText('Good morning')).toBeTruthy();
    expect(screen.getByText('everyone')).toBeTruthy();
    // Export waits for approval.
    expect((screen.getByRole('button', { name: /Export reel/ }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByLabelText('Keep take 2'));
    expect(screen.getByText('Unsaved changes')).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Approve storyboard/ }));
    });
    expect(saves[0]!.approved).toBe(true);
    expect(saves[0]!.segments.map((s) => s.keep)).toEqual([true, false]);
    expect(screen.getByText('Approved')).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Export reel/ }));
    });
    expect(exports).toEqual(['e1']);
  });

  it('re-cuts at once from the pauses already found, keeping dropped takes dropped', async () => {
    await setup('/app/footage/e1');
    await screen.findByText('Good morning');
    fireEvent.click(screen.getByLabelText('Keep take 2'));
    fireEvent.change(screen.getByLabelText('Breathing room'), { target: { value: '0.2' } });
    // The pause from 3 s to 5 s now keeps 0.2 s on each side.
    expect(screen.getByText(/3\.2 s/)).toBeTruthy();
    expect((screen.getByLabelText('Keep take 2') as HTMLInputElement).checked).toBe(false);
  });

  it('says why there are no captions', async () => {
    await setup('/app/footage/e1', {
      get: async () => ({ edit: { ...EDIT, words: null, transcriptNote: 'Captions need whisper.cpp.' }, sourceUrl: null, outputUrl: null }),
    });
    expect(await screen.findByText('Captions need whisper.cpp.')).toBeTruthy();
  });
});
