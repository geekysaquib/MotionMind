import { ServiceError } from './types';

/**
 * The one way the web app calls the Motion Mind API. Paths are under /api.
 * Errors come back as ServiceError with the server's message and code, ready to show in the UI.
 */
export async function apiRequest<T>(
  baseUrl: string,
  path: string,
  opts: { method?: string; body?: unknown; token?: string | null; fetchImpl?: typeof fetch } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  let res: Response;
  try {
    res = await (opts.fetchImpl ?? fetch)(`${baseUrl}/api${path}`, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
  } catch {
    throw new ServiceError(`Can't reach the Motion Mind API${baseUrl ? ` at ${baseUrl}` : ''}. Is it running?`, 'network');
  }
  const body = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
  if (!res.ok) throw new ServiceError(body.message ?? `Request failed (${res.status}).`, body.error ?? (res.status === 401 ? 'unauthorized' : 'http'));
  return body as T;
}
