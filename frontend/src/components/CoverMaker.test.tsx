import { afterEach, describe, expect, it } from '@jest/globals';
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import type { CoverSettings, Project, ReelScript } from '@motionmind/shared';
import type { ClaudeService } from '../services/claudeHttp';
import { makeStore, renderWithStore } from '../test-utils';
import { CoverMaker } from './CoverMaker';

const beat = (id: string, eyebrow: string, props: number) => ({
  id,
  narration: 'Ek second.',
  keywords: [],
  chapter: 0,
  card: { eyebrow, headline: 'Fast', tone: 'teal' as const, rows: Array.from({ length: props }, () => ({ kind: 'note' as const, text: 'n' })) },
});
const SCRIPT: ReelScript = { title: 'Soundbox kaise bolta hai', steps: ['App'], beats: [beat('a', 'Interview', 1), beat('b', 'Callback', 3)], animation: { html: '<html></html>', timingKey: 'x', writtenAt: 'now' } };

async function setup(over: Partial<ClaudeService> = {}, script: ReelScript = SCRIPT) {
  const store = await makeStore({ signedIn: true });
  const created = await store.projects.create({ title: 'Soundbox', topic: 'x', durationSec: 30, qualityTier: 'draft' });
  const project: Project = { ...created, script };
  store.projects.upsert(project);
  const calls = { saved: [] as CoverSettings[], rendered: [] as { cover: CoverSettings }[] };
  store.services.claude = () =>
    ({
      saveCover: async (_id: string, cover: CoverSettings) => {
        calls.saved.push(cover);
        return { ...project, script: { ...script, cover } };
      },
      renderCover: async (_id: string, cover: CoverSettings) => {
        calls.rendered.push({ cover });
        return { file: 'f.png', url: '/api/renders/f.png' };
      },
      ...over,
    }) as unknown as ClaudeService;
  await act(async () => {
    renderWithStore(<CoverMaker project={project} />, store);
  });
  return calls;
}

describe('CoverMaker', () => {
  afterEach(async () => {
    await act(async () => {});
    cleanup();
  });

  it('starts from the first scene and makes the cover from a frame of the animation', async () => {
    const calls = await setup();
    expect((screen.getByLabelText('Scene') as HTMLSelectElement).value).toBe('0');
    fireEvent.change(screen.getByLabelText('Scene'), { target: { value: '1' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Make the cover' }));
    });
    expect(calls.saved[0]!.scene).toBe(1);
    expect(calls.rendered[0]).toMatchObject({ cover: { scene: 1 } });
    expect(screen.getByRole('img', { name: 'Reel cover' })).toBeTruthy();
    expect(screen.getByText('Download PNG')).toBeTruthy();
  });

  it('asks for the animation first, and shows errors plainly', async () => {
    await setup({}, { ...SCRIPT, animation: undefined });
    expect(screen.getByText('Make the animation first, on the Animate step.')).toBeTruthy();
    cleanup();
    await setup({ renderCover: async () => { throw new Error('HyperFrames could not take the picture'); } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Make the cover' }));
    });
    expect(screen.getByText(/HyperFrames could not take the picture/)).toBeTruthy();
  });
});
