import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import type { AnalyticsSummary, SocialAccount } from '@motionmind/shared';
import type { ClaudeService } from '../../services/claudeHttp';
import { ServiceError } from '../../services/types';
import { makeStore, renderWithStore } from '../../test-utils';
import { AnalyticsPage, formatCount } from './AnalyticsPage';
import { ConnectionsSettings } from './ConnectionsSettings';

const IG: SocialAccount = { platform: 'instagram', accountId: '1', handle: '@decodify_x', name: 'Decodify', avatarUrl: null, connectedAt: new Date().toISOString(), expiresAt: null };
const YT: SocialAccount = { platform: 'youtube', accountId: 'UC1', handle: '@decodifyx', name: 'DecodifyX', avatarUrl: null, connectedAt: new Date().toISOString(), expiresAt: null };

const summary = (platform: 'instagram' | 'youtube', range: 7 | 28 | 90): AnalyticsSummary => ({
  platform,
  account: { handle: platform === 'youtube' ? '@decodifyx' : '@decodify_x', name: null, avatarUrl: null, followers: 12_400, posts: 40 },
  range,
  from: '2026-10-16',
  to: '2026-11-12',
  totals: { views: 52_300, reach: platform === 'instagram' ? 30_100 : null, likes: 2_100, comments: 140, shares: 300, saves: platform === 'instagram' ? 410 : null, watchHours: platform === 'youtube' ? 210 : null, followersGained: 380 },
  dailyLabel: platform === 'youtube' ? 'Views' : 'Accounts reached',
  daily: [
    { date: '2026-11-10', value: 1200 },
    { date: '2026-11-11', value: 3400 },
    { date: '2026-11-12', value: 2100 },
  ],
  followerHistory: [
    { date: '2026-11-11', followers: 12_300 },
    { date: '2026-11-12', followers: 12_400 },
  ],
  shortsShare: platform === 'youtube' ? { shorts: 40_000, other: 12_300 } : null,
  posts: [
    { id: 'a', title: 'Old reel', url: 'https://x/a', thumbnailUrl: null, publishedAt: '2026-11-01T00:00:00Z', kind: platform === 'youtube' ? 'short' : 'reel', views: 900, reach: 700, likes: 50, comments: 3, shares: 4, saves: 5, avgWatchSec: 7.5 },
    { id: 'b', title: 'Tatkal reel', url: 'https://x/b', thumbnailUrl: null, publishedAt: '2026-11-10T00:00:00Z', kind: platform === 'youtube' ? 'short' : 'reel', views: 25_000, reach: 20_000, likes: 900, comments: 40, shares: 120, saves: 200, avgWatchSec: 11 },
  ],
  notes: platform === 'instagram' ? ['Instagram gives follower growth only for accounts with 100 or more followers.'] : [],
  fetchedAt: new Date().toISOString(),
});

async function setup(over: Partial<ClaudeService> = {}, accounts: SocialAccount[] = [IG, YT], page: 'analytics' | 'connections' = 'analytics') {
  const store = await makeStore({ signedIn: true });
  const analytics = jest.fn(async (p: 'instagram' | 'youtube', r: 7 | 28 | 90) => ({ summary: summary(p, r), cached: false }));
  store.services.claude = () => ({ socialAccounts: async () => ({ accounts, youtubeReady: true }), analytics, ...over }) as unknown as ClaudeService;
  await act(async () => {
    renderWithStore(page === 'analytics' ? <AnalyticsPage /> : <ConnectionsSettings />, store);
  });
  return { analytics };
}

describe('AnalyticsPage', () => {
  afterEach(async () => {
    await act(async () => {});
    cleanup();
  });

  it('formats counts the short way', () => {
    expect(formatCount(950)).toBe('950');
    expect(formatCount(12_400)).toBe('12.4K');
    expect(formatCount(250_000)).toBe('250K');
    expect(formatCount(1_250_000)).toBe('1.3M');
    expect(formatCount(null)).toBe('–');
  });

  it('shows the totals, the charts, the posts and the notes for the first connected account, and switches platform and range', async () => {
    const { analytics } = await setup();
    expect(analytics).toHaveBeenLastCalledWith('instagram', 28, false);
    expect(screen.getByText('Followers')).toBeTruthy();
    expect(screen.getByText('12.4K')).toBeTruthy();
    expect(screen.getByText('+380 in 28 days')).toBeTruthy();
    expect(screen.getByText('52.3K')).toBeTruthy();
    // (2100 + 140 + 300 + 410) / 52300
    expect(screen.getByText('5.6%')).toBeTruthy();
    expect(screen.getByText(/Best day: 3,400/)).toBeTruthy();
    expect(screen.getByText(/100 or more followers/)).toBeTruthy();
    const rows = screen.getAllByRole('row');
    expect(rows[1]!.textContent).toContain('Old reel');
    fireEvent.click(screen.getByRole('button', { name: 'Most viewed' }));
    expect(screen.getAllByRole('row')[1]!.textContent).toContain('Tatkal reel');

    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: /YouTube/ }));
    });
    expect(analytics).toHaveBeenLastCalledWith('youtube', 28, false);
    expect(screen.getByText('Subscribers')).toBeTruthy();
    expect(screen.getByText(/76% of views came from Shorts/)).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: '7 days' }));
    });
    expect(analytics).toHaveBeenLastCalledWith('youtube', 7, false);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Refresh/ }));
    });
    expect(analytics).toHaveBeenLastCalledWith('youtube', 7, true);
  });

  it('points to Connections when nothing is connected, and when a token died', async () => {
    await setup({}, []);
    expect(screen.getByText('Connect your accounts')).toBeTruthy();
    cleanup();
    await setup({
      analytics: async () => {
        throw new ServiceError('Instagram token failed. Connect the account again in Settings.', 'reconnect');
      },
    });
    expect(screen.getByRole('alert').textContent).toMatch(/Connect the account again/);
    expect(screen.getByRole('link', { name: 'Open Connections' })).toBeTruthy();
  });
});

describe('ConnectionsSettings', () => {
  afterEach(async () => {
    await act(async () => {});
    cleanup();
  });

  it('connects Instagram with a pasted token and lists the account', async () => {
    const connectInstagram = jest.fn(async (_t: string) => ({ accounts: [IG] }));
    await setup({ connectInstagram }, [], 'connections');
    expect(screen.getByRole('button', { name: 'Connect YouTube' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Instagram access token'), { target: { value: '  IGAAtoken-1234567890-abcdef  ' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Connect Instagram' }));
    });
    expect(connectInstagram).toHaveBeenCalledWith('IGAAtoken-1234567890-abcdef');
    expect(screen.getByText('@decodify_x')).toBeTruthy();
  });

  it('disconnects an account', async () => {
    const disconnectSocial = jest.fn(async () => ({ accounts: [IG] }));
    await setup({ disconnectSocial }, [IG, YT], 'connections');
    expect(screen.getByText('@decodifyx')).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'Disconnect' })[0]!);
    });
    expect(disconnectSocial).toHaveBeenCalledWith('youtube');
    expect(screen.queryByText('@decodifyx')).toBeNull();
  });
});
