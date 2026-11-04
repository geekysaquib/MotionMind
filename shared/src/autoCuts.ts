import { MIN_SCENE_SEC, PEAKS_PER_SEC } from './editor';

/** How long a line takes to say, relative to the others: words, plus a little for pauses at punctuation. */
export function speechWeight(narration: string): number {
  const words = narration.split(/\s+/).filter(Boolean);
  let w = 0;
  for (const word of words) w += Math.max(2, word.length) + (/[.?!]$/.test(word) ? 5 : /[,;:]$/.test(word) ? 2 : 0);
  return Math.max(4, w);
}

const smooth = (values: number[], radius: number) => values.map((_, i) => {
  let sum = 0;
  let n = 0;
  for (let j = Math.max(0, i - radius); j <= Math.min(values.length - 1, i + radius); j++) {
    sum += values[j]!;
    n++;
  }
  return sum / n;
});

/**
 * Guesses where each scene starts in one recording of the whole reel.
 *
 * It spreads the scenes over the part of the file where someone is speaking, in proportion to how much each
 * line has to say, then moves every break into the quietest nearby pause. Returns one cut fewer than there are
 * narrations, in seconds.
 */
export function autoCuts(peaks: number[], durationSec: number, narrations: string[], peaksPerSec = PEAKS_PER_SEC): number[] {
  const n = narrations.length;
  if (n <= 1) return [];
  const minGap = MIN_SCENE_SEC;
  const weights = narrations.map(speechWeight);
  const total = weights.reduce((a, b) => a + b, 0);

  if (!peaks.length) {
    // Nothing to listen to: split by weight over the whole file.
    let acc = 0;
    return weights.slice(0, -1).map((w) => {
      acc += w;
      return Math.round(((acc / total) * durationSec) * 100) / 100;
    });
  }

  const amp = smooth(peaks, 1);
  const top = Math.max(...amp, 1);
  const threshold = top * 0.1;
  const first = amp.findIndex((a) => a > threshold);
  const last = amp.length - 1 - [...amp].reverse().findIndex((a) => a > threshold);
  const speechStart = first >= 0 ? first / peaksPerSec : 0;
  const speechEnd = first >= 0 ? (last + 1) / peaksPerSec : durationSec;
  const span = Math.max(speechEnd - speechStart, durationSec * 0.2);

  const cuts: number[] = [];
  let acc = 0;
  for (let k = 0; k < n - 1; k++) {
    acc += weights[k]!;
    const expected = speechStart + (acc / total) * span;
    const nextSceneLen = (weights[k + 1]! / total) * span;
    const thisSceneLen = (weights[k]! / total) * span;
    const radius = Math.max(0.5, 0.4 * Math.min(thisSceneLen, nextSceneLen));
    const lo = Math.max((cuts[k - 1] ?? 0) + minGap, expected - radius);
    const hi = Math.min(durationSec - minGap * (n - 1 - k), expected + radius);
    let best = Math.min(Math.max(expected, lo), Math.max(lo, hi));
    if (hi > lo) {
      let bestScore = Infinity;
      for (let i = Math.ceil(lo * peaksPerSec); i <= Math.floor(hi * peaksPerSec); i++) {
        const t = i / peaksPerSec;
        // Quiet beats loud; between equally quiet spots, the one nearer where the line should end wins.
        const score = (amp[Math.min(i, amp.length - 1)] ?? 0) + (Math.abs(t - expected) / radius) * (top * 0.08);
        if (score < bestScore) {
          bestScore = score;
          best = t;
        }
      }
    }
    cuts.push(Math.round(best * 100) / 100);
  }
  return cuts;
}
