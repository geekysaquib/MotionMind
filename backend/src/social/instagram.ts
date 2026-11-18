import { isoDay, rangeDays, type AnalyticsRange, type AnalyticsSummary, type PostStat } from '@motionmind/shared';
import { SocialApiError } from './youtube';

// Instagram: the "Instagram API with Instagram Login" (graph.instagram.com) for a Professional (Creator or Business)
// account. The creator pastes a token generated on their own Meta app's dashboard (Standard Access covers accounts they
// own, so no App Review); long-lived tokens last 60 days and are refreshed before they run out.

export const IG_GRAPH = 'https://graph.instagram.com';
export const IG_VERSION = 'v23.0';

export interface InstagramProfile {
  id: string;
  username: string;
  name: string | null;
  avatarUrl: string | null;
  followers: number | null;
  posts: number | null;
  accountType: string | null;
}

export interface InstagramClient {
  profile(token: string): Promise<InstagramProfile>;
  /** A fresh 60-day token from a long-lived one (the token must be at least a day old). */
  refresh(token: string): Promise<{ token: string; expiresAt: string }>;
  summary(token: string, profile: InstagramProfile, range: AnalyticsRange, now?: Date): Promise<Omit<AnalyticsSummary, 'followerHistory'> & { followerDeltas: { date: string; delta: number }[] }>;
}

const num = (v: unknown) => (v === undefined || v === null ? null : Number(v));

