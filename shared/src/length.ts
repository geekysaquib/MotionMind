// How much a reel of a given length holds, so the research, the script and the animation all aim at the length the
// creator chose (15 to 90 seconds) instead of a fixed one-minute shape.

/** Spoken words per second for an Indian explainer read at a natural pace (Hinglish, Hindi or English). */
export const WORDS_PER_SECOND = 2.6;

export interface LengthPlan {
  seconds: number;
  /** Narration words in total: aim for `words`, stay between min and max. */
  words: { min: number; target: number; max: number };
  /** Scenes (beats), about one every 6 to 7 seconds. */
  beats: { min: number; max: number };
  /** Facts worth finding in research: a little more than one per scene. */
  facts: number;
}

export function lengthPlan(durationSec: number): LengthPlan {
  const seconds = Math.min(180, Math.max(10, Math.round(durationSec || 60)));
  const target = Math.round(seconds * WORDS_PER_SECOND);
  const beats = Math.max(3, Math.round(seconds / 6.5));
  return {
    seconds,
    words: { min: Math.round(target * 0.92), target, max: Math.round(target * 1.08) },
    beats: { min: Math.max(3, beats - 1), max: beats + 2 },
    facts: Math.max(5, Math.round(beats * 1.3)),
  };
}

/** Words of narration in a script (what the voice will say). */
export function narrationWords(beats: { narration: string }[]): number {
  return beats.reduce((n, b) => n + b.narration.trim().split(/\s+/).filter(Boolean).length, 0);
}

/** A plain sentence when a script's narration is clearly off the chosen length, else null. */
export function lengthWarning(beats: { narration: string }[], durationSec: number): string | null {
  const plan = lengthPlan(durationSec);
  const words = narrationWords(beats);
  const spoken = Math.round(words / WORDS_PER_SECOND);
  if (words < plan.words.min * 0.85) return `This script is about ${spoken} seconds when spoken (${words} words), shorter than the ${plan.seconds} seconds you chose. Ask Claude to make it longer: about ${plan.words.target} words in ${plan.beats.min} to ${plan.beats.max} scenes.`;
  if (words > plan.words.max * 1.15) return `This script is about ${spoken} seconds when spoken (${words} words), longer than the ${plan.seconds} seconds you chose. Ask Claude to cut it to about ${plan.words.target} words.`;
  return null;
}
