import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import type { ClaudeService, TrendIdea, Trending } from '../../services/claudeHttp';
import { makeStore, renderWithStore } from '../../test-utils';
import { DiscoverPage } from './DiscoverPage';

const TREND: Trending = {
  date: '2026-11-04',
  lang: 'en',
  items: [
    { title: 'Chandrayaan-3', views: 812345, url: 'https://en.wikipedia.org/wiki/Chandrayaan-3' },
    { title: 'Unified Payments Interface', views: 400100, url: 'https://en.wikipedia.org/wiki/Unified_Payments_Interface' },
  ],
};
const IDEA: TrendIdea = { topic: 'How did Chandrayaan-3 land softly on the Moon?', hook: 'Fifteen minutes of terror.', seconds: 45, why: 'Landing anniversary' };

async function setup(over: Partial<ClaudeService> = {}) {
  const store = await makeStore({ signedIn: true });
  const calls = { trending: [] as string[], imported: [] as string[] };
  store.services.claude = () =>
    ({
      trending: async (lang: string) => {
        calls.trending.push(lang);
        return { ...TREND, lang };
      },
      trendingPrompt: async () => 'THE PROMPT',
      importTrendingIdeas: async (text: string) => {
        calls.imported.push(text);
        return [IDEA];
      },
      ...over,
    }) as unknown as ClaudeService;
  await act(async () => {
    renderWithStore(<DiscoverPage />, store);
  });
  return calls;
}

describe('Discover > Trending now', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(async () => {
    await act(async () => {});
    cleanup();
  });

  it('opens on what people are reading, with views and links, in English or Hindi', async () => {
    const calls = await setup();
    expect(screen.getByText('Chandrayaan-3')).toBeTruthy();
    expect(screen.getByText('8,12,345 views')).toBeTruthy();
    expect(screen.getAllByRole('link', { name: 'Use as topic' })[0]!.getAttribute('href')).toBe('/app?new=1&topic=Chandrayaan-3');
    expect(screen.getByRole('link', { name: 'Open Chandrayaan-3 on Wikipedia' }).getAttribute('href')).toBe('https://en.wikipedia.org/wiki/Chandrayaan-3');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Wikipedia$/, pressed: false }));
    });
    expect(calls.trending).toEqual(['en', 'hi']);
  });

  it('turns the pages into ideas through claude.ai, and keeps them for next time', async () => {
    const calls = await setup();
    expect(screen.queryByRole('button', { name: 'Make reel ideas' })).toBeNull();
    expect(screen.getByText('Turn these into reel ideas in claude.ai')).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Claude's answer"), { target: { value: '{"ideas":[]}' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Use this answer' }));
    });
    expect(calls.imported).toEqual(['{"ideas":[]}']);
    expect(screen.getByRole('link', { name: /How did Chandrayaan-3 land softly/ }).getAttribute('href')).toBe(`/app?new=1&topic=${encodeURIComponent(IDEA.topic)}`);
    expect(screen.getByText('Why now: Landing anniversary')).toBeTruthy();
    cleanup();
    await setup(); // a fresh visit shows the saved ideas straight away
    expect(screen.getByText(/Ideas from 2026-11-04/)).toBeTruthy();
  });

  it('says what went wrong when Wikipedia cannot be reached', async () => {
    await setup({
      trending: async () => {
        throw new Error("Couldn't reach Wikipedia to see what is trending.");
      },
    });
    expect(screen.getByRole('alert').textContent).toMatch(/reach Wikipedia/);
  });
});
