import type { KeyTestResult, ProviderId } from '@motionmind/shared';

type Fetch = typeof fetch;
export type KeyTester = (apiKey: string, fetchImpl: Fetch) => Promise<KeyTestResult>;

const TIMEOUT_MS = 10_000;

async function probe(fetchImpl: Fetch, url: string, headers: Record<string, string>, okDetail: string): Promise<KeyTestResult> {
  try {
    const res = await fetchImpl(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (res.ok) return { ok: true, detail: okDetail };
    if (res.status === 401 || res.status === 403) return { ok: false, detail: 'The provider rejected this key.' };
    return { ok: false, detail: `The provider answered with HTTP ${res.status}.` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, detail: `Could not reach the provider (${msg}). Check the server's network access.` };
  }
}

/** Free, read-only calls that prove a key works without spending credits. */
export const KEY_TESTERS: Partial<Record<ProviderId, KeyTester>> = {
  openai: (k, f) => probe(f, 'https://api.openai.com/v1/models', { Authorization: `Bearer ${k}` }, 'Key works.'),
  anthropic: (k, f) =>
    probe(f, 'https://api.anthropic.com/v1/models', { 'x-api-key': k, 'anthropic-version': '2023-06-01' }, 'Key works.'),
  elevenlabs: (k, f) => probe(f, 'https://api.elevenlabs.io/v1/user', { 'xi-api-key': k }, 'Key works.'),
  replicate: (k, f) => probe(f, 'https://api.replicate.com/v1/account', { Authorization: `Bearer ${k}` }, 'Key works.'),
  google_tts: (k, f) =>
    probe(f, `https://texttospeech.googleapis.com/v1/voices?languageCode=en-IN&key=${encodeURIComponent(k)}`, {}, 'Key works.'),
};
