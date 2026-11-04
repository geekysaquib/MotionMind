import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod/v4';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { PastedScriptError, parseResearch, RESEARCH_SYSTEM, REEL_SYSTEM, reelRequest, researchRequest, type ReelBrief } from './reelPrompt';
import { reelScriptSchema, researchSchema, type ReelScript, type Research } from './reelSchema';

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
  /** Searches the web and returns checked facts with their sources. */
  research(brief: Pick<ReelBrief, 'topic'>): Promise<{ research: Research; model: string; searches: number }>;
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
          max_tokens: 8000,
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

    async research(brief) {
      // Web search runs on Anthropic's side. A long search can pause the turn; we resume it a few times.
      const messages: Anthropic.Beta.BetaMessageParam[] = [
        {
          role: 'user',
          content: `${researchRequest(brief)}\n\nSearch the web first. Then answer with only one JSON object, no other text, matching this JSON Schema:\n${JSON.stringify(z.toJSONSchema(researchSchema))}`,
        },
      ];
      try {
        let searches = 0;
        for (let turn = 0; turn < 4; turn++) {
          const res = await client.beta.messages.create({
            ...FALLBACK,
            model: CLAUDE_MODEL,
            max_tokens: 16000,
            output_config: { effort: 'medium' },
            system: RESEARCH_SYSTEM,
            tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 6 }],
            messages,
          });
          searches += res.content.filter((b) => b.type === 'server_tool_use').length;
          if (res.stop_reason === 'refusal') throw new ClaudeError('Claude declined to research this topic.', 'claude_refused', 422);
          if (res.stop_reason === 'pause_turn') {
            messages.push({ role: 'assistant', content: res.content });
            continue;
          }
          const text = res.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('\n');
          try {
            return { research: parseResearch(text, 'research'), model: res.model, searches };
          } catch (err) {
            if (err instanceof PastedScriptError) throw new ClaudeError(`Claude's research came back in the wrong shape. Try again. ${err.message}`, 'claude_bad_output', 502);
            throw err;
          }
        }
        throw new ClaudeError('The research took too long. Try again.', 'claude_unavailable', 504);
      } catch (err) {
        toClaudeError(err);
      }
    },
  };
}
