import { afterEach, describe, expect, it } from '@jest/globals';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { observer } from 'mobx-react-lite';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { narrationKey, type Project, type ReelEditor, type ReelScript } from '@motionmind/shared';
import type { ClaudeService } from '../../services/claudeHttp';
import { StoreContext } from '../../stores/RootStore';
import { makeStore } from '../../test-utils';
import { setAudioAnalyzer } from '../../lib/audioAnalysis';
import { VoiceStagePage } from './VoiceStagePage';

const SCRIPT: ReelScript = {
  title: 'UPI',
  steps: ['App'],
  beats: [
    { id: 'a', narration: 'Ek second.', keywords: [], chapter: 0, card: { eyebrow: 'UPI', headline: 'Fast', tone: 'teal', rows: [] } },
    { id: 'b', narration: 'NPCI.', keywords: [], chapter: 1, card: { eyebrow: 'NPCI', headline: 'Switch', tone: 'blue', rows: [] } },
  ],
};
const NARR = ['Ek second.', 'NPCI.'];

const peaks = Array.from({ length: 100 }, (_, i) => (i < 40 || (i >= 60 && i < 90) ? 60 : 1));

async function setup(opts: { editor?: ReelEditor | null; fitFails?: boolean } = {}) {
  const store = await makeStore({ signedIn: true });
  const created = await store.projects.create({ title: 'UPI', topic: 'UPI', durationSec: 30, qualityTier: 'draft', platforms: ['instagram'] });
  store.projects.upsert({ ...created, script: SCRIPT, editor: opts.editor ?? null });
  const calls: string[] = [];
  const upload = { track: { path: 'u/v.mp3', fileName: 'v.mp3', mime: 'audio/mpeg', durationSec: 5, peaks }, cuts: [3] };
  const fitted = { ...upload, cuts: [2.9], wordTimes: [[0, 0.4], [0.5, 1], [3, 3.5]] as [number, number][], fitKey: narrationKey(NARR), fit: 'speech' as const };
  store.services.claude = () =>
    ({
      editorFor: async () => ({ editor: null, urls: {} }),
      uploadAudio: async () => {
        calls.push('upload');
        return { track: upload.track, url: 'x' };
      },
      saveEditor: async (_id: string, editor: ReelEditor) => {
        calls.push('save');
        return { project: { ...created, script: SCRIPT, editor } as Project, urls: { voice: 'v.mp3' } };
      },
      fitVoice: async () => {
        calls.push('fit');
        if (opts.fitFails) throw new Error('no speech');
        return { project: { ...created, script: SCRIPT, editor: { upload: fitted, music: null } } as Project, urls: { voice: 'v.mp3' }, fit: 'speech' as const, note: null };
      },
      saveScript: async (_id: string, script: ReelScript) => ({ ...created, script }) as Project,
      animationFor: async () => ({ animation: null, timeline: null, stale: false }),
    }) as unknown as ClaudeService;
  const Layout = observer(() => <Outlet context={store.projects.byId(created.id)} />);
  await act(async () => {
    render(
      <StoreContext.Provider value={store}>
        <MemoryRouter initialEntries={['/p']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/p" element={<VoiceStagePage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </StoreContext.Provider>,
    );
  });
  return { calls, store, fitted };
}

describe('VoiceStagePage', () => {
  afterEach(async () => {
    setAudioAnalyzer(null);
    await act(async () => {});
    cleanup();
  });

  it('offers only your own recording: no generated voices', async () => {
    await setup();
    expect(screen.getByText('Your voiceover')).toBeTruthy();
    expect(screen.queryByText(/ElevenLabs/i)).toBeNull();
    expect(screen.queryByText(/free voice/i)).toBeNull();
    expect(screen.getByRole('button', { name: 'Upload your voiceover' })).toBeTruthy();
  });

  it('shows the lines to record and copies them with the closing line last', async () => {
    const writes: string[] = [];
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (t: string) => void writes.push(t) } });
    const { store } = await setup();
    await act(async () => {
      store.profile.profile = { ...store.profile.profile!, channelName: 'Decodifyx', handle: 'decodify_x', language: 'en' };
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy the whole script' }));
    });
    expect(writes).toEqual(['Ek second.\n\nNPCI.\n\nFollow Decodifyx for more explainers like this.']);
    expect(screen.getByText('Closing line · always last')).toBeTruthy();
  });

  it('uploads the recording, then fits the script to it', async () => {
    setAudioAnalyzer(async () => ({ durationSec: 5, peaks }));
    const { calls } = await setup();
    const file = new File([new Uint8Array(10)], 'v.mp3', { type: 'audio/mpeg' });
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Voiceover file'), { target: { files: [file] } });
    });
    expect(calls).toEqual(['upload', 'save', 'fit']);
    expect(screen.getByText('Fitted to the script')).toBeTruthy();
    expect(screen.getByText(/fitted to the words I heard/)).toBeTruthy();
  });

  it('keeps the recording when the fit fails, and says what to do', async () => {
    setAudioAnalyzer(async () => ({ durationSec: 5, peaks }));
    const { calls } = await setup({ fitFails: true });
    const file = new File([new Uint8Array(10)], 'v.mp3', { type: 'audio/mpeg' });
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Voiceover file'), { target: { files: [file] } });
    });
    expect(calls).toEqual(['upload', 'save', 'fit']);
    expect(screen.getByRole('button', { name: 'Fit the script again' })).toBeTruthy();
    expect(screen.getByText('no speech')).toBeTruthy();
  });

  it('marks the fit out of date when the narration changed after it', async () => {
    const up = { track: { path: 'u/v.mp3', fileName: 'v.mp3', mime: 'audio/mpeg', durationSec: 5, peaks }, cuts: [3], fitKey: narrationKey(['Old line.', 'NPCI.']), fit: 'speech' as const };
    await setup({ editor: { upload: up, music: null } });
    expect(screen.getByText('Script changed since the fit')).toBeTruthy();
  });

  it('shows the script in another language: a prompt for claude.ai, then the pasted translation, which can replace the narration', async () => {
    const writes: string[] = [];
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (t: string) => void writes.push(t) } });
    const { store } = await setup();
    fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'Tamil' } });
    expect(screen.getByText('Translate it to Tamil in claude.ai')).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy prompt' }));
    });
    expect(writes[0]).toContain('into natural, spoken Tamil');
    expect(writes[0]).toContain('Ek second.');
    fireEvent.change(screen.getByLabelText("Claude's answer"), { target: { value: '["ஒரு வினாடி.", "என்பிசிஐ.", "ஃபாலோ செய்யுங்கள்."]' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Use this answer' }));
    });
    expect(screen.getByText('ஒரு வினாடி.')).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Use in the reel' }));
    });
    expect(store.projects.items[0]!.script!.beats.map((b) => b.narration)).toEqual(['ஒரு வினாடி.', 'என்பிசிஐ.']);
  });

  it('spells English words for text-to-speech: the prompt carries the rules and the closing line, and the answer replaces the narration', async () => {
    const writes: string[] = [];
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (t: string) => void writes.push(t) } });
    const { store } = await setup();
    fireEvent.click(screen.getByLabelText(/Spell it for text-to-speech/));
    expect(screen.getByText(/Spell it for text-to-speech in claude.ai/)).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy prompt' }));
    });
    expect(writes[0]).toContain('CDN -> सीडीएन');
    expect(writes[0]).toContain('exactly 3 strings');
    expect(writes[0]).toContain('Ek second.');
    fireEvent.change(screen.getByLabelText("Claude's answer"), { target: { value: '["एक सेकंड।", "एन पी सी आई।", "फ़ॉलो करें।"]' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Use this answer' }));
    });
    expect(screen.getByText('फ़ॉलो करें।')).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Use in the reel' }));
    });
    expect(store.projects.items[0]!.script!.beats.map((b) => b.narration)).toEqual(['एक सेकंड।', 'एन पी सी आई।']);
  });

  it('takes any language by name', async () => {
    await setup();
    fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'Other language' } });
    fireEvent.change(screen.getByLabelText('Language name'), { target: { value: 'Malayalam' } });
    expect(screen.getByText('Translate it to Malayalam in claude.ai')).toBeTruthy();
  });
});
