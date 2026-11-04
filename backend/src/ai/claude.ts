import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { REEL_SYSTEM, reelRequest, type ReelBrief } from './reelPrompt';
import { reelScriptSchema, type ReelScript } from './reelSchema';

export type { ReelBrief };

/** The model every Claude call uses. */
export const CLAUDE_MODEL = 'claude-opus-5-5';

// If Claude declines a request, the API retries it on a suitable fallback model inside the same call.
const FALLBACK = { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const };

export interface ClaudeReply {
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export interface ClaudeClient {
  ask(prompt: string): Promise<ClaudeReply>;
  writeReel(brief: ReelBrief): Promise<{ script: ReelScript; model: string }>;
}

/** What went wrong, in words the UI can show as-is. */
export class ClaudeError extends Error {
  constructor(
    message: string,
    readonly code: 'claude_key_rejected' | 'claude_rate_limited' | 'claude_refused' | 'claude_bad_output' | 'claude_unavailable',
    readonly status: number,
  ) {
    super(message);
  }
}

function toClaudeError(err: unknown): never {
  if (err instanceof ClaudeError) throw err;
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    throw new ClaudeError("The server's Anthropic API key was rejected. Check ANTHROPIC_API_KEY.", 'claude_key_rejected', 502);
  }
  if (err instanceof Anthropic.RateLimitError) {
    throw new ClaudeError('Claude is rate-limiting this key. Wait a minute and try again.', 'claude_rate_limited', 429);
  }
  if (err instanceof Anthropic.APIError) {
    throw new ClaudeError(`Claude returned an error (${err.status ?? 'network'}). Try again in a moment.`, 'claude_unavailable', 502);
  }
  throw err;
}

export function claudeClient(apiKey: string, fetchImpl?: typeof fetch): ClaudeClient {
  const client = new Anthropic({ apiKey, ...(fetchImpl ? { fetch: fetchImpl } : {}) });

  return {
    async ask(prompt) {
      try {
        const res = await client.beta.messages.create({
          ...FALLBACK,
          model: CLAUDE_MODEL,
          max_tokens: 4000,
          output_config: { effort: 'low' },
          messages: [{ role: 'user', content: prompt }],
        });
        if (res.stop_reason === 'refusal') throw new ClaudeError("Claude declined to answer that.", 'claude_refused', 422);
        const text = res.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('\n').trim();
        return { text, model: res.model, inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens };
      } catch (err) {
        toClaudeError(err);
      }
    },

    async writeReel(brief) {
      const prompt = reelRequest(brief);
      try {
        const res = await client.beta.messages.parse({
          ...FALLBACK,
          model: CLAUDE_MODEL,
          max_tokens: 16000,
          output_config: { effort: 'medium', format: betaZodOutputFormat(reelScriptSchema) },
          system: REEL_SYSTEM,
          messages: [{ role: 'user', content: prompt }],
        });
        if (res.stop_reason === 'refusal') throw new ClaudeError('Claude declined to write a reel on this topic.', 'claude_refused', 422);
        if (!res.parsed_output) throw new ClaudeError("Claude's script came back incomplete. Try again.", 'claude_bad_output', 502);
        return { script: res.parsed_output, model: res.model };
      } catch (err) {
        toClaudeError(err);
      }
    },
  };
}
