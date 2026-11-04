import type { FastifyInstance } from 'fastify';
import type { AppDeps } from '../app';

/** Gets a company's logo image from its website name, or null when none is found. Tests replace it. */
export type LogoFetcher = (domain: string) => Promise<{ type: string; body: Buffer } | null>;

/** Only plain host names: letters, digits, dashes and dots, with at least one dot. Nothing else reaches the network. */
export const DOMAIN = /^(?=.{3,80}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/;

/** Cleans what Claude or a person typed ("https://www.IRCTC.co.in/x") into a bare host name, or null. */
export function cleanDomain(input: string): string | null {
  const d = input
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, '')
    .replace(/^www\./, '')
    .split(/[/?#]/)[0]!;
  return DOMAIN.test(d) ? d : null;
}

/** The public favicon services only: we never fetch from the domain itself. */
export const fetchLogoFromWeb: LogoFetcher = async (domain) => {
  const sources = [`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=256`, `https://icons.duckduckgo.com/ip3/${encodeURIComponent(domain)}.ico`];
  for (const url of sources) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
      const type = res.headers.get('content-type') ?? '';
      if (!res.ok || !/^image\//.test(type)) continue;
      const body = Buffer.from(await res.arrayBuffer());
      if (body.length > 20 && body.length < 600_000) return { type, body };
    } catch {
      /* try the next source */
    }
  }
  return null;
};

const cache = new Map<string, { type: string; body: Buffer } | null>();

/** A plain tile with the company's initials, for websites no logo service knows. It is a real image, so the reel never has a hole. */
export function monogram(domain: string, name: string): { type: string; body: Buffer } {
  const words = (name || domain.split('.')[0]!).replace(/[^A-Za-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  const letters = (words.length > 1 ? words.slice(0, 2).map((w) => w[0]) : [...(words[0] ?? '?').slice(0, 2)]).join('').toUpperCase();
  let h = 0;
  for (const c of domain) h = (h * 31 + c.charCodeAt(0)) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" rx="56" fill="hsl(${h} 55% 42%)"/><text x="128" y="128" text-anchor="middle" dominant-baseline="central" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="${letters.length > 2 ? 90 : 112}" fill="#fff">${letters.replace(/[<>&]/g, '')}</text></svg>`;
  return { type: 'image/svg+xml', body: Buffer.from(svg) };
}

/** Public, like the render downloads: logos load in <img> tags and in the video renderer, which can't send a sign-in header. */
export function registerLogoRoute(app: FastifyInstance, deps: Pick<AppDeps, 'fetchLogo'>) {
  const local = new Map<string, { type: string; body: Buffer } | null>();
  app.get('/api/logo/:domain', async (req, reply) => {
    const domain = cleanDomain((req.params as { domain: string }).domain);
    if (!domain) return reply.code(400).send({ error: 'invalid_domain', message: 'That is not a website name.' });
    // A custom fetcher (tests) keeps its own cache so runs never share results.
    const store = deps.fetchLogo ? local : cache;
    if (!store.has(domain)) store.set(domain, await (deps.fetchLogo ?? fetchLogoFromWeb)(domain));
    const logo = store.get(domain);
    // No logo service knows some sites (many block automated visitors): draw their initials instead, and say so.
    const name = String((req.query as { name?: string }).name ?? '').slice(0, 40);
    const out = logo ?? monogram(domain, name);
    return reply
      .header('Content-Type', out.type)
      .header('X-Logo', logo ? 'found' : 'monogram')
      .header('Cache-Control', logo ? 'public, max-age=86400' : 'public, max-age=300')
      .send(out.body);
  });
}
