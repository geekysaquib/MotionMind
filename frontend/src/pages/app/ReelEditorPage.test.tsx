import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { observer } from 'mobx-react-lite';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import type { Project, ReelEditor, ReelScript } from '@motionmind/shared';
import type { ClaudeService } from '../../services/claudeHttp';
import { StoreContext } from '../../stores/RootStore';
import { makeStore } from '../../test-utils';
import { setAudioAnalyzer } from '../../lib/audioAnalysis';
import { Timeline } from '../../components/Timeline';
import { ReelEditorPage } from './ReelEditorPage';
import { VoiceStagePage } from './VoiceStagePage';

const beat = (id: string, narration: string) => ({ id, narration, keywords: [], chapter: 0, card: { eyebrow: 'UPI', headline: `H-${id}`, tone: 'teal' as const, rows: [] } });
const SCRIPT: ReelScript = { title: 'UPI', steps: ['App'], beats: [beat('a', 'Ek second mein.'), beat('b', 'NPCI beech mein.'), beat('c', 'Done.')] };

const EDITOR: ReelEditor = {
  voiceSource: 'upload',
  upload: { track: { path: 'u/p/voice-1.mp3', fileName: 'mine.mp3', mime: 'audio/mpeg', durationSec: 10, peaks: Array.from({ length: 200 }, (_, i) => (i % 20 < 12 ? 70 : 3)) }, cuts: [3, 7] },
  pace: 1,
  scenePace: [],
  music: null,
  captions: { size: 'medium', position: 'bottom', look: 'box' },
};

