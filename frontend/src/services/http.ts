import { log } from '../lib/logger';
import { ServiceError } from './types';

/** Calls that must not log themselves (sending logs would otherwise log a send). */
const QUIET_PATHS = new Set(['/client-logs']);

/**
 * The one way the web app calls the Motion Mind API. Paths are under /api.
 * Errors come back as ServiceError with the server's message and code, ready to show in the UI.
 * Every call is logged (method, path, status, time taken). Bodies are never logged.
 */
export async function apiRequest<T>(
  baseUrl: string,
  path: string,
  opts: { method?: string; body?: unknown; token?: string | null; fetchImpl?: typeof fetch } = {},
): Promise<T> {
  const method = opts.method ?? 'GET';
  const quiet = QUIET_PATHS.has(path);
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  const started = Date.now();
  let res: Response;
  try {
    res = await (opts.fetchImpl ?? fetch)(`${baseUrl}/api${path}`, {
      method,
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
  } catch (err) {
    if (!quiet) log.error('api', `${method} ${path} could not reach the server`, { err, ms: Date.now() - started });
    throw new ServiceError(`Can't reach the Motion Mind API${baseUrl ? ` at ${baseUrl}` : ''}. Is it running?`, 'network');
  }
  const body = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
  const meta = { status: res.status, ms: Date.now() - started };
  // A 5xx without our { error } shape didn't come from the API: it's the Vite dev proxy or Netlify
  // saying the API isn't answering (for example `npm run dev:api` isn't running).
  if (res.status >= 500 && !body.error) {
    if (!quiet) log.error('api', `${method} ${path}: no answer from the API`, meta);
    throw new ServiceError(
      `The Motion Mind API isn't answering (HTTP ${res.status}). ${import.meta.env?.DEV ? 'Start it with `npm run dev`.' : 'Try again in a minute.'}`,
      'api_unreachable',
    );
  }
  if (!res.ok) {
    const code = body.error ?? (res.status === 401 ? 'unauthorized' : 'http');
    if (!quiet) {
      const line = `${method} ${path} failed: ${body.message ?? res.statusText}`;
      if (res.status >= 500) log.error('api', line, { ...meta, error: code });
      else if (res.status === 401) log.info('api', line, { ...meta, error: code });
      else log.warn('api', line, { ...meta, error: code });
    }
    throw new ServiceError(body.message ?? `Request failed (${res.status}).`, code);
  }
  if (!quiet) log.debug('api', `${method} ${path}`, meta);
  return body as T;
}
