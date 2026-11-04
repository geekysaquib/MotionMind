import { afterEach, describe, expect, it } from '@jest/globals';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { observer } from 'mobx-react-lite';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import type { Project, ReelScript, ReelVoice } from '@motionmind/shared';
import type { ClaudeService } from '../../services/claudeHttp';
import { StoreContext } from '../../stores/RootStore';
import { makeStore } from '../../test-utils';
import { specFromScript } from '../../components/reelSpec';
import { parseTranslation } from '../../lib/translate';
import { VoiceStagePage } from './VoiceStagePage';

const SCRIPT: ReelScript = {
  title: 'UPI',
  steps: ['App'],
  beats: [
    { id: 'a', narration: 'Ek second.', keywords: [], chapter: 0, card: { eyebrow: 'UPI', headline: 'Fast', tone: 'teal', rows: [] } },
    { id: 'b', narration: 'NPCI.', keywords: [], chapter: 1, card: { eyebrow: 'NPCI', headline: 'Switch', tone: 'blue', rows: [] } },
  ],
};
const VOICE: ReelVoice = {
  voiceId: 'v2',
  voiceName: 'Diya',
  narrations: ['Ek second.', 'NPCI.'],
  beats: [
    { durationSec: 1.2, words: [{ start: 0, end: 0.4 }, { start: 0.5, end: 1 }] },
    { durationSec: 0.8, words: [{ start: 0, end: 0.6 }] },
  ],
  createdAt: '2026-11-04T10:00:00Z',
};

async function setup(initial: { voice: ReelVoice | null; urls: string[]; stale: boolean }, aiMode: 'keys' | 'paste' = 'keys') {
  const store = await makeStore({ signedIn: true, aiMode });
  const created = await store.projects.create({ title: 'UPI', topic: 'UPI', durationSec: 30, qualityTier: 'draft', platforms: ['instagram'] });
  store.projects.upsert({ ...created, script: SCRIPT });
  const generated: string[] = [];
  store.services.claude = () =>
    ({
      voices: async () => ({ voices: [{ id: 'v1', name: 'Aarav' }, { id: 'v2', name: 'Diya' }], defaultVoiceId: 'v1' }),
      voiceFor: async () => initial,
      editorFor: async () => ({ editor: null, urls: {} }),
      ask: async () => ({ reply: { text: '```json\n["In one second.", "NPCI sits between."]\n```', model: 'm', inputTokens: 1, outputTokens: 1 }, ms: 1 }),
      saveScript: async (_id: string, script: ReelScript) => ({ ...created, script }) as Project,
      generateVoice: async (_id: string, voiceId?: string) => {
        generated.push(voiceId ?? '');
        return { project: { ...created, script: SCRIPT, voice: { ...VOICE, voiceId: voiceId! } } as Project, urls: ['u0', 'u1'] };
      },
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
  return { generated, store, id: created.id };
}

describe('VoiceStagePage', () => {
  afterEach(async () => {
    await act(async () => {});
    cleanup();
  });

  it('makes the voiceover with the picked voice', async () => {
    const { generated } = await setup({ voice: null, urls: [], stale: false });
    expect(screen.getByText('Preview (no voice yet)')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Voice'), { target: { value: 'v2' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Make the voiceover' }));
    });
    expect(generated).toEqual(['v2']);
    expect(screen.getByText('Matches the script')).toBeTruthy();
    expect(screen.getByText('Preview with voice')).toBeTruthy();
  });

  it('shows the narration script and copies it for text-to-speech', async () => {
    const writes: string[] = [];
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (t: string) => void writes.push(t) } });
    const { store } = await setup({ voice: null, urls: [], stale: false });
    await act(async () => {
      store.profile.profile = { ...store.profile.profile!, channelName: 'Decodifyx', handle: 'decodify_x', language: 'en' };
    });
    expect(screen.getByText('Your narration script')).toBeTruthy();
    expect(screen.getByText('NPCI.')).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy the whole script' }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy scene 2' }));
    });
    // The script always ends with the follow message, after the last scene.
    expect(writes).toEqual(['Ek second.\n\nNPCI.\n\nFollow Decodifyx for more explainers like this.', 'NPCI.']);
    expect(screen.getByText('Closing line · always last')).toBeTruthy();
  });

  it('ends the voice script with the handle when there is no channel name, in Hindi when Hindi is shown', async () => {
    const writes: string[] = [];
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (t: string) => void writes.push(t) } });
    const { store } = await setup({ voice: null, urls: [], stale: false }, 'paste');
    await act(async () => {
      store.profile.profile = { ...store.profile.profile!, channelName: null, handle: 'decodify_x', language: 'hinglish' };
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy the whole script' }));
    });
    expect(writes.at(-1)).toMatch(/Aise aur videos ke liye @decodify_x ko follow karo\.$/);
    fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'hi' } });
    fireEvent.change(screen.getByLabelText('Translated lines'), { target: { value: '["एक सेकंड।", "एनपीसीआई।"]' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Use this translation' }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy the whole script' }));
    });
    expect(writes.at(-1)).toBe('एक सेकंड।\n\nएनपीसीआई।\n\nऐसे और वीडियो के लिए @decodify_x को फ़ॉलो करें।');
  });

  it('translates the script with Claude in key mode, then uses it in the reel', async () => {
    const { store, id } = await setup({ voice: null, urls: [], stale: false });
    fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'hi' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Translate with Claude' }));
    });
    expect(screen.getByText('NPCI sits between.')).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Use in the reel' }));
    });
    expect(store.projects.byId(id)!.script!.beats.map((b) => b.narration)).toEqual(['In one second.', 'NPCI sits between.']);
  });

  it('in copy-paste mode gives a prompt and takes the pasted translation', async () => {
    await setup({ voice: null, urls: [], stale: false }, 'paste');
    fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'en' } });
    expect(screen.queryByRole('button', { name: 'Translate with Claude' })).toBeNull();
    fireEvent.change(screen.getByLabelText('Translated lines'), { target: { value: '["Only one"]' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Use this translation' }));
    });
    expect(screen.getByText(/Expected 2 lines/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Translated lines'), { target: { value: '["One.", "Two."]' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Use this translation' }));
    });
    expect(screen.getByText('Two.')).toBeTruthy();
  });

  it('warns when the narration changed after recording and plays without it', async () => {
    await setup({ voice: VOICE, urls: ['u0', 'u1'], stale: true });
    expect(screen.getByText('Script changed since')).toBeTruthy();
    expect(screen.getByText('Preview (no voice yet)')).toBeTruthy();
  });
});

describe('specFromScript with voice', () => {
  it('attaches audio only when it matches the script scene for scene', () => {
    expect(specFromScript(SCRIPT, undefined, { voice: VOICE, urls: ['a', 'b'] }).audioUrls).toEqual(['a', 'b']);
    expect(specFromScript(SCRIPT, undefined, { voice: { ...VOICE, beats: [VOICE.beats[0]!] }, urls: ['a'] }).audioUrls).toBeUndefined();
    expect(specFromScript(SCRIPT, undefined, { voice: VOICE, urls: ['a', ''] }).voice).toBeUndefined();
  });
});

describe('parseTranslation', () => {
  it('reads a plain or fenced JSON list and checks the count', () => {
    expect(parseTranslation('Sure!\n```json\n["a","b"]\n```', 2)).toEqual(['a', 'b']);
    expect(parseTranslation('["a"]', 1)).toEqual(['a']);
    expect(() => parseTranslation('["a"]', 2)).toThrow(/Expected 2 lines/);
    expect(() => parseTranslation('nope', 1)).toThrow();
  });
});
