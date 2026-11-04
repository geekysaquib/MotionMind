import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { observer } from 'mobx-react-lite';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import type { Project, ReelEditor, ReelScript } from '@motionmind/shared';
import type { ClaudeService } from '../../services/claudeHttp';
import { StoreContext } from '../../stores/RootStore';
import { makeStore } from '../../test-utils';
import { specFromScript } from '../../components/reelSpec';
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

describe('specFromScript with the Reel editor', () => {
  it('uses the uploaded recording and its pace instead of ElevenLabs audio', () => {
    const spec = specFromScript(SCRIPT, undefined, undefined, { editor: { ...EDITOR, pace: 1.1 }, urls: { voice: 'blob:v' } });
    expect(spec.voiceTrack).toMatchObject({ url: 'blob:v', cuts: [3, 7] });
    expect(spec.pace).toBe(1.1);
    expect(spec.captions).toBeTruthy();
  });

  it('ignores the recording when the cuts no longer match the scenes', () => {
    const spec = specFromScript(SCRIPT, undefined, undefined, { editor: { ...EDITOR, upload: { ...EDITOR.upload!, cuts: [5] } }, urls: { voice: 'blob:v' } });
    expect(spec.voiceTrack).toBeUndefined();
  });
});
