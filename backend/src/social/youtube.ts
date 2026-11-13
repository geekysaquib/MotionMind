import { rangeDays, type AnalyticsRange, type AnalyticsSummary, type PostStat } from '@motionmind/shared';

// YouTube: Google sign-in (OAuth, read-only scopes), the YouTube Data API for the channel and its videos, and the
// YouTube Analytics API for views, watch time and subscribers by day.

export const YOUTUBE_SCOPES = ['https://www.googleapis.com/auth/youtube.readonly', 'https://www.googleapis.com/auth/yt-analytics.readonly'];

export class SocialApiError extends Error {
  constructor(
    message: string,
    readonly status = 502,
    /** True when the saved sign-in no longer works and the user has to connect again. */
    readonly reconnect = false,
  ) {
    super(message);
  }
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string;
}

export interface YouTubeChannel {
  id: string;
  handle: string;
  title: string;
  avatarUrl: string | null;
  subscribers: number | null;
  videos: number | null;
  uploadsPlaylist: string | null;
}

export interface YouTubeClient {
  authUrl(state: string, redirectUri: string): string;
  exchange(code: string, redirectUri: string): Promise<OAuthTokens>;
  refresh(refreshToken: string): Promise<OAuthTokens>;
  channel(accessToken: string): Promise<YouTubeChannel>;
  summary(accessToken: string, channel: YouTubeChannel, range: AnalyticsRange, now?: Date): Promise<Omit<AnalyticsSummary, 'followerHistory'>>;
}

const num = (v: unknown) => (v === undefined || v === null || v === '' ? null : Number(v));

/** ISO 8601 duration (PT1M5S) to seconds. */
export function isoDurationSec(d: string): number {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/.exec(d);
  if (!m) return 0;
  return Number(m[1] ?? 0) * 86400 + Number(m[2] ?? 0) * 3600 + Number(m[3] ?? 0) * 60 + Number(m[4] ?? 0);
}

