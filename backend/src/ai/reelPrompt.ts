import { z } from 'zod/v4';
import { reelScriptSchema, type ReelScript } from './reelSchema';

// One prompt for both ways of getting a script: the API call ("Write with Claude") and the
// copy-paste route through claude.ai for people with a Claude subscription but no API key.

export interface ReelBrief {
  topic: string;
  durationSec: number;
  language: 'en' | 'hi' | 'hinglish';
  niche: string | null;
  channelName: string | null;
}

const LANGUAGE: Record<ReelBrief['language'], string> = {
  en: 'English',
  hi: 'Hindi in Devanagari script',
  hinglish: 'Hinglish (Hindi written in Latin script, with common English tech words), like a friendly Indian tech creator',
};

export const REEL_SYSTEM = `You write scripts for short vertical explainer reels (Instagram Reels, 1080x1920).
The style: a curious hook in the first beat, then a clear step-by-step explanation of how something really works, then a short payoff.
Each beat is one or two short spoken sentences plus an on-screen card that makes the point visual (chips, a flow of 2-4 arrows, a key/value fact, or a note).
Be accurate. If a number or claim is uncertain, phrase it carefully or leave it out rather than invent it.
Narration is spoken aloud: no emoji, no hashtags, no markdown. Card headlines are punchy and under 9 words.`;

/** The user turn: what this particular reel is about. */
export function reelRequest(brief: ReelBrief): string {
  return [
    `Write a reel about: ${brief.topic}`,
    `Length: about ${brief.durationSec} seconds spoken (roughly ${Math.round(brief.durationSec * 2.7)} words of narration in total).`,
    `Language for narration, card text and step names: ${LANGUAGE[brief.language]}.`,
    brief.niche ? `Channel niche: ${brief.niche}.` : '',
    brief.channelName ? `Channel name: ${brief.channelName}.` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/** Everything to paste into claude.ai: instructions, the brief, and the exact JSON shape to answer in. */
export function manualReelPrompt(brief: ReelBrief): string {
  const schema = JSON.stringify(z.toJSONSchema(reelScriptSchema));
  return `${REEL_SYSTEM}

${reelRequest(brief)}

Answer with only one JSON object, no other text, that matches this JSON Schema:
${schema}`;
}

export class PastedScriptError extends Error {}

/**
 * Reads a script pasted back from claude.ai. Accepts the JSON with or without a ```json fence
 * and with chat text around it; rejects anything that doesn't match the reel format.
 */
export function parsePastedScript(text: string): ReelScript {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new PastedScriptError("That doesn't look like a script. Paste Claude's whole answer (the part in { }).");
  let data: unknown;
  try {
    data = JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new PastedScriptError("The pasted script isn't complete JSON. Copy Claude's whole answer and try again.");
  }
  const parsed = reelScriptSchema.safeParse(data);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new PastedScriptError(`The script is missing something Claude should have included${issue ? ` (${issue.path.join('.') || 'top level'}: ${issue.message})` : ''}. Ask Claude to fix it, or copy the prompt again.`);
  }
  if (parsed.data.beats.length === 0) throw new PastedScriptError('The script has no beats. Ask Claude to try again.');
  return parsed.data;
}
