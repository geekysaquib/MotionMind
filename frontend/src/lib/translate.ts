/** The narration in another language: a prompt for claude.ai and a reader for its answer. */
export const LANGUAGES = ['English', 'Hindi', 'Hinglish', 'Marathi', 'Tamil', 'Telugu', 'Bengali', 'Gujarati', 'Kannada', 'Punjabi'] as const;

const HINTS: Record<string, string> = {
  English: 'natural, spoken English',
  Hindi: 'natural, spoken Hindi written in Devanagari script (keep common English tech words like UPI, app or server as they are)',
  Hinglish: 'natural, spoken Hinglish: Hindi written in the Roman alphabet, the way people text, with English words where people use them',
};

/** A prompt that turns the scene lines into another language, one line per scene, as a JSON array. */
export function translatePrompt(lines: string[], language: string, note = ''): string {
  const target = HINTS[language] ?? `natural, spoken ${language}, in that language's own script (keep common English tech words as they are)`;
  return [
    `Translate these ${lines.length} voiceover lines for a short Instagram reel into ${target}.`,
    'They are read aloud, so keep each line short and easy to say. Keep the meaning, names and numbers.',
    `Reply with ONLY a JSON array of exactly ${lines.length} strings, in the same order, one per line. No notes, no markdown.`,
    '',
    JSON.stringify(lines, null, 2),
    ...(note ? ['', `Extra instructions from the creator: ${note}`] : []),
  ].join('\n');
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
