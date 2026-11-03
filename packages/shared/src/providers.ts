import { z } from 'zod';

export const PROVIDERS = ['openai', 'anthropic', 'tavily', 'exa', 'elevenlabs', 'replicate', 'google_tts'] as const;
export type ProviderId = (typeof PROVIDERS)[number];
export const providerIdSchema = z.enum(PROVIDERS);

export type Capability = 'llm' | 'research' | 'image' | 'voice' | 'video';

export interface ProviderInfo {
  id: ProviderId;
  label: string;
  capabilities: Capability[];
  keyHint: string;
  docsUrl: string;
  /** Whether the API server can verify the key with a free, read-only call. */
  testable: boolean;
}

export const PROVIDER_INFO: Record<ProviderId, ProviderInfo> = {
  openai: { id: 'openai', label: 'OpenAI', capabilities: ['llm', 'image', 'voice'], keyHint: 'sk-…', docsUrl: 'https://platform.openai.com/api-keys', testable: true },
  anthropic: { id: 'anthropic', label: 'Anthropic', capabilities: ['llm'], keyHint: 'sk-ant-…', docsUrl: 'https://console.anthropic.com/settings/keys', testable: true },
  tavily: { id: 'tavily', label: 'Tavily', capabilities: ['research'], keyHint: 'tvly-…', docsUrl: 'https://app.tavily.com', testable: false },
  exa: { id: 'exa', label: 'Exa', capabilities: ['research'], keyHint: 'exa key', docsUrl: 'https://dashboard.exa.ai/api-keys', testable: false },
  elevenlabs: { id: 'elevenlabs', label: 'ElevenLabs', capabilities: ['voice'], keyHint: 'sk_…', docsUrl: 'https://elevenlabs.io/app/settings/api-keys', testable: true },
  replicate: { id: 'replicate', label: 'Replicate', capabilities: ['image', 'video'], keyHint: 'r8_…', docsUrl: 'https://replicate.com/account/api-tokens', testable: true },
  google_tts: { id: 'google_tts', label: 'Google Cloud TTS', capabilities: ['voice'], keyHint: 'AIza…', docsUrl: 'https://console.cloud.google.com/apis/credentials', testable: true },
};

/** What the API returns about a stored key. The key itself never leaves the server. */
export interface StoredKeySummary {
  provider: ProviderId;
  last4: string;
  updatedAt: string;
  lastTestedAt: string | null;
  lastTestOk: boolean | null;
}

export const saveKeySchema = z.object({ apiKey: z.string().trim().min(8, 'That key looks too short.').max(500) });

export type KeyTestResult = { ok: true; detail: string } | { ok: false; detail: string };
