import { MIN_SCENE_SEC } from './editor';
import { wordsOf, type SpeechRun } from './alignScript';

// Word-level fit. Text-to-speech reads a script straight through, often with almost no pause between scenes, so pauses
// cannot tell where a scene starts. The words can: whisper.cpp writes down every word it hears with its time, and this
// matches those words to the script's words in order (they need not be spelled the same: whisper may write Hindi in
// Devanagari, or mis-hear a name). A scene starts when its first word is spoken.

export interface HeardWord {
  text: string;
  start: number;
  end: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const norm = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const m = a.length;
  const n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return 1 - prev[n]! / Math.max(m, n);
}

/**
 * For each script word, the heard word it was most likely spoken as (or null). In-order alignment: a match scores for
 * similar spelling and for sitting at the same relative place in both lists, so it still works when whisper writes the
 * words in another script, as long as the counts are about the same.
 */
export function matchWords(script: string[], heard: string[]): (number | null)[] {
  const n = script.length;
  const m = heard.length;
  const GAP = -0.5;
  const a = script.map(norm);
  const b = heard.map(norm);
  const score = (i: number, j: number) => similarity(a[i]!, b[j]!) * 2 - 0.6 - 3 * Math.abs(i / Math.max(1, n) - j / Math.max(1, m));
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  const back: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    dp[i]![0] = i * GAP;
    back[i]![0] = 1;
  }
  for (let j = 1; j <= m; j++) {
    dp[0]![j] = j * GAP;
    back[0]![j] = 2;
  }
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const diag = dp[i - 1]![j - 1]! + score(i - 1, j - 1);
      const up = dp[i - 1]![j]! + GAP;
      const left = dp[i]![j - 1]! + GAP;
      if (diag >= up && diag >= left) {
        dp[i]![j] = diag;
        back[i]![j] = 0;
      } else if (up >= left) {
        dp[i]![j] = up;
        back[i]![j] = 1;
      } else {
        dp[i]![j] = left;
        back[i]![j] = 2;
      }
    }
  }
  const out: (number | null)[] = new Array(n).fill(null);
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    const b0 = back[i]![j]!;
    if (i > 0 && j > 0 && b0 === 0) {
      out[i - 1] = j - 1;
      i--;
      j--;
    } else if (i > 0 && (j === 0 || b0 === 1)) i--;
    else j--;
  }
  return out;
}

/** Whisper's times lean into the pauses. Starts move forward to where the voice really begins, ends back to where it stops. */
export function snapToVoice(times: [number, number][], loud: SpeechRun[]): [number, number][] {
  if (!loud.length) return times;
  const LIMIT = 0.7;
  return times.map(([s, e]) => {
    let start = s;
    let end = e;
    if (!loud.some((r) => s >= r.start - 0.01 && s < r.end)) {
      const next = loud.find((r) => r.start >= s);
      if (next && next.start - s <= LIMIT) start = next.start;
    }
    if (!loud.some((r) => e > r.start && e <= r.end + 0.01)) {
      const prev = [...loud].reverse().find((r) => r.end <= e);
      if (prev && e - prev.end <= LIMIT) end = prev.end;
    }
    return [start, Math.max(end, start + 0.05)] as [number, number];
  });
}

/**
 * Finds where each scene starts from the words whisper heard. Returns null when the heard words are too few or too many to
 * be this script (then the caller fits by pauses). `win` is the part of the recording that is used.
 *
 * Only the scene starts come from the heard words: whisper's own word times are rough (it can glue several short words
 * together), so inside a scene the words are laid over the speech with `placeWords`.
 */
export function sceneStartsFromWords(narrations: string[], heardAll: HeardWord[], loud: SpeechRun[], win: { start: number; end: number }): number[] | null {
  const words = narrations.map(wordsOf);
  const flat = words.flat();
  const n = flat.length;
  if (narrations.length < 2 || !n) return null;
  const heard = heardAll.filter((h) => h.start >= win.start - 0.05 && h.start < win.end);
  if (heard.length < n * 0.5 || heard.length > n * 2) return null;
  const match = matchWords(flat, heard.map((h) => h.text));
  if (match.filter((j) => j !== null).length < Math.max(2, n * 0.3)) return null;

  const weight = (w: string) => Math.max(2, norm(w).length);
  const cuts: number[] = [];
  let first = 0;
  for (let k = 0; k < words.length - 1; k++) {
    first += words[k]!.length;
    // The nearest matched words on each side of the first word of the next scene.
    let before = first - 1;
    while (before >= 0 && match[before] === null) before--;
    let after = first;
    while (after < n && match[after] === null) after++;
    const prevEnd = before >= 0 ? heard[match[before]!]!.end : win.start;
    const nextStart = after < n ? heard[match[after]!]!.start : Math.max(prevEnd, heard[heard.length - 1]!.end);
    // Spread the unmatched words between them by length, and read off where the first word of the next scene falls.
    const gapWords = flat.slice(before + 1, after + (after < n ? 0 : 0));
    const total = gapWords.reduce((s, w) => s + weight(w), 0) || 1;
    const lead = flat.slice(before + 1, first).reduce((s, w) => s + weight(w), 0);
    let t = after === first ? nextStart : prevEnd + ((nextStart - prevEnd) * lead) / total;
    // Whisper's times lean into pauses: if a pause is close, the scene starts at the end of it.
    const gaps = loud.slice(0, -1).map((r, i) => ({ before: r.end, after: loud[i + 1]!.start })).filter((g) => g.after - g.before >= 0.08);
    const near = gaps.filter((g) => t >= g.before - 0.35 && t <= g.after + 0.35).sort((x, y) => Math.abs((x.before + x.after) / 2 - t) - Math.abs((y.before + y.after) / 2 - t))[0];
    if (near) t = Math.max(near.before, near.after - 0.12);
    else {
      // Inside a stretch of speech: start at the word's own start, a hair early.
      t = Math.max(prevEnd, t - 0.05);
    }
    cuts.push(r2(Math.max(t, (cuts[k - 1] ?? win.start) + MIN_SCENE_SEC)));
  }
  if (cuts.some((c) => c >= win.end - 0.2)) return null;
  return cuts;
}