/** jsdom can't decode audio: pretend every file is 12 seconds of steady sound. */
function fakeAudioContext() {
  setAudioAnalyzer(async () => ({ durationSec: 12, peaks: Array.from({ length: 240 }, () => 60) }));
}
const audioFile = (name = 'voice.mp3') => {
  const f = new File(['x'], name, { type: 'audio/mpeg' });
  (f as unknown as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer = async () => new ArrayBuffer(8);
  return f;
};

async function setup(page: 'editor' | 'voice', initial: ReelEditor | null) {
  const store = await makeStore({ signedIn: true });
  const created = await store.projects.create({ title: 'UPI', topic: 'UPI', durationSec: 30, qualityTier: 'draft' });
  store.projects.upsert({ ...created, script: SCRIPT, editor: initial });
  const calls = { saved: [] as ReelEditor[], uploads: [] as string[] };
  store.services.claude = () =>
    ({
      editorFor: async () => ({ editor: initial, urls: initial ? { voice: 'blob:voice' } : {} }),
      voices: async () => ({ voices: [], defaultVoiceId: null }),
      voiceFor: async () => ({ voice: null, urls: [], stale: false }),
      uploadAudio: async (_id: string, kind: string, _f: Blob, name: string) => {
        calls.uploads.push(`${kind}:${name}`);
        return { track: { path: `u/p/${kind}-2.mp3`, fileName: name, mime: 'audio/mpeg' }, url: 'blob:new' };
      },
      saveEditor: async (_id: string, editor: ReelEditor) => {
        calls.saved.push(editor);
        const project = { ...store.projects.byId(created.id)!, editor: { ...editor, updatedAt: 'now' } } as Project;
        return { project, urls: { voice: 'blob:voice', music: editor.music ? 'blob:music' : undefined } };
      },
      saveScript: async (_id: string, script: ReelScript) => ({ ...store.projects.byId(created.id)!, script }) as Project,
    }) as unknown as ClaudeService;
  const Layout = observer(() => <Outlet context={store.projects.byId(created.id)} />);
  await act(async () => {
    render(
      <StoreContext.Provider value={store}>
        <MemoryRouter initialEntries={['/p']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/p" element={page === 'editor' ? <ReelEditorPage /> : <VoiceStagePage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </StoreContext.Provider>,
    );
  });
  return { store, calls, id: created.id };
}

describe('ReelEditorPage', () => {
  beforeEach(fakeAudioContext);
  afterEach(async () => {
    await act(async () => {});
    cleanup();
    setAudioAnalyzer(null);
  });

  it('asks for an upload when there is no recording yet', async () => {
    await setup('editor', null);
    expect(screen.getByRole('button', { name: /Upload voiceover/ })).toBeTruthy();
  });

  it('uploads a recording, guesses the scene breaks and saves it as the voice', async () => {
    const { calls } = await setup('editor', null);
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Voiceover file'), { target: { files: [audioFile()] } });
    });
    expect(calls.uploads).toEqual(['voice:voice.mp3']);
    expect(calls.saved).toHaveLength(1);
    expect(calls.saved[0]!.voiceSource).toBe('upload');
    expect(calls.saved[0]!.upload!.track.durationSec).toBe(12);
    expect(calls.saved[0]!.upload!.cuts).toHaveLength(2);
  });

  it('rejects a file the browser cannot decode, without uploading it', async () => {
    setAudioAnalyzer(async () => {
      throw new Error('bad');
    });
    const { calls } = await setup('editor', null);
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Voiceover file'), { target: { files: [audioFile('notes.txt')] } });
    });
    expect(screen.getByText(/couldn't read that file/)).toBeTruthy();
    expect(calls.uploads).toEqual([]);
  });

  it('edits pace and scene text, then saves both', async () => {
    const { calls, store, id } = await setup('editor', EDITOR);
    const save = screen.getByRole('button', { name: 'Save changes' }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Voice pace'), { target: { value: '1.2' } });
    fireEvent.change(screen.getByLabelText('Scene pace'), { target: { value: '0.8' } });
    fireEvent.change(screen.getByDisplayValue('Ek second mein.'), { target: { value: 'Ek second.' } });
    expect(save.disabled).toBe(false);
    await act(async () => {
      fireEvent.click(save);
    });
    expect(calls.saved[0]!.pace).toBeCloseTo(1.2);
    expect(calls.saved[0]!.scenePace[0]).toBeCloseTo(0.8);
    expect(store.projects.byId(id)!.script!.beats[0]!.narration).toBe('Ek second.');
  });

  it('marks where the follow line starts and saves it', async () => {
    const { calls } = await setup('editor', EDITOR);
    expect(screen.queryByRole('slider', { name: 'Start of the follow line' })).toBeNull();
    fireEvent.click(screen.getByLabelText('My recording ends with the follow line'));
    const marker = screen.getByRole('slider', { name: 'Start of the follow line' });
    const at = Number(marker.getAttribute('aria-valuenow'));
    expect(at).toBeGreaterThanOrEqual(7.3);
    expect(at).toBeLessThanOrEqual(9.6);
    fireEvent.keyDown(marker, { key: 'ArrowRight', shiftKey: true });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    });
    expect(calls.saved[0]!.upload!.closingAt).toBeCloseTo(Math.min(9.6, at + 0.25), 1);
    // Unticking removes it again.
    fireEvent.click(screen.getByLabelText('My recording ends with the follow line'));
    expect(screen.queryByRole('slider', { name: 'Start of the follow line' })).toBeNull();
  });

  it('trims the silence at both ends of the recording and can go back to the whole file', async () => {
    // Quiet for the first and last second, speech in between.
    const peaks = Array.from({ length: 200 }, (_, i) => (i < 20 || i >= 180 ? 1 : 60));
    const { calls } = await setup('editor', { ...EDITOR, upload: { ...EDITOR.upload!, track: { ...EDITOR.upload!.track, peaks }, cuts: [3, 7] } });
    expect(screen.queryByRole('button', { name: 'Use the whole recording' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Trim the silence' }));
    const start = Number(screen.getByRole('slider', { name: 'Start of the part that plays' }).getAttribute('aria-valuenow'));
    const end = Number(screen.getByRole('slider', { name: 'End of the part that plays' }).getAttribute('aria-valuenow'));
    expect(start).toBeGreaterThan(0.7);
    expect(start).toBeLessThan(1);
    expect(end).toBeGreaterThan(9);
    expect(end).toBeLessThan(9.3);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    });
    expect(calls.saved[0]!.upload).toMatchObject({ trimStart: start, trimEnd: end });
    fireEvent.click(screen.getByRole('button', { name: 'Use the whole recording' }));
    expect(screen.getByRole('slider', { name: 'Start of the part that plays' }).getAttribute('aria-valuenow')).toBe('0');
  });

  it('adds a sound effect, sets when it plays and how loud, and removes it', async () => {
    const { calls } = await setup('editor', EDITOR);
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Sound effect file'), { target: { files: [audioFile('whoosh.mp3')] } });
    });
    expect(calls.uploads).toEqual(['sfx:whoosh.mp3']);
    expect(calls.saved[0]!.sfx).toHaveLength(1);
    expect(calls.saved[0]!.sfx![0]).toMatchObject({ at: 0 });
    // Set the time by hand, then by scene (the recording is 10 s with breaks at 3 and 7).
    fireEvent.change(screen.getByLabelText('Sound effect 1 start'), { target: { value: '2.5' } });
    expect((screen.getByLabelText('Sound effect 1 start') as HTMLInputElement).value).toBe('2.5');
    fireEvent.change(screen.getByLabelText('Sound effect 1 scene'), { target: { value: '2' } });
    expect((screen.getByLabelText('Sound effect 1 start') as HTMLInputElement).value).toBe('7');
    fireEvent.change(screen.getByLabelText('Sound effect 1 volume'), { target: { value: '0.3' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    });
    expect(calls.saved.at(-1)!.sfx![0]).toMatchObject({ at: 7, volume: 0.3 });
    fireEvent.click(screen.getByRole('button', { name: 'Remove sound effect 1' }));
    expect(screen.queryByLabelText('Sound effect 1 start')).toBeNull();
  });

  it('offers to refit the scene breaks when the scene count changed', async () => {
    await setup('editor', { ...EDITOR, upload: { ...EDITOR.upload!, cuts: [5] } });
    expect(screen.getByRole('button', { name: 'Refit scene breaks' })).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Refit scene breaks' }));
    });
    expect(screen.queryByRole('button', { name: 'Refit scene breaks' })).toBeNull();
    expect(screen.getAllByRole('slider', { name: /Break between/ })).toHaveLength(2);
  });
});