export function httpYouTubeClient(clientId: string, clientSecret: string, fetchImpl: typeof fetch = fetch): YouTubeClient {
  async function json(res: Response, what: string) {
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const err = (body.error ?? {}) as { message?: string; status?: string } | string;
      const msg = typeof err === 'string' ? `${err}${body.error_description ? `: ${body.error_description as string}` : ''}` : err.message ?? res.statusText;
      const reconnect = res.status === 401 || err === 'invalid_grant';
      throw new SocialApiError(`YouTube ${what} failed: ${msg}`, reconnect ? 401 : 502, reconnect);
    }
    return body;
  }

  async function token(params: Record<string, string>): Promise<OAuthTokens> {
    const res = await fetchImpl('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...params }).toString(),
    });
    const b = await json(res, 'sign-in');
    return { accessToken: b.access_token as string, refreshToken: (b.refresh_token as string | undefined) ?? null, expiresAt: new Date(Date.now() + Number(b.expires_in ?? 3600) * 1000).toISOString() };
  }

  const get = async (accessToken: string, url: string, what: string) => json(await fetchImpl(url, { headers: { authorization: `Bearer ${accessToken}` } }), what);

  async function report(accessToken: string, params: Record<string, string>) {
    const q = new URLSearchParams({ ids: 'channel==MINE', ...params });
    const b = await get(accessToken, `https://youtubeanalytics.googleapis.com/v2/reports?${q}`, 'analytics');
    const headers = ((b.columnHeaders as { name: string }[] | undefined) ?? []).map((h) => h.name);
    return ((b.rows as unknown[][] | undefined) ?? []).map((row) => Object.fromEntries(headers.map((h, i) => [h, row[i]])) as Record<string, string | number>);
  }

  return {
    authUrl(state, redirectUri) {
      const q = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: YOUTUBE_SCOPES.join(' '),
        access_type: 'offline',
        prompt: 'consent',
        include_granted_scopes: 'true',
        state,
      });
      return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
    },
    exchange: (code, redirectUri) => token({ code, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
    refresh: async (refreshToken) => ({ ...(await token({ refresh_token: refreshToken, grant_type: 'refresh_token' })), refreshToken }),

    async channel(accessToken) {
      const b = await get(accessToken, 'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&mine=true', 'channel');
      const c = ((b.items as Record<string, any>[] | undefined) ?? [])[0];
      if (!c) throw new SocialApiError('This Google account has no YouTube channel.', 400);
      const handle = (c.snippet?.customUrl as string | undefined) ?? c.snippet?.title ?? 'YouTube channel';
      return {
        id: c.id as string,
        handle: handle.startsWith('@') ? handle : handle.includes(' ') ? handle : `@${handle}`,
        title: (c.snippet?.title as string) ?? handle,
        avatarUrl: (c.snippet?.thumbnails?.default?.url as string | undefined) ?? null,
        subscribers: c.statistics?.hiddenSubscriberCount ? null : num(c.statistics?.subscriberCount),
        videos: num(c.statistics?.videoCount),
        uploadsPlaylist: (c.contentDetails?.relatedPlaylists?.uploads as string | undefined) ?? null,
      };
    },

    async summary(accessToken, channel, range, now = new Date()) {
      const { from, to } = rangeDays(range, now);
      const notes: string[] = [];
      const daily = await report(accessToken, {
        startDate: from,
        endDate: to,
        metrics: 'views,estimatedMinutesWatched,likes,comments,shares,subscribersGained,subscribersLost',
        dimensions: 'day',
        sort: 'day',
      });
      const sum = (k: string) => daily.reduce((n, r) => n + Number(r[k] ?? 0), 0);

      let shortsShare: AnalyticsSummary['shortsShare'] = null;
      try {
        const byType = await report(accessToken, { startDate: from, endDate: to, metrics: 'views', dimensions: 'creatorContentType' });
        const shorts = byType.filter((r) => r.creatorContentType === 'SHORTS').reduce((n, r) => n + Number(r.views ?? 0), 0);
        const all = byType.reduce((n, r) => n + Number(r.views ?? 0), 0);
        shortsShare = { shorts, other: all - shorts };
      } catch {
        notes.push('YouTube did not split views into Shorts and other videos for this range.');
      }

      // The latest uploads, with their lifetime numbers.
      let posts: PostStat[] = [];
      if (channel.uploadsPlaylist) {
        const list = await get(accessToken, `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=25&playlistId=${encodeURIComponent(channel.uploadsPlaylist)}`, 'video list');
        const ids = ((list.items as Record<string, any>[] | undefined) ?? []).map((i) => i.contentDetails?.videoId as string).filter(Boolean);
        if (ids.length) {
          const vids = await get(accessToken, `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${ids.join(',')}`, 'videos');
          const watch = new Map<string, number>();
          try {
            const rows = await report(accessToken, { startDate: '2010-01-01', endDate: to, metrics: 'averageViewDuration', dimensions: 'video', filters: `video==${ids.join(',')}` });
            rows.forEach((r) => watch.set(String(r.video), Number(r.averageViewDuration)));
          } catch {
            notes.push('Average watch time per video was not available.');
          }
          posts = ((vids.items as Record<string, any>[] | undefined) ?? []).map((v) => {
            const sec = isoDurationSec((v.contentDetails?.duration as string) ?? '');
            return {
              id: v.id as string,
              title: (v.snippet?.title as string) ?? '',
              url: sec > 0 && sec <= 180 ? `https://www.youtube.com/shorts/${v.id as string}` : `https://www.youtube.com/watch?v=${v.id as string}`,
              thumbnailUrl: (v.snippet?.thumbnails?.medium?.url ?? v.snippet?.thumbnails?.default?.url ?? null) as string | null,
              publishedAt: v.snippet?.publishedAt as string,
              kind: sec > 0 && sec <= 180 ? ('short' as const) : ('video' as const),
              views: num(v.statistics?.viewCount),
              reach: null,
              likes: num(v.statistics?.likeCount),
              comments: num(v.statistics?.commentCount),
              shares: null,
              saves: null,
              avgWatchSec: watch.has(v.id as string) ? Math.round(watch.get(v.id as string)!) : null,
            };
          });
        }
      }

      return {
        platform: 'youtube',
        account: { handle: channel.handle, name: channel.title, avatarUrl: channel.avatarUrl, followers: channel.subscribers, posts: channel.videos },
        range,
        from,
        to,
        totals: {
          views: sum('views'),
          reach: null,
          likes: sum('likes'),
          comments: sum('comments'),
          shares: sum('shares'),
          saves: null,
          watchHours: Math.round((sum('estimatedMinutesWatched') / 60) * 10) / 10,
          followersGained: sum('subscribersGained') - sum('subscribersLost'),
        },
        dailyLabel: 'Views',
        daily: daily.map((r) => ({ date: String(r.day), value: Number(r.views ?? 0) })),
        shortsShare,
        posts,
        notes,
        fetchedAt: new Date().toISOString(),
      };
    },
  };
}
