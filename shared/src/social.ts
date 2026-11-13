// Phase 2: the creator's own Instagram and YouTube numbers, read-only.

export const SOCIAL_PLATFORMS = ['instagram', 'youtube'] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export const ANALYTICS_RANGES = [7, 28, 90] as const;
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];

/** A connected account, as the web app sees it (never the tokens). */
export interface SocialAccount {
  platform: SocialPlatform;
  accountId: string;
  /** @handle on Instagram, the @handle or channel title on YouTube. */
  handle: string;
  name: string | null;
  avatarUrl: string | null;
  connectedAt: string;
  /** When the saved access stops working unless it is refreshed (Instagram tokens last 60 days). */
  expiresAt: string | null;
}

/** One reel, Short or video, with what it earned. Null = the platform does not report it. */
export interface PostStat {
  id: string;
  title: string;
  url: string;
  thumbnailUrl: string | null;
  publishedAt: string;
  kind: 'reel' | 'short' | 'video' | 'post';
  views: number | null;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  /** Average time watched, in seconds. */
  avgWatchSec: number | null;
}

export interface AnalyticsTotals {
  views: number | null;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  watchHours: number | null;
  /** Net followers or subscribers gained in the range. */
  followersGained: number | null;
}

export interface AnalyticsSummary {
  platform: SocialPlatform;
  account: { handle: string; name: string | null; avatarUrl: string | null; followers: number | null; posts: number | null };
  range: AnalyticsRange;
  from: string;
  to: string;
  totals: AnalyticsTotals;
  /** What the daily line counts ("Views", "Accounts reached"). */
  dailyLabel: string;
  daily: { date: string; value: number }[];
  /** Followers by day, from Motion Mind's own daily snapshots and the platform's history. */
  followerHistory: { date: string; followers: number }[];
  /** YouTube: views of Shorts against everything else, in the range. */
  shortsShare: { shorts: number; other: number } | null;
  posts: PostStat[];
  /** Plain sentences about anything the platform would not give (too few followers for insights, and so on). */
  notes: string[];
  fetchedAt: string;
}

export const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/** The first and last day of a range ending yesterday (today's numbers are not in yet). */
export function rangeDays(range: AnalyticsRange, now = new Date()): { from: string; to: string } {
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
  const from = new Date(to.getTime() - (range - 1) * 86_400_000);
  return { from: isoDay(from), to: isoDay(to) };
}

/** Engagement rate: likes, comments, shares and saves per view, as a percentage. Null when there are no views. */
export function engagementRate(t: Pick<AnalyticsTotals, 'views' | 'likes' | 'comments' | 'shares' | 'saves'>): number | null {
  if (!t.views) return null;
  const acts = (t.likes ?? 0) + (t.comments ?? 0) + (t.shares ?? 0) + (t.saves ?? 0);
  return Math.round((acts / t.views) * 1000) / 10;
}
