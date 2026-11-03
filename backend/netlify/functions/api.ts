import type { FastifyInstance } from 'fastify';
import { createAppFromEnv } from '../../src/bootstrap';
import { loadEnv } from '../../src/env';

// Runs the Fastify API as a Netlify Function. The app is built once per warm
// instance and each request is passed through with app.inject().
let appPromise: Promise<FastifyInstance> | undefined;

function getApp(): Promise<FastifyInstance> {
  appPromise ??= (async () => {
    // Netlify sets URL to the site's main address, so CORS works without extra config.
    const env = loadEnv({ WEB_ORIGIN: process.env.URL, ...process.env });
    const app = await createAppFromEnv(env, { logger: false });
    await app.ready();
    return app;
  })();
  return appPromise;
}

export default async (req: Request): Promise<Response> => {
  const app = await getApp();
  const url = new URL(req.url);
  const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.text();

  const res = await app.inject({
    method: req.method as 'GET',
    url: url.pathname + url.search,
    headers: Object.fromEntries(req.headers),
    payload: body || undefined,
  });

  const headers = new Headers();
  for (const [name, value] of Object.entries(res.headers)) {
    if (value === undefined) continue;
    for (const v of Array.isArray(value) ? value : [value]) headers.append(name, String(v));
  }
  return new Response(res.statusCode === 204 ? null : res.rawPayload, { status: res.statusCode, headers });
};

export const config = { path: ['/api/*', '/health'] };
