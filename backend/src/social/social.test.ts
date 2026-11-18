import { randomBytes } from 'node:crypto';
import { describe, expect, it } from '@jest/globals';
import { rangeDays, type AnalyticsSummary } from '@motionmind/shared';
import { buildApp } from '../app';
import { ConsoleMailer } from '../auth/mailer';
import { SessionTokens } from '../auth/session';
import { DevTokenVerifier } from '../auth/verifiers';
import { MemoryDataRepository } from '../data/repository';
import { followersFromDeltas, httpInstagramClient, type InstagramClient, type InstagramProfile } from './instagram';
import { readState, signState } from './routes';
import { MemorySocialStore, TokenBox } from './store';
import { httpYouTubeClient, isoDurationSec, SocialApiError, type YouTubeClient } from './youtube';

const secret = randomBytes(32).toString('base64');
const H = { authorization: 'Bearer dev:u1' };
const base = { totals: { views: 10, reach: null, likes: 1, comments: 0, shares: 0, saves: null, watchHours: 1, followersGained: 2 }, daily: [], shortsShare: null, posts: [], notes: [], fetchedAt: 'now', range: 28 as const, from: 'a', to: 'b', dailyLabel: 'Views' };
const PROFILE: InstagramProfile = { id: '17841', username: 'decodify_x', name: 'Decodify', avatarUrl: null, followers: 1200, posts: 40, accountType: 'MEDIA_CREATOR' };

function fakeYouTube(calls: string[] = []): YouTubeClient {
  return {
    authUrl: (state, redirect) => `https://accounts.google.com/auth?state=${state}&redirect=${encodeURIComponent(redirect)}`,
    exchange: async (code) => {
      calls.push(`exchange:${code}`);
      return { accessToken: 'yt-access', refreshToken: 'yt-refresh', expiresAt: new Date(Date.now() + 3600_000).toISOString() };
    },
    refresh: async () => {
      calls.push('refresh');
      return { accessToken: 'yt-access-2', refreshToken: 'yt-refresh', expiresAt: new Date(Date.now() + 3600_000).toISOString() };
    },
    channel: async (token) => {
      calls.push(`channel:${token}`);
      return { id: 'UC1', handle: '@decodifyx', title: 'DecodifyX', avatarUrl: null, subscribers: 500, videos: 12, uploadsPlaylist: 'UU1' };
    },
    summary: async (_t, ch, range) => ({ ...base, range, platform: 'youtube', account: { handle: ch.handle, name: ch.title, avatarUrl: null, followers: ch.subscribers, posts: ch.videos } }),
  };
}

function fakeInstagram(over: Partial<InstagramClient> = {}): InstagramClient {
  return {
    profile: async (token) => {
      if (token.startsWith('bad')) throw new SocialApiError('Instagram profile failed: Invalid OAuth access token.', 401, true);
      return PROFILE;
    },
    refresh: async () => ({ token: 'ig-new-token-xxxxxxxxxxxx', expiresAt: new Date(Date.now() + 60 * 86_400_000).toISOString() }),
    summary: async (_t, p, range) => ({ ...base, range, platform: 'instagram', dailyLabel: 'Accounts reached', account: { handle: `@${p.username}`, name: p.name, avatarUrl: null, followers: p.followers, posts: p.posts }, followerDeltas: [] }),
    ...over,
  };
}

async function setup(opts: { youtube?: YouTubeClient | null; instagram?: InstagramClient } = {}) {
  const socialStore = new MemorySocialStore();
  const app = await buildApp({
    data: new MemoryDataRepository(),
    socialStore,
    social: { youtube: opts.youtube === null ? undefined : opts.youtube ?? fakeYouTube(), instagram: opts.instagram ?? fakeInstagram(), redirectBase: 'http://localhost:8787' },
    sessions: new SessionTokens(secret),
    mailer: new ConsoleMailer(false),
    verifier: new DevTokenVerifier(),
    authSecret: secret,
    webOrigin: 'http://localhost:5173',
    mode: 'memory',
  });
  return { app, socialStore };
}

