import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { observer } from 'mobx-react-lite';
import type { Project, ReelPost, ReelScript } from '@motionmind/shared';
import type { ClaudeService } from '../services/claudeHttp';
import { makeStore, renderWithStore } from '../test-utils';
import { PostKit } from './PostKit';

const SCRIPT: ReelScript = { title: 'Tatkal', steps: ['a'], beats: [{ id: 'a', narration: 'Ek.', keywords: [], chapter: 0, card: { eyebrow: 'E', headline: 'H', tone: 'teal', rows: [] } }] };
const POST: ReelPost = { captions: ['Tatkal 10 baje kyun girta hai?\nBots.', 'Second'], hashtags: ['#IRCTC', '#Tatkal'], title: 'IRCTC Tatkal kaise chalta hai', createdAt: new Date().toISOString() };

async function setup(withPost = false) {
  const store = await makeStore({ signedIn: true });
  const created = await store.projects.create({ title: 'T', topic: 'T', durationSec: 30, qualityTier: 'draft' });
  store.projects.upsert({ ...created, script: withPost ? { ...SCRIPT, post: POST } : SCRIPT });
  const postPrompt = jest.fn(async (_id: string, _note?: string) => 'POST PROMPT');
  store.services.claude = () => ({ postPrompt, importPost: async () => ({ ...created, script: { ...SCRIPT, post: POST } }) as Project }) as unknown as ClaudeService;
  const writeText = jest.fn(async (_t: string) => {});
  Object.assign(navigator, { clipboard: { writeText } });
  const Live = observer(() => <PostKit project={store.projects.byId(created.id)!} />);
  await act(async () => {
    renderWithStore(<Live />, store);
  });
  return { writeText, postPrompt };
}

describe('PostKit', () => {
  afterEach(async () => {
    await act(async () => {});
    cleanup();
  });

  it('gives the prompt, takes the pasted answer and shows captions, hashtags and the Shorts title', async () => {
    const { writeText, postPrompt } = await setup();
    expect(screen.getByText('Caption and hashtags in claude.ai')).toBeTruthy();
    expect(screen.getByText(/Turn on web search/)).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy prompt' }));
    });
    expect(postPrompt).toHaveBeenCalled();
    expect(writeText).toHaveBeenCalledWith('POST PROMPT');
    fireEvent.change(screen.getByLabelText("Claude's answer"), { target: { value: '{"captions":[]}' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Use this answer' }));
    });
    expect(screen.getByText('Your post')).toBeTruthy();
    expect(screen.getByText('#IRCTC')).toBeTruthy();
    expect(screen.getByText('IRCTC Tatkal kaise chalta hai')).toBeTruthy();
  });

  it('copies a caption alone or with the hashtags under it', async () => {
    const { writeText } = await setup(true);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy caption 2 with hashtags' }));
    });
    expect(writeText).toHaveBeenLastCalledWith('Second\n\n#IRCTC #Tatkal');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy the hashtags' }));
    });
    expect(writeText).toHaveBeenLastCalledWith('#IRCTC #Tatkal');
  });
});
