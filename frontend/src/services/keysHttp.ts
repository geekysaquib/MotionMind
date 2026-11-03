import type { KeyTestResult, ProviderId, StoredKeySummary } from '@motionmind/shared';
import { apiRequest } from './http';
import { ServiceError, type KeysService } from './types';

/** Provider keys always go to the API, in demo mode too, because only the server may hold them. */
export function httpKeysService(baseUrl: string, getToken: () => string | null, fetchImpl: typeof fetch = fetch): KeysService {
  async function call<T>(path: string, method = 'GET', body?: unknown) {
    const token = getToken();
    if (!token) throw new ServiceError('You are signed out.', 'unauthorized');
    return apiRequest<T>(baseUrl, path, { method, body, token, fetchImpl });
  }
  return {
    list: async () => (await call<{ keys: StoredKeySummary[] }>('/keys')).keys,
    save: async (provider, apiKey) => (await call<{ key: StoredKeySummary }>(`/keys/${provider}`, 'PUT', { apiKey })).key,
    remove: async (provider) => {
      await call(`/keys/${provider}`, 'DELETE');
    },
    test: (provider: ProviderId) => call<{ result: KeyTestResult; tested: boolean }>(`/keys/${provider}/test`, 'POST'),
  };
}
