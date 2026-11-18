import { randomBytes } from 'node:crypto';
import { beforeEach, describe, expect, it } from '@jest/globals';
import { buildApp } from '../app';
import { ConsoleMailer } from '../auth/mailer';
import { SessionTokens } from '../auth/session';
import { DevTokenVerifier } from '../auth/verifiers';
import { MemoryDataRepository } from '../data/repository';
import { clearTrendingCache } from './trending';
import { parseIdeas } from './ideas';

const secret = randomBytes(32).toString('base64');
const H = { authorization: 'Bearer dev:user-a' };

const wiki = (articles: { article: string; views: number }[]) => ({ items: [{ articles }] });
const ARTICLES = [
  { article: 'Main_Page', views: 9_000_000 },
  { article: 'Special:Search', views: 4_000_000 },
  { article: 'Chandrayaan-3', views: 812_345 },
  { article: 'Unified_Payments_Interface', views: 400_100 },
  { article: 'Wikipedia:Featured_pictures', views: 100 },
  { article: '.xxx', views: 255014 },
  { article: 'Pornhub', views: 90000 },
  { article: 'Deaths_in_2026', views: 140654 },
];

function fakeFetch(handler: (url: string) => { status: number; body?: unknown }) {
  const calls: string[] = [];
  const impl = (async (url: string) => {
    calls.push(url);
    const r = handler(url);
    return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.body } as Response;
  }) as unknown as typeof fetch;
  return { impl, calls };
}

async function setup(opts: { fetchImpl: typeof fetch }) {
  const app = await buildApp({
    data: new MemoryDataRepository(),
    sessions: new SessionTokens(secret),
    mailer: new ConsoleMailer(false),
    verifier: new DevTokenVerifier(),
    authSecret: secret,
    webOrigin: 'http://localhost:5173',
    mode: 'memory',
    fetchImpl: opts.fetchImpl,
  });
  return app;
}

beforeEach(() => clearTrendingCache());

describe('GET /api/discover/trending', () => {
  it("lists yesterday's most read pages without the front page and meta pages, and caches them for an hour", async () => {
    const f = fakeFetch(() => ({ status: 200, body: wiki(ARTICLES) }));
    const app = await setup({ fetchImpl: f.impl });
    const res = await app.inject({ method: 'GET', url: '/api/discover/trending', headers: H });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.lang).toBe('en');
    expect(body.items.map((i: { title: string }) => i.title)).toEqual(['Chandrayaan-3', 'Unified Payments Interface']);
    expect(body.items[0]).toMatchObject({ views: 812345, url: 'https://en.wikipedia.org/wiki/Chandrayaan-3' });
    expect(f.calls[0]).toMatch(/pageviews\/top\/en\.wikipedia\.org\/all-access\/\d{4}\/\d{2}\/\d{2}$/);
    await app.inject({ method: 'GET', url: '/api/discover/trending', headers: H });
    expect(f.calls).toHaveLength(1); // second call came from the cache
  });

  it('reads Hindi Wikipedia, and falls back to the day before when yesterday is not published yet', async () => {
    let n = 0;
    const f = fakeFetch(() => (++n === 1 ? { status: 404 } : { status: 200, body: wiki([{ article: 'भारत', views: 5 }]) }));
    const app = await setup({ fetchImpl: f.impl });
    const res = await app.inject({ method: 'GET', url: '/api/discover/trending?lang=hi', headers: H });
    expect(res.json().items[0].title).toBe('भारत');
    expect(f.calls).toHaveLength(2);
    expect(f.calls[0]).toContain('hi.wikipedia.org');
    expect(f.calls[0]).not.toBe(f.calls[1]);
  });

  it('says plainly when Wikipedia cannot be reached, and refuses an unknown language and signed-out callers', async () => {
    const down = (async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    const app = await setup({ fetchImpl: down });
    const res = await app.inject({ method: 'GET', url: '/api/discover/trending', headers: H });
    expect(res.statusCode).toBe(502);
    expect(res.json().message).toMatch(/Couldn't reach Wikipedia/);
    expect((await app.inject({ method: 'GET', url: '/api/discover/trending?lang=xx', headers: H })).statusCode).toBe(400);
    expect((await app.inject({ method: 'GET', url: '/api/discover/trending' })).statusCode).toBe(401);
  });
});

describe('reel ideas from trending pages', () => {
  const IDEAS = { ideas: [{ topic: 'How did Chandrayaan-3 land softly on the Moon?', hook: 'It had 15 minutes of terror.', seconds: 50, why: 'Anniversary of the landing' }] };

  it('gives a prompt that lists the pages with their views', async () => {
    const app = await setup({ fetchImpl: fakeFetch(() => ({ status: 200, body: wiki(ARTICLES) })).impl });
    const { prompt } = (await app.inject({ method: 'GET', url: '/api/discover/prompt', headers: H })).json();
    expect(prompt).toContain('1. Chandrayaan-3: 812,345 views');
    expect(prompt).toContain('Reply with ONLY JSON');
    expect(prompt).not.toContain('Main Page');
  });

  it('reads a pasted answer (with or without a code fence), snaps the length, and rejects nonsense', async () => {
    const app = await setup({ fetchImpl: fakeFetch(() => ({ status: 200, body: wiki(ARTICLES) })).impl });
    const text = 'Sure, here you go:\n```json\n' + JSON.stringify(IDEAS) + '\n```';
    const ok = await app.inject({ method: 'POST', url: '/api/discover/import', headers: H, payload: { text } });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().ideas).toEqual([{ topic: IDEAS.ideas[0]!.topic, hook: 'It had 15 minutes of terror.', seconds: 45, why: 'Anniversary of the landing' }]);
    expect((await app.inject({ method: 'POST', url: '/api/discover/import', headers: H, payload: { text: 'no json here' } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/api/discover/import', headers: H, payload: { text: '{"ideas":[]}' } })).json().message).toMatch(/missing something/);
    expect(parseIdeas(JSON.stringify({ ideas: [{ topic: 'Why does the sky look blue?', hook: 'hook' }] }))[0]).toMatchObject({ seconds: 60, why: '' });
  });
});
