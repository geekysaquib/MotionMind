import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { observer } from 'mobx-react-lite';
import type { PlatformPost, Project, ReelPost, ReelScript } from '@motionmind/shared';
import type { ClaudeService } from '../services/claudeHttp';
import { makeStore, renderWithStore } from '../test-utils';
import { PostKit } from './PostKit';

const SCRIPT: ReelScript = { title: 'Tatkal', steps: ['a'], beats: [{ id: 'a', narration: 'Ek.', keywords: [], chapter: 0, card: { eyebrow: 'E', headline: 'H', tone: 'teal', rows: [] } }] };
const IG: PlatformPost = { captions: ['Tatkal 10 baje kyun girta hai?\nBots.', 'Second'], hashtags: ['#IRCTC', '#Tatkal'], createdAt: new Date().toISOString() };
const YT: PlatformPost = { captions: ['Shorts description'], hashtags: ['#Shorts', '#IRCTC'], title: 'IRCTC Tatkal kaise chalta hai', createdAt: new Date().toISOString() };
const POST: ReelPost = { instagram: IG, youtube: YT };

async function setup(withPost = false) {
  const store = await makeStore({ signedIn: true });
  const created = await store.projects.create({ title: 'T', topic: 'T', durationSec: 30, qualityTier: 'draft' });
  store.projects.upsert({ ...created, script: withPost ? { ...SCRIPT, post: POST } : SCRIPT });
  const postPrompt = jest.fn(async (_id: string, platform: string, _note?: string) => `PROMPT FOR ${platform}`);
  const imported: string[] = [];
  store.services.claude = () => ({ postPrompt, importPost: async (_id: string, platform: 'instagram' | 'youtube') => {
      imported.push(platform);
      return { ...created, script: { ...SCRIPT, post: { [platform]: POST[platform] } } } as Project;
    } }) as unknown as ClaudeService;
  const writeText = jest.fn(async (_t: string) => {});
  Object.assign(navigator, { clipboard: { writeText } });
  const Live = observer(() => <PostKit project={store.projects.byId(created.id)!} />);
  await act(async () => {
    renderWithStore(<Live />, store);
  });
  return { writeText, postPrompt, imported };
}

describe('PostKit', () => {
  afterEach(async () => {
    await act(async () => {});
    cleanup();
  });

  it('works one platform at a time: its own prompt, its own pasted answer', async () => {
    const { writeText, imported } = await setup();
    expect(screen.getByText('Caption and hashtags for Instagram Reels')).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy prompt' }));
    });
    expect(writeText).toHaveBeenLastCalledWith('PROMPT FOR instagram');
    fireEvent.click(screen.getByRole('tab', { name: /YouTube Shorts/ }));
    expect(screen.getByText('Title, description and hashtags for YouTube Shorts')).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy prompt' }));
    });
    expect(writeText).toHaveBeenLastCalledWith('PROMPT FOR youtube');
    fireEvent.change(screen.getByLabelText("Claude's answer"), { target: { value: '{"captions":[]}' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Use this answer' }));
    });
    expect(imported).toEqual(['youtube']);
    expect(screen.getByText('Your YouTube Shorts post')).toBeTruthy();
    expect(screen.getByText('IRCTC Tatkal kaise chalta hai')).toBeTruthy();
    expect(screen.getByText('#Shorts')).toBeTruthy();
  });

  it('copies a caption alone or with the hashtags under it, and shows each platform its own post', async () => {
    const { writeText } = await setup(true);
    expect(screen.getByText('Your Instagram Reels post')).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy caption 2 with hashtags' }));
    });
    expect(writeText).toHaveBeenLastCalledWith('Second\n\n#IRCTC #Tatkal');
    fireEvent.click(screen.getByRole('tab', { name: /YouTube Shorts/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy the hashtags' }));
    });
    expect(writeText).toHaveBeenLastCalledWith('#Shorts #IRCTC');
  });
});