describe('tokens and sign-in state', () => {
  it('seals tokens so the stored text is not the token, and only this secret opens them', () => {
    const box = new TokenBox(secret);
    const sealed = box.seal('EAAG-secret-token');
    expect(sealed).not.toContain('EAAG');
    expect(box.open(sealed)).toBe('EAAG-secret-token');
    expect(() => new TokenBox(randomBytes(32).toString('base64')).open(sealed)).toThrow();
  });
  it('signs the Google sign-in state for one user, for ten minutes', () => {
    const s = signState(secret, 'u1', 1000);
    expect(readState(secret, s, 2000)).toBe('u1');
    expect(readState(secret, s, 1000 + 11 * 60_000)).toBeNull();
    expect(readState(randomBytes(32).toString('base64'), s, 2000)).toBeNull();
    expect(readState(secret, s.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A')), 2000)).toBeNull();
  });
});

describe('YouTube connect', () => {
  it('sends the user to Google, then saves the channel when Google sends them back', async () => {
    const calls: string[] = [];
    const { app, socialStore } = await setup({ youtube: fakeYouTube(calls) });
    const { url } = (await app.inject({ method: 'GET', url: '/api/social/youtube/connect', headers: H })).json();
    expect(url).toContain(encodeURIComponent('http://localhost:8787/api/social/youtube/callback'));
    const state = new URL(url).searchParams.get('state')!;
    const back = await app.inject({ method: 'GET', url: `/api/social/youtube/callback?code=abc&state=${encodeURIComponent(state)}` });
    expect(back.statusCode).toBe(302);
    expect(back.headers.location).toBe('http://localhost:5173/app/settings/connections?connected=youtube');
    expect(calls).toEqual(['exchange:abc', 'channel:yt-access']);
    const saved = await socialStore.get('u1', 'youtube');
    expect(saved).toMatchObject({ handle: '@decodifyx', refreshToken: 'yt-refresh' });
    const list = (await app.inject({ method: 'GET', url: '/api/social/accounts', headers: H })).json();
    expect(list.accounts[0]).toMatchObject({ platform: 'youtube', handle: '@decodifyx' });
    expect(JSON.stringify(list)).not.toContain('yt-access');
  });

  it('refuses a callback with a forged or missing state, and says when Google sign-in is not set up', async () => {
    const { app } = await setup();
    const forged = await app.inject({ method: 'GET', url: `/api/social/youtube/callback?code=abc&state=${encodeURIComponent(signState(randomBytes(32).toString('base64'), 'u1'))}` });
    expect(forged.headers.location).toContain('error=expired');
    const off = await setup({ youtube: null });
    expect((await off.app.inject({ method: 'GET', url: '/api/social/youtube/connect', headers: H })).statusCode).toBe(501);
    expect((await off.app.inject({ method: 'GET', url: '/api/social/accounts', headers: H })).json().youtubeReady).toBe(false);
  });
});

describe('Instagram connect', () => {
  it('checks the pasted token, keeps the account, and refuses a token that does not work', async () => {
    const { app, socialStore } = await setup();
    const ok = await app.inject({ method: 'POST', url: '/api/social/instagram', headers: H, payload: { token: 'IGAAgood-token-1234567890' } });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().accounts[0]).toMatchObject({ platform: 'instagram', handle: '@decodify_x' });
    expect((await socialStore.get('u1', 'instagram'))!.accessToken).toBe('IGAAgood-token-1234567890');
    const bad = await app.inject({ method: 'POST', url: '/api/social/instagram', headers: H, payload: { token: 'bad-token-xxxxxxxxxxxxxxxx' } });
    expect(bad.statusCode).toBe(400);
    expect(bad.json().message).toMatch(/did not work/);
  });

  it('refuses a personal account, which has no insights', async () => {
    const { app } = await setup({ instagram: fakeInstagram({ profile: async () => ({ ...PROFILE, accountType: 'PERSONAL' }) }) });
    const res = await app.inject({ method: 'POST', url: '/api/social/instagram', headers: H, payload: { token: 'IGAAgood-token-1234567890' } });
    expect(res.json().error).toBe('not_professional');
  });
});

describe('analytics', () => {
  it('returns the summary with a follower history from daily snapshots, caches it, and keeps users apart', async () => {
    const { app } = await setup();
    await app.inject({ method: 'POST', url: '/api/social/instagram', headers: H, payload: { token: 'IGAAgood-token-1234567890' } });
    const a = (await app.inject({ method: 'GET', url: '/api/social/analytics/instagram?range=7', headers: H })).json();
    expect(a.cached).toBe(false);
    const summary = a.summary as AnalyticsSummary;
    expect(summary.range).toBe(7);
    expect(summary.account.followers).toBe(1200);
    expect(summary.followerHistory.at(-1)!.followers).toBe(1200);
    expect((await app.inject({ method: 'GET', url: '/api/social/analytics/instagram?range=7', headers: H })).json().cached).toBe(true);
    expect((await app.inject({ method: 'GET', url: '/api/social/analytics/instagram?range=7&fresh=1', headers: H })).json().cached).toBe(false);
    expect((await app.inject({ method: 'GET', url: '/api/social/analytics/instagram', headers: { authorization: 'Bearer dev:u2' } })).json().error).toBe('not_connected');
  });

  it('refreshes an expired YouTube access token before asking for numbers', async () => {
    const calls: string[] = [];
    const { app, socialStore } = await setup({ youtube: fakeYouTube(calls) });
    await socialStore.save('u1', { platform: 'youtube', accountId: 'UC1', handle: '@decodifyx', name: 'DecodifyX', avatarUrl: null, connectedAt: new Date().toISOString(), expiresAt: null, accessToken: 'old', refreshToken: 'yt-refresh', tokenExpiresAt: new Date(Date.now() - 1000).toISOString() });
    const res = await app.inject({ method: 'GET', url: '/api/social/analytics/youtube?range=28', headers: H });
    expect(res.statusCode).toBe(200);
    expect(calls).toEqual(['refresh', 'channel:yt-access-2']);
    expect((await socialStore.get('u1', 'youtube'))!.accessToken).toBe('yt-access-2');
  });

  it('asks the user to connect again when the platform says the token is dead, and disconnecting forgets it', async () => {
    const { app, socialStore } = await setup();
    await socialStore.save('u1', { platform: 'instagram', accountId: '1', handle: '@x', name: null, avatarUrl: null, connectedAt: new Date().toISOString(), expiresAt: null, accessToken: 'bad-dead-token', refreshToken: null, tokenExpiresAt: null });
    const res = await app.inject({ method: 'GET', url: '/api/social/analytics/instagram', headers: H });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe('reconnect');
    expect(res.json().message).toMatch(/Connect the account again/);
    await app.inject({ method: 'DELETE', url: '/api/social/instagram', headers: H });
    expect(await socialStore.get('u1', 'instagram')).toBeNull();
  });
});

describe('platform clients', () => {
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

  it('YouTube: adds up the daily report, splits Shorts from other views, and marks short uploads as Shorts', async () => {
    const urls: string[] = [];
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const url = String(input);
      urls.push(url);
      if (url.includes('dimensions=day')) return reply({ columnHeaders: [{ name: 'day' }, { name: 'views' }, { name: 'estimatedMinutesWatched' }, { name: 'likes' }, { name: 'comments' }, { name: 'shares' }, { name: 'subscribersGained' }, { name: 'subscribersLost' }], rows: [['2026-11-01', 100, 60, 5, 1, 2, 4, 1], ['2026-11-02', 50, 30, 3, 0, 1, 2, 0]] });
      if (url.includes('creatorContentType')) return reply({ columnHeaders: [{ name: 'creatorContentType' }, { name: 'views' }], rows: [['SHORTS', 120], ['VIDEO_ON_DEMAND', 30]] });
      if (url.includes('playlistItems')) return reply({ items: [{ contentDetails: { videoId: 'v1' } }, { contentDetails: { videoId: 'v2' } }] });
      if (url.includes('/videos?')) return reply({ items: [{ id: 'v1', snippet: { title: 'Tatkal', publishedAt: '2026-11-01T00:00:00Z' }, statistics: { viewCount: '900', likeCount: '50', commentCount: '4' }, contentDetails: { duration: 'PT58S' } }, { id: 'v2', snippet: { title: 'Long', publishedAt: '2026-10-01T00:00:00Z' }, statistics: { viewCount: '30' }, contentDetails: { duration: 'PT12M3S' } }] });
      if (url.includes('dimensions=video')) return reply({ columnHeaders: [{ name: 'video' }, { name: 'averageViewDuration' }], rows: [['v1', 41.6]] });
      return reply({}, 404);
    }) as typeof fetch;
    const yt = httpYouTubeClient('id', 'secret', fetchImpl);
    const s = await yt.summary('tok', { id: 'UC1', handle: '@x', title: 'X', avatarUrl: null, subscribers: 10, videos: 2, uploadsPlaylist: 'UU1' }, 28, new Date('2026-11-13T10:00:00Z'));
    expect(s.totals).toMatchObject({ views: 150, likes: 8, shares: 3, watchHours: 1.5, followersGained: 5 });
    expect(s.shortsShare).toEqual({ shorts: 120, other: 30 });
    expect(s.posts.map((p) => [p.kind, p.url, p.avgWatchSec])).toEqual([
      ['short', 'https://www.youtube.com/shorts/v1', 42],
      ['video', 'https://www.youtube.com/watch?v=v2', null],
    ]);
    expect(urls.every((u) => !u.includes('secret'))).toBe(true);
    expect(isoDurationSec('PT1H2M3S')).toBe(3723);
  });

  it('Instagram: a dead token asks to reconnect; a missing metric becomes a note instead of an error', async () => {
    const dead = httpInstagramClient((async () => reply({ error: { message: 'Error validating access token', code: 190 } }, 400)) as typeof fetch);
    await expect(dead.profile('t')).rejects.toMatchObject({ reconnect: true });
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('metric_type=total_value')) return reply({ data: [{ name: 'views', total_value: { value: 400 } }, { name: 'likes', total_value: { value: 20 } }] });
      if (url.includes('metric=reach')) return reply({ data: [{ name: 'reach', values: [{ end_time: '2026-11-10T08:00:00+0000', value: 30 }, { end_time: '2026-11-11T08:00:00+0000', value: 40 }] }] });
      if (url.includes('follower_count')) return reply({ error: { message: 'Not enough followers', code: 100 } }, 400);
      if (url.includes('/me/media')) return reply({ data: [{ id: 'm1', caption: 'Tatkal kaise\nline 2', media_type: 'VIDEO', media_product_type: 'REELS', permalink: 'https://instagram.com/reel/m1', thumbnail_url: 'https://x/t.jpg', timestamp: '2026-11-10T10:00:00+0000', like_count: 9, comments_count: 2 }] });
      if (url.includes('/m1/insights')) return reply({ data: [{ name: 'views', values: [{ value: 1000 }] }, { name: 'shares', values: [{ value: 7 }] }, { name: 'ig_reels_avg_watch_time', values: [{ value: 6350 }] }] });
      return reply({}, 404);
    }) as typeof fetch;
    const s = await httpInstagramClient(fetchImpl).summary('t', PROFILE, 7, new Date('2026-11-13T10:00:00Z'));
    expect(s.totals.views).toBe(400);
    expect(s.totals.reach).toBe(70);
    expect(s.followerDeltas).toEqual([]);
    expect(s.notes.join(' ')).toMatch(/100 or more followers/);
    expect(s.posts[0]).toMatchObject({ kind: 'reel', title: 'Tatkal kaise', views: 1000, shares: 7, likes: 9, avgWatchSec: 6.4 });
  });

  it('rebuilds follower counts from daily changes, and ranges end yesterday', () => {
    expect(followersFromDeltas(100, [{ date: '2026-11-12', delta: 5 }, { date: '2026-11-11', delta: 2 }], '2026-11-13')).toEqual([
      { date: '2026-11-11', followers: 95 },
      { date: '2026-11-12', followers: 100 },
      { date: '2026-11-13', followers: 100 },
    ]);
    expect(rangeDays(7, new Date('2026-11-13T10:00:00Z'))).toEqual({ from: '2026-11-06', to: '2026-11-12' });
  });
});
