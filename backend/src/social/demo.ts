import { isoDay, rangeDays, type AnalyticsRange, type PostStat } from '@motionmind/shared';
import type { InstagramClient } from './instagram';
import type { YouTubeClient } from './youtube';

// Sample numbers for trying the Analytics page before real accounts are connected. Only used when SOCIAL_DEMO=1 is set
// in .env, and every summary says so in its notes. Deterministic, so screenshots and tests are stable.

const NOTE = 'Sample data: SOCIAL_DEMO=1 is set in .env, so these numbers are made up. Remove it to see your real accounts.';

function wave(seed: number, i: number, base: number, swing: number) {
  return Math.max(0, Math.round(base + swing * Math.sin(i / 2.3 + seed) + swing * 0.6 * Math.sin(i / 5.1 + seed * 2) + (i % 7 === 5 ? swing * 1.8 : 0)));
}

function days(range: AnalyticsRange, now: Date, seed: number, base: number, swing: number) {
  const { from } = rangeDays(range, now);
  const start = Date.parse(`${from}T00:00:00Z`);
  return Array.from({ length: range }, (_, i) => ({ date: isoDay(new Date(start + i * 86_400_000)), value: wave(seed, i, base, swing) }));
}

const TITLES = ['IRCTC Tatkal 10 baje kaise sambhalta hai?', 'UPI Soundbox paisa aate hi kaise bolta hai?', 'Where is my Train bina internet kaise chalta hai?', '5G ko itne towers kyun chahiye?', 'Google Maps traffic kaise predict karta hai?', 'Card tap karte hi kya hota hai?'];

function posts(kind: 'reel' | 'short', now: Date): PostStat[] {
  return TITLES.map((title, i) => ({
    id: `demo-${kind}-${i}`,
    title,
    url: kind === 'reel' ? 'https://www.instagram.com/' : 'https://www.youtube.com/',
    thumbnailUrl: null,
    publishedAt: new Date(now.getTime() - (i * 4 + 1) * 86_400_000).toISOString(),
    kind,
    views: [48_200, 21_900, 9_400, 15_600, 6_100, 3_800][i]!,
    reach: kind === 'reel' ? [31_000, 15_200, 7_000, 11_300, 4_800, 3_100][i]! : null,
    likes: [2_900, 1_250, 480, 870, 260, 150][i]!,
    comments: [210, 96, 31, 64, 18, 9][i]!,
    shares: kind === 'reel' ? [640, 210, 70, 150, 30, 12][i]! : null,
    saves: kind === 'reel' ? [1_100, 420, 140, 260, 60, 25][i]! : null,
    avgWatchSec: [14.2, 11.8, 8.9, 10.4, 7.1, 6.3][i]!,
  }));
}

export function demoInstagramClient(): InstagramClient {
  const profile = { id: 'demo-ig', username: 'decodify_x', name: 'DecodifyX', avatarUrl: null, followers: 18_640, posts: 52, accountType: 'MEDIA_CREATOR' };
  return {
    profile: async () => profile,
    refresh: async (token) => ({ token, expiresAt: new Date(Date.now() + 60 * 86_400_000).toISOString() }),
    summary: async (_t, p, range, now = new Date()) => {
      const { from, to } = rangeDays(range, now);
      const daily = days(range, now, 1.3, 2600, 1400);
      const deltas = days(range, now, 0.4, 28, 22).slice(-30).map((d) => ({ date: d.date, delta: d.value }));
      const reach = daily.reduce((n, d) => n + d.value, 0);
      return {
        platform: 'instagram',
        account: { handle: `@${p.username}`, name: p.name, avatarUrl: null, followers: p.followers, posts: p.posts },
        range,
        from,
        to,
        totals: { views: Math.round(reach * 1.7), reach, likes: Math.round(reach * 0.06), comments: Math.round(reach * 0.004), shares: Math.round(reach * 0.011), saves: Math.round(reach * 0.019), watchHours: null, followersGained: deltas.reduce((n, d) => n + d.delta, 0) },
        dailyLabel: 'Accounts reached',
        daily,
        shortsShare: null,
        posts: posts('reel', now),
        notes: [NOTE],
        fetchedAt: new Date().toISOString(),
        followerDeltas: deltas,
      };
    },
  };
}

export function demoYouTubeClient(redirectBase: string): YouTubeClient {
  const channel = { id: 'demo-yt', handle: '@decodifyx', title: 'DecodifyX', avatarUrl: null, subscribers: 7_320, videos: 38, uploadsPlaylist: 'demo' };
  const tokens = () => ({ accessToken: 'demo-access', refreshToken: 'demo-refresh', expiresAt: new Date(Date.now() + 3600_000).toISOString() });
  return {
    // No Google in sample mode: straight back to the callback.
    authUrl: (state) => `${redirectBase}/api/social/youtube/callback?code=demo&state=${encodeURIComponent(state)}`,
    exchange: async () => tokens(),
    refresh: async () => tokens(),
    channel: async () => channel,
    summary: async (_t, ch, range, now = new Date()) => {
      const { from, to } = rangeDays(range, now);
      const daily = days(range, now, 2.1, 1800, 1100);
      const views = daily.reduce((n, d) => n + d.value, 0);
      return {
        platform: 'youtube',
        account: { handle: ch.handle, name: ch.title, avatarUrl: null, followers: ch.subscribers, posts: ch.videos },
        range,
        from,
        to,
        totals: { views, reach: null, likes: Math.round(views * 0.045), comments: Math.round(views * 0.003), shares: Math.round(views * 0.006), saves: null, watchHours: Math.round(views * 0.0055), followersGained: Math.round(views * 0.004) },
        dailyLabel: 'Views',
        daily,
        shortsShare: { shorts: Math.round(views * 0.82), other: views - Math.round(views * 0.82) },
        posts: posts('short', now),
        notes: [NOTE],
        fetchedAt: new Date().toISOString(),
      };
    },
  };
}
