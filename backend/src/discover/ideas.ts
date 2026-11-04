import { z } from 'zod/v4';
import { extractJson, PastedScriptError } from '../ai/reelPrompt';
import type { Trending, TrendLang } from './trending';

// Turning "what people read yesterday" into reel ideas, with Claude (on the server's key, or pasted from claude.ai).

export interface TrendIdea {
  topic: string;
  hook: string;
  seconds: 15 | 30 | 45 | 60 | 90;
  why: string;
}

const LENGTHS = [15, 30, 45, 60, 90] as const;
const nearest = (n: number): TrendIdea['seconds'] => LENGTHS.reduce((best, x) => (Math.abs(x - n) < Math.abs(best - n) ? x : best), 60 as TrendIdea['seconds']);

const ideasSchema = z.object({
  ideas: z
    .array(
      z.object({
        topic: z.string().trim().min(8).max(200),
        hook: z.string().trim().min(3).max(300),
        seconds: z.number().optional(),
        why: z.string().trim().max(240).optional(),
      }),
    )
    .min(1)
    .max(20),
});

const LANG_NAME: Record<TrendLang, string> = { en: 'English', hi: 'Hindi' };

/** The prompt that asks Claude to pick from the trending pages and write reel ideas. */
export function trendingPrompt(t: Trending): string {
  const list = t.items.map((it, i) => `${i + 1}. ${it.title}: ${it.views.toLocaleString('en-US')} views`).join('\n');
  return [
    `These are the most-read pages on ${LANG_NAME[t.lang]} Wikipedia on ${t.date}, with their view counts:`,
    '',
    list,
    '',
    'Pick the ones a curious Indian audience would want explained, and turn up to 8 of them into ideas for short Instagram explainer reels.',
    'Each idea is a question about HOW or WHY something works, or what really happened, not just the name of the page. Skip pages about private lives, tragedies, adult content and pure celebrity gossip.',
    'Reply with ONLY JSON, no notes and no markdown, in exactly this shape:',
    '{"ideas":[{"topic":"the question the reel answers","hook":"one line that makes someone stop scrolling","seconds":45,"why":"one short line on why it is in the news"}]}',
    '"seconds" is 15, 30, 45, 60 or 90, whatever the idea needs.',
  ].join('\n');
}

/** Reads Claude's answer into ideas. Accepts a code fence and chat text around the JSON. */
export function parseIdeas(text: string): TrendIdea[] {
  const parsed = ideasSchema.safeParse(extractJson(text, 'a list of ideas'));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new PastedScriptError(`The ideas are missing something${issue ? ` (${issue.path.join('.') || 'top level'}: ${issue.message})` : ''}. Ask Claude to fix it, or copy the prompt again.`);
  }
  return parsed.data.ideas.map((i) => ({ topic: i.topic, hook: i.hook, seconds: nearest(i.seconds ?? 60), why: i.why ?? '' }));
}
