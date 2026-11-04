import { normalizePlatforms, type Platform } from '@motionmind/shared';

/** Languages the narration script can be copied in. `original` is the script as written. */
export type ScriptLanguage = 'original' | 'en' | 'hi';

export const LANGUAGE_LABELS: Record<ScriptLanguage, string> = {
  original: 'As written',
  en: 'English',
  hi: 'Hindi (हिन्दी)',
};

const TARGET: Record<'en' | 'hi', string> = {
  en: 'natural, spoken English',
  hi: 'natural, spoken Hindi written in Devanagari script (keep common English tech words like UPI, app or server as they are)',
};

/** A prompt that turns the scene lines into another language, one line per scene, as a JSON array. */
export function translatePrompt(lines: string[], lang: 'en' | 'hi'): string {
  return [
    `Translate these ${lines.length} voiceover lines for a short Instagram reel into ${TARGET[lang]}.`,
    'They are read aloud, so keep each line short and easy to say. Keep the meaning, names and numbers.',
    `Reply with ONLY a JSON array of exactly ${lines.length} strings, in the same order, one per line. No notes, no markdown.`,
    '',
    JSON.stringify(lines, null, 2),
  ].join('\n');
}

/** Who the viewer is told to follow: the channel name, else the handle, else the studio name. */
export function followName(profile: { channelName: string | null; handle: string | null } | null | undefined, fallback: string): string {
  return profile?.channelName?.trim() || (profile?.handle ? `@${profile.handle}` : '') || fallback;
}

/** The last thing the voice says: a follow message with the brand or handle, in the language of the script. */
export function closingLine(language: 'en' | 'hi' | 'hinglish', name: string, platforms: Platform[] = ['instagram']): string {
  const list = normalizePlatforms(platforms);
  const both = list.length > 1;
  const youtube = list[0] === 'youtube';
  if (language === 'en') return both ? `Follow ${name} on Instagram and subscribe on YouTube for more explainers like this.` : youtube ? `Subscribe to ${name} for more explainers like this.` : `Follow ${name} for more explainers like this.`;
  if (language === 'hi') return both ? `ऐसे और वीडियो के लिए ${name} को इंस्टाग्राम पर फ़ॉलो करें और यूट्यूब पर सब्सक्राइब करें।` : youtube ? `ऐसे और वीडियो के लिए ${name} को सब्सक्राइब करें।` : `ऐसे और वीडियो के लिए ${name} को फ़ॉलो करें।`;
  return both ? `Aise aur videos ke liye ${name} ko Instagram par follow karo aur YouTube par subscribe karo.` : youtube ? `Aise aur videos ke liye ${name} ko subscribe karo.` : `Aise aur videos ke liye ${name} ko follow karo.`;
}

export class TranslationError extends Error {}

/** Reads Claude's answer: a JSON array of strings, with or without a code fence, one per scene. */
export function parseTranslation(text: string, count: number): string[] {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const body = (fenced ? fenced[1]! : text).trim();
  const start = body.indexOf('[');
  const end = body.lastIndexOf(']');
  let parsed: unknown;
  try {
    parsed = JSON.parse(start >= 0 && end > start ? body.slice(start, end + 1) : body);
  } catch {
    throw new TranslationError("That doesn't look like the list we asked for. Paste Claude's whole answer, starting with [.");
  }
  if (!Array.isArray(parsed) || !parsed.every((x) => typeof x === 'string' && x.trim())) throw new TranslationError('Expected a list of text lines.');
  if (parsed.length !== count) throw new TranslationError(`Expected ${count} lines, one per scene, but got ${parsed.length}.`);
  return parsed.map((x: string) => x.trim());
}