export function httpInstagramClient(fetchImpl: typeof fetch = fetch): InstagramClient {
  async function get(path: string, params: Record<string, string>, what: string) {
    const url = `${IG_GRAPH}/${path}?${new URLSearchParams(params)}`;
    const res = await fetchImpl(url);
    const body = (await res.json().catch(() => ({}))) as Record<string, any>;
    if (!res.ok || body.error) {
      const e = body.error ?? {};
      // 190 = the token is invalid or expired.
      const reconnect = e.code === 190 || res.status === 401;
      throw new SocialApiError(`Instagram ${what} failed: ${(e.message as string | undefined) ?? res.statusText}`, reconnect ? 401 : 502, reconnect);
    }
    return body;
  }

  /** One metric's values by day from an insights answer. */
  const series = (body: Record<string, any>, name: string): { date: string; value: number }[] => {
    const m = ((body.data as any[]) ?? []).find((x) => x.name === name);
    return ((m?.values as any[]) ?? []).map((v) => ({ date: String(v.end_time ?? '').slice(0, 10), value: Number(v.value ?? 0) }));
  };
  const total = (body: Record<string, any>, name: string): number | null => {
    const m = ((body.data as any[]) ?? []).find((x) => x.name === name);
    return m?.total_value?.value === undefined ? null : Number(m.total_value.value);
  };

  return {
    async profile(token) {
      const b = await get(`${IG_VERSION}/me`, { fields: 'user_id,username,name,profile_picture_url,followers_count,media_count,account_type', access_token: token }, 'profile');
      return {
        id: String(b.user_id ?? b.id),
        username: b.username as string,
        name: (b.name as string | undefined) ?? null,
        avatarUrl: (b.profile_picture_url as string | undefined) ?? null,
        followers: num(b.followers_count),
        posts: num(b.media_count),
        accountType: (b.account_type as string | undefined) ?? null,
      };
    },

    async refresh(token) {
      const b = await get('refresh_access_token', { grant_type: 'ig_refresh_token', access_token: token }, 'token refresh');
      return { token: b.access_token as string, expiresAt: new Date(Date.now() + Number(b.expires_in ?? 5_184_000) * 1000).toISOString() };
    },

    async summary(token, profile, range, now = new Date()) {
      const { from, to } = rangeDays(range, now);
      const notes: string[] = [];
      const since = Math.floor(Date.parse(`${from}T00:00:00Z`) / 1000);
      const until = Math.floor(Date.parse(`${to}T23:59:59Z`) / 1000);

      // Account totals for the range; Instagram allows at most 30 days per call, so longer ranges are added up.
      const windows: [number, number][] = [];
      for (let s = since; s < until; s += 30 * 86400) windows.push([s, Math.min(until, s + 30 * 86400 - 1)]);
      const totals = { views: 0, reach: null as number | null, likes: 0, comments: 0, shares: 0, saves: 0 };
      let totalsOk = true;
      for (const [s, u] of windows) {
        try {
          const b = await get(`${IG_VERSION}/me/insights`, { metric: 'views,likes,comments,shares,saves', metric_type: 'total_value', period: 'day', since: String(s), until: String(u), access_token: token }, 'insights');
          totals.views += total(b, 'views') ?? 0;
          totals.likes += total(b, 'likes') ?? 0;
          totals.comments += total(b, 'comments') ?? 0;
          totals.shares += total(b, 'shares') ?? 0;
          totals.saves += total(b, 'saves') ?? 0;
        } catch (err) {
          if (err instanceof SocialApiError && err.reconnect) throw err;
          totalsOk = false;
        }
      }
      if (!totalsOk) notes.push('Instagram did not give account totals for this range (it needs a Professional account; some numbers need 100+ followers).');

      // Accounts reached by day (the daily line), in 30-day windows.
      const daily: { date: string; value: number }[] = [];
      for (const [s, u] of windows) {
        try {
          const b = await get(`${IG_VERSION}/me/insights`, { metric: 'reach', period: 'day', since: String(s), until: String(u), access_token: token }, 'insights');
          daily.push(...series(b, 'reach'));
        } catch (err) {
          if (err instanceof SocialApiError && err.reconnect) throw err;
        }
      }
      if (daily.length) totals.reach = daily.reduce((n, d) => n + d.value, 0);

      // Daily follower change (Instagram keeps only the last 30 days of it).
      let followerDeltas: { date: string; delta: number }[] = [];
      try {
        const s30 = Math.max(since, Math.floor(now.getTime() / 1000) - 29 * 86400);
        const b = await get(`${IG_VERSION}/me/insights`, { metric: 'follower_count', period: 'day', since: String(s30), until: String(until), access_token: token }, 'insights');
        followerDeltas = series(b, 'follower_count').map((d) => ({ date: d.date, delta: d.value }));
      } catch (err) {
        if (err instanceof SocialApiError && err.reconnect) throw err;
        notes.push('Instagram gives follower growth only for accounts with 100 or more followers.');
      }

      // The latest posts, with their numbers.
      const media = await get(`${IG_VERSION}/me/media`, { fields: 'id,caption,media_type,media_product_type,permalink,thumbnail_url,media_url,timestamp,like_count,comments_count', limit: '25', access_token: token }, 'posts');
      const posts: PostStat[] = [];
      for (const m of (media.data as any[]) ?? []) {
        const reel = m.media_product_type === 'REELS';
        let ins: Record<string, any> = {};
        try {
          ins = await get(`${IG_VERSION}/${m.id as string}/insights`, { metric: reel ? 'views,reach,likes,comments,shares,saved,ig_reels_avg_watch_time' : 'views,reach,likes,comments,shares,saved', access_token: token }, 'post insights');
        } catch (err) {
          if (err instanceof SocialApiError && err.reconnect) throw err;
        }
        const v = (name: string) => {
          const x = ((ins.data as any[]) ?? []).find((d) => d.name === name);
          return x ? Number(x.values?.[0]?.value ?? x.total_value?.value ?? 0) : null;
        };
        const watchMs = v('ig_reels_avg_watch_time');
        posts.push({
          id: m.id as string,
          title: ((m.caption as string | undefined) ?? '').split('\n')[0]!.slice(0, 140) || (reel ? 'Reel' : 'Post'),
          url: m.permalink as string,
          thumbnailUrl: (m.thumbnail_url ?? (m.media_type === 'IMAGE' ? m.media_url : null) ?? null) as string | null,
          publishedAt: m.timestamp as string,
          kind: reel ? 'reel' : 'post',
          views: v('views'),
          reach: v('reach'),
          likes: v('likes') ?? num(m.like_count),
          comments: v('comments') ?? num(m.comments_count),
          shares: v('shares'),
          saves: v('saved'),
          avgWatchSec: watchMs === null ? null : Math.round(watchMs / 100) / 10,
        });
      }

      return {
        platform: 'instagram',
        account: { handle: `@${profile.username}`, name: profile.name, avatarUrl: profile.avatarUrl, followers: profile.followers, posts: profile.posts },
        range,
        from,
        to,
        totals: { views: totalsOk ? totals.views : null, reach: totals.reach, likes: totalsOk ? totals.likes : null, comments: totalsOk ? totals.comments : null, shares: totalsOk ? totals.shares : null, saves: totalsOk ? totals.saves : null, watchHours: null, followersGained: followerDeltas.length ? followerDeltas.reduce((n, d) => n + d.delta, 0) : null },
        dailyLabel: 'Accounts reached',
        daily: daily.filter((d) => d.date >= from && d.date <= to),
        shortsShare: null,
        posts,
        notes,
        fetchedAt: new Date().toISOString(),
        followerDeltas,
      };
    },
  };
}

/** Rebuilds daily follower counts backwards from today's count and the daily changes. */
export function followersFromDeltas(current: number, deltas: { date: string; delta: number }[], today = isoDay(new Date())): { date: string; followers: number }[] {
  const sorted = [...deltas].sort((a, b) => b.date.localeCompare(a.date));
  const out: { date: string; followers: number }[] = [{ date: today, followers: current }];
  let n = current;
  for (const d of sorted) {
    if (d.date >= today) continue;
    out.push({ date: d.date, followers: n });
    n -= d.delta;
  }
  return out.reverse();
}
