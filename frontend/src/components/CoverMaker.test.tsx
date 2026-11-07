import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
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
const SCRIPT: ReelScript = { title: 'Soundbox kaise bolta hai', steps: ['App'], beats: [beat('a', 'Interview', 1), beat('b', 'Callback', 3)] };

async function setup(over: Partial<ClaudeService> = {}, script: ReelScript = SCRIPT) {
  const store = await makeStore({ signedIn: true });
  const created = await store.projects.create({ title: 'Soundbox', topic: 'x', durationSec: 30, qualityTier: 'draft' });
  const project: Project = { ...created, script };
  store.projects.upsert(project);
  const calls = { saved: [] as CoverSettings[], rendered: [] as { cover: CoverSettings; format: string }[] };
  store.services.claude = () =>
    ({
      saveCover: async (_id: string, cover: CoverSettings) => {
        calls.saved.push(cover);
        return { ...project, script: { ...script, cover } };
      },
      renderCover: async (_id: string, cover: CoverSettings, format: string) => {
        calls.rendered.push({ cover, format });
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
  let click: ReturnType<typeof jest.spyOn>;
  beforeEach(() => {
    click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  });
  afterEach(async () => {
    click.mockRestore();
    await act(async () => {});
    cleanup();
  });

  it('starts from the busiest scene and the title with an accent', async () => {
    await setup();
    expect((screen.getByLabelText('Headline') as HTMLTextAreaElement).value).toBe('*Soundbox* kaise bolta hai');
    expect((screen.getByLabelText('Scene') as HTMLSelectElement).value).toBe('1');
    expect((screen.getByLabelText('Small label') as HTMLInputElement).value).toBe('Interview');
    expect(screen.getByRole('button', { name: 'Bold text', pressed: true })).toBeTruthy();
    expect(screen.getByText('1080 × 1920')).toBeTruthy();
  });

  it('renders what is on screen: the settings go to the server and a download starts', async () => {
    const calls = await setup();
    fireEvent.change(screen.getByLabelText('Headline'), { target: { value: 'Paisa *turant* aaya' } });
    fireEvent.change(screen.getByLabelText('Scene'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Card' }));
    fireEvent.click(screen.getByRole('button', { name: 'Feed post 4:5' }));
    fireEvent.click(screen.getByRole('button', { name: 'Purple' }));
    fireEvent.click(screen.getByLabelText('Show the channel name and handle'));
    expect(screen.getByText('1080 × 1350')).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Download PNG' }));
    });
    expect(calls.rendered[0]).toEqual({
      format: 'png',
      cover: { scene: 0, headline: 'Paisa *turant* aaya', kicker: 'Interview', style: 'center', size: 'feed', tone: 'purple', brand: false },
    });
    expect(click).toHaveBeenCalledTimes(1);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Download JPG' }));
    });
    expect(calls.rendered[1]!.format).toBe('jpeg');
  });

  it('saves the settings only when they changed, and then shows them as saved', async () => {
    const calls = await setup();
    expect((screen.getByRole('button', { name: 'Saved' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Small label'), { target: { value: 'Exposed' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));
    });
    expect(calls.saved[0]!.kicker).toBe('Exposed');
  });

  it('shows the Instagram crop guides on the 9:16 cover only', async () => {
    await setup();
    expect(screen.queryByText('4:5 grid')).toBeNull();
    fireEvent.click(screen.getByLabelText('Show Instagram crop guides'));
    expect(screen.getByText('4:5 grid')).toBeTruthy();
    expect(screen.getByText('1:1')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Square 1:1' }));
    expect(screen.queryByText('4:5 grid')).toBeNull();
    expect(screen.getByText(/already cropped/)).toBeTruthy();
  });

  it('says plainly that making the image needs the PC when the server cannot render, and shows other errors', async () => {
    await setup({
      renderCover: async () => {
        throw new Error('Making the cover runs on your PC. Open Motion Mind from your computer with npm run dev.');
      },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Download PNG' }));
    });
    expect(screen.getByText(/runs on your PC/)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Download PNG' }) as HTMLButtonElement).disabled).toBe(true);
    cleanup();
    await setup({
      renderCover: async () => {
        throw new Error('The cover could not be made: Chrome did not start');
      },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Download PNG' }));
    });
    expect(screen.getByRole('alert').textContent).toMatch(/Chrome did not start/);
  });
});
