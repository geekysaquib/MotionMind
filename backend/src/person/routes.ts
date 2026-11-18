import type { FastifyInstance } from 'fastify';
import type { AppDeps } from '../app';
import { monogram } from '../logo/routes';

// Photos of real people named in a reel (Saquib, 2026-11-18: "use his/her pictures available online"). The picture is
// the lead image of the person's Wikipedia article, fetched only from Wikipedia and Wikimedia Commons (mostly freely
// licensed), cached, and served from this API so the reel and the video renderer can load it in an <img>.

/** Finds a person's photo by Wikipedia article title, or null. Tests replace it. */
export type PersonPhotoFetcher = (title: string, lang: string) => Promise<{ type: string; body: Buffer } | null>;

/** A Wikipedia article title: letters, digits, spaces and a little punctuation, nothing that changes the URL. */
export function cleanTitle(input: string): string | null {
  const t = input.trim().replace(/_/g, ' ').replace(/\s+/g, ' ');
  return t.length >= 2 && t.length <= 90 && /^[\p{L}\p{N} .,'()&-]+$/u.test(t) ? t : null;
}

const IMAGE_HOST = 'upload.wikimedia.org';

export const fetchPersonPhotoFromWiki: PersonPhotoFetcher = async (title, lang) => {
  try {
    const page = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`, {
      headers: { 'User-Agent': 'MotionMind/1.0 (local reel studio)', Accept: 'application/json' },
      signal: AbortSignal.timeout(7000),
    });
    if (!page.ok) return null;
    const info = (await page.json()) as { thumbnail?: { source?: string }; originalimage?: { source?: string } };
    // A portrait-sized thumbnail is plenty for a reel and much lighter than the original.
    const src = info.thumbnail?.source?.replace(/\/(\d+)px-/, '/800px-') ?? info.originalimage?.source;
    if (!src || new URL(src).hostname !== IMAGE_HOST) return null;
    const img = await fetch(src, { headers: { 'User-Agent': 'MotionMind/1.0 (local reel studio)' }, signal: AbortSignal.timeout(10000) });
    const type = img.headers.get('content-type') ?? '';
    if (!img.ok || !/^image\/(jpeg|png|webp)$/.test(type)) return null;
    const body = Buffer.from(await img.arrayBuffer());
    return body.length > 200 && body.length < 4_000_000 ? { type, body } : null;
  } catch {
    return null;
  }
};

const cache = new Map<string, { type: string; body: Buffer } | null>();

/** Public, like the logos: the reel loads it in an <img>, and so does the video renderer. */
export function registerPersonRoute(app: FastifyInstance, deps: Pick<AppDeps, 'fetchPersonPhoto'>) {
  const local = new Map<string, { type: string; body: Buffer } | null>();
  app.get('/api/person/:title', async (req, reply) => {
    const title = cleanTitle(decodeURIComponent((req.params as { title: string }).title));
    if (!title) return reply.code(400).send({ error: 'invalid_name', message: 'That is not a person\'s name.' });
    const lang = (req.query as { lang?: string }).lang === 'hi' ? 'hi' : 'en';
    const store = deps.fetchPersonPhoto ? local : cache;
    const key = `${lang}:${title.toLowerCase()}`;
    if (!store.has(key)) {
      const fetcher = deps.fetchPersonPhoto ?? fetchPersonPhotoFromWiki;
      // A Hindi title that Hindi Wikipedia lacks falls back to English.
      store.set(key, (await fetcher(title, lang)) ?? (lang === 'hi' ? await fetcher(title, 'en') : null));
    }
    const photo = store.get(key);
    // No photo on Wikipedia: the person's initials on a tile, so the reel never has a broken image.
    const out = photo ?? monogram(title.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'person', title);
    return reply
      .header('Content-Type', out.type)
      .header('X-Photo', photo ? 'wikipedia' : 'monogram')
      .header('Cache-Control', photo ? 'public, max-age=86400' : 'public, max-age=300')
      .send(out.body);
  });
}
