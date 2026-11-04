// What people are reading right now: Wikipedia's public "most viewed pages" for yesterday. No key, no account.

export type TrendLang = 'en' | 'hi';

export interface TrendingTopic {
  title: string;
  views: number;
  url: string;
}

export interface Trending {
  /** The day the views are for (UTC), as YYYY-MM-DD. */
  date: string;
  lang: TrendLang;
  items: TrendingTopic[];
}

export class TrendingError extends Error {
  readonly status = 502;
  readonly code = 'trending_unavailable';
}

const HOSTS: Record<TrendLang, string> = { en: 'en.wikipedia', hi: 'hi.wikipedia' };

// Pages that are always near the top but are not topics: the front page, search, and meta pages.
const SKIP = [/^Main_Page$/i, /^(मुख्य_पृष्ठ|मुखपृष्ठ)$/, /^-$/, /^(Special|Wikipedia|Portal|Help|File|Category|Talk|Template|User|Draft):/i, /^(विशेष|विकिपीडिया|श्रेणी|चर्चा|सहायता|चित्र|साँचा|उपयोगकर्ता):/,
  // Not topics for explainer reels: adult sites and the running lists of who died this year.
  /^\.?xxx$/i, /porn|xvideos|xnxx|onlyfans|^sex(_|$)/i, /^Deaths_in_/i, /^(मृत्यु|निधन)_/];

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

const cache = new Map<string, { at: number; value: Trending }>();
const CACHE_MS = 60 * 60 * 1000;

/** Clears the cache (for tests). */
export function clearTrendingCache() {
  cache.clear();
}

async function topFor(lang: TrendLang, day: Date, fetchImpl: typeof fetch): Promise<Trending | null> {
  const date = ymd(day);
  const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/top/${HOSTS[lang]}.org/all-access/${date.replace(/-/g, '/')}`;
  let res: Response;
  try {
    res = await fetchImpl(url, { headers: { 'User-Agent': 'MotionMind/1.0 (local studio; reel topic ideas)', Accept: 'application/json' } });
  } catch {
    throw new TrendingError("Couldn't reach Wikipedia to see what is trending. Check your internet and try again.");
  }
  if (res.status === 404) return null; // that day's numbers are not published yet
  if (!res.ok) throw new TrendingError(`Wikipedia answered with an error (${res.status}). Try again in a minute.`);
  const body = (await res.json().catch(() => null)) as { items?: { articles?: { article?: string; views?: number }[] }[] } | null;
  const articles = body?.items?.[0]?.articles ?? [];
  const items: TrendingTopic[] = [];
  for (const a of articles) {
    if (!a.article || typeof a.views !== 'number') continue;
    if (SKIP.some((re) => re.test(a.article!))) continue;
    items.push({ title: a.article.replace(/_/g, ' '), views: a.views, url: `https://${HOSTS[lang]}.org/wiki/${encodeURIComponent(a.article)}` });
    if (items.length >= 30) break;
  }
  return { date, lang, items };
}

/** Yesterday's most read pages (or the day before, if yesterday is not published yet). Cached for an hour. */
export async function fetchTrending(lang: TrendLang, fetchImpl: typeof fetch = fetch, now = new Date()): Promise<Trending> {
  const hit = cache.get(lang);
  if (hit && now.getTime() - hit.at < CACHE_MS) return hit.value;
  for (const back of [1, 2]) {
    const day = new Date(now.getTime() - back * 24 * 60 * 60 * 1000);
    const t = await topFor(lang, day, fetchImpl);
    if (t) {
      if (!t.items.length) throw new TrendingError('Wikipedia returned no pages. Try again later.');
      cache.set(lang, { at: now.getTime(), value: t });
      return t;
    }
  }
  throw new TrendingError("Wikipedia hasn't published the latest numbers yet. Try again in a few hours.");
}
