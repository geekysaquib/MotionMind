import type { KeyTestResult, ProviderId, StoredKeySummary } from '@motionmind/shared';
import { ServiceError, type KeysService } from './types';

export function httpKeysService(baseUrl: string, getToken: () => string | null, fetchImpl: typeof fetch = fetch): KeysService {
  async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = getToken();
    if (!token) throw new ServiceError('You are signed out.', 'unauthorized');
    let res: Response;
    try {
      res = await fetchImpl(`${baseUrl}/api${path}`, {
        ...init,
        headers: { Authorization: `Bearer ${token}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
      });
    } catch {
      throw new ServiceError(`Can't reach the Motion Mind API at ${baseUrl}. Is it running?`, 'network');
    }
    const body = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
    if (!res.ok) throw new ServiceError(body.message ?? `Request failed (${res.status}).`, body.error ?? 'http');
    return body as T;
  }
  return {
    list: async () => (await call<{ keys: StoredKeySummary[] }>('/keys')).keys,
    save: async (provider, apiKey) =>
      (await call<{ key: StoredKeySummary }>(`/keys/${provider}`, { method: 'PUT', body: JSON.stringify({ apiKey }) })).key,
    remove: async (provider) => {
      await call(`/keys/${provider}`, { method: 'DELETE' });
    },
    test: (provider: ProviderId) => call<{ result: KeyTestResult; tested: boolean }>(`/keys/${provider}/test`, { method: 'POST' }),
  };
}