describe('VoiceStagePage upload', () => {
  beforeEach(fakeAudioContext);
  afterEach(async () => {
    await act(async () => {});
    cleanup();
    setAudioAnalyzer(null);
  });

  it("uploads the user's own voiceover from the Voice tab", async () => {
    const { calls } = await setup('voice', null);
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Voiceover file'), { target: { files: [audioFile('take1.mp3')] } });
    });
    expect(calls.uploads).toEqual(['voice:take1.mp3']);
    expect(calls.saved[0]!.voiceSource).toBe('upload');
    expect(screen.getByText('In use')).toBeTruthy();
  });
});

describe('Timeline', () => {
  afterEach(cleanup);

  it('moves a break with the arrow keys', () => {
    let cuts = [3, 7];
    render(<Timeline peaks={[10, 20]} durationSec={10} cuts={cuts} onChange={(c) => (cuts = c)} />);
    const first = screen.getByRole('slider', { name: 'Break between scene 1 and 2' });
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(cuts[0]).toBeCloseTo(3.05);
    fireEvent.keyDown(first, { key: 'ArrowLeft', shiftKey: true });
    expect(cuts[0]).toBeCloseTo(2.75);
  });

  it('never lets a scene get shorter than the minimum', () => {
    let cuts = [0.4, 7];
    render(<Timeline peaks={[10]} durationSec={10} cuts={cuts} onChange={(c) => (cuts = c)} />);
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Break between scene 1 and 2' }), { key: 'ArrowLeft', shiftKey: true });
    expect(cuts[0]).toBeGreaterThanOrEqual(0.3);
  });
});


