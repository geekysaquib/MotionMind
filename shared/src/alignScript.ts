import { MIN_SCENE_SEC, PEAKS_PER_SEC } from './editor';

// Auto-fit: given the user's own recording of the whole narration, find where every scene starts and when every
// word of the script is spoken. The recording is first reduced to "speech runs" (the words whisper.cpp heard, or,
// without it, the stretches where the waveform is loud). The script's words are then laid over the speech time of
// those runs, in proportion to how long each word is, and each scene break is snapped to the best pause nearby.

export interface SpeechRun {
  start: number;
  end: number;
}

export interface ScriptFit {
  /** Where scene k + 1 starts, in seconds of the recording. One fewer than there are scenes. */
  cuts: number[];
  /** Start and end of every word of the narration, in script order, in seconds of the recording. */
  wordTimes: [number, number][];
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** The words of a narration, as the animation and the captions split them. */
export const wordsOf = (narration: string) => narration.split(/\s+/).filter(Boolean);

/** A short fingerprint of the script's words, to tell when the narration changed after a fit. */
export function narrationKey(narrations: string[]): string {
  let h = 5381;
  for (const ch of narrations.join('\u0001')) h = ((h << 5) + h + ch.charCodeAt(0)) | 0;
  return (h >>> 0).toString(36) + ':' + narrations.reduce((n, s) => n + wordsOf(s).length, 0);
}

/** How long a word takes to say, relative to the others. Pauses are not part of speech time, so punctuation adds nothing. */
const weightOf = (word: string) => Math.max(2, word.replace(/[^\p{L}\p{N}]/gu, '').length);

/** Stretches of the recording where someone is speaking, found from its loudness (0..99 every 1/20 s). */
export function runsFromPeaks(peaks: number[], peaksPerSec = PEAKS_PER_SEC): SpeechRun[] {
  if (!peaks.length) return [];
  const loud = Math.max(...peaks);
  if (loud < 8) return [];
  const thr = Math.max(6, loud * 0.12);
  const bridge = Math.max(1, Math.round(0.18 * peaksPerSec));
  const runs: SpeechRun[] = [];
  let start = -1;
  let quiet = 0;
  for (let i = 0; i <= peaks.length; i++) {
    const on = i < peaks.length && peaks[i]! >= thr;
    if (on) {
      if (start < 0) start = i;
      quiet = 0;
    } else if (start >= 0 && (++quiet > bridge || i === peaks.length)) {
      const end = i - quiet + 1;
      if (end - start >= 2) runs.push({ start: start / peaksPerSec, end: end / peaksPerSec });
      start = -1;
      quiet = 0;
    }
  }
  return runs;
}

/**
 * Whisper's word times often stretch into the pause after a word. Keeping only the parts that are actually loud puts
 * the pauses back, so a scene break can be found in them.
 */
export function clipToLoud(runs: SpeechRun[], loud: SpeechRun[]): SpeechRun[] {
  if (!loud.length) return runs;
  const out: SpeechRun[] = [];
  for (const r of runs) {
    for (const l of loud) {
      const start = Math.max(r.start, l.start);
      const end = Math.min(r.end, l.end);
      if (end - start >= 0.04) out.push({ start, end });
    }
  }
  return out.length ? out : runs;
}

/** Runs clipped to the part of the recording that is used, with touching ones joined. */
function prepare(runs: SpeechRun[], from: number, to: number): SpeechRun[] {
  const out: SpeechRun[] = [];
  for (const r of [...runs].sort((a, b) => a.start - b.start)) {
    const s = Math.max(from, r.start);
    const e = Math.min(to, r.end);
    if (e - s < 0.02) continue;
    const last = out[out.length - 1];
    if (last && s - last.end < 0.04) last.end = Math.max(last.end, e);
    else out.push({ start: s, end: e });
  }
  return out;
}

/** Speech time heard before time `t`. */
function speechBefore(runs: SpeechRun[], t: number): number {
  let s = 0;
  for (const r of runs) {
    if (t >= r.end) s += r.end - r.start;
    else {
      if (t > r.start) s += t - r.start;
      break;
    }
  }
  return s;
}

/** The time at which `tau` seconds of speech have been heard. `side` picks the end of the run before a pause or the start of the run after it. */
function timeAtSpeech(runs: SpeechRun[], tau: number, side: 'start' | 'end'): number {
  let s = 0;
  for (const r of runs) {
    const len = r.end - r.start;
    if (tau < s + len - 1e-9 || (side === 'end' && tau <= s + len + 1e-9)) {
      if (side === 'start' && tau >= s + len - 1e-9) continue;
      return r.start + Math.min(len, Math.max(0, tau - s));
    }
    s += len;
  }
  return runs.length ? runs[runs.length - 1]!.end : 0;
}

/**
 * Fits the script to the recording. Returns null when there is nothing to fit to (no speech heard).
 * `win` is the part of the recording that is used (after trimming); the last scene ends at `win.end`.
 */
export function alignScript(narrations: string[], rawRuns: SpeechRun[], win: { start: number; end: number }): ScriptFit | null {
  const n = narrations.length;
  const words = narrations.map(wordsOf);
  const flat = words.flat();
  if (!n || !flat.length) return null;
  const runs = prepare(rawRuns, win.start, win.end);
  if (!runs.length) return null;
  const total = speechBefore(runs, win.end);
  if (total < 0.5) return null;

  // Each scene's share of the speech, by the length of its words.
  const sceneWeights = words.map((ws) => ws.reduce((a, w) => a + weightOf(w), 0));
  const wsum = sceneWeights.reduce((a, b) => a + b, 0) || 1;
  const target: number[] = [];
  let acc = 0;
  for (let k = 0; k < n - 1; k++) {
    acc += sceneWeights[k]!;
    target.push((acc / wsum) * total);
  }

  // Candidate scene breaks: the pauses between speech runs, each with how much speech comes before it.
  const gaps = runs.slice(0, -1).map((r, i) => ({ tau: speechBefore(runs, r.end), pause: runs[i + 1]!.start - r.end, after: runs[i + 1]!.start, before: r.end }));
  const avgScene = total / n;
  let cutTimes: number[];
  if (n === 1) cutTimes = [];
  else if (gaps.length < n - 1) {
    // Fewer pauses than scenes: cut where the speech proportion says.
    cutTimes = target.map((tau) => timeAtSpeech(runs, tau, 'end'));
  } else {
    // Dynamic programming: pick one pause per scene break, in order, near where it should be and preferably a long one.
    const cost = (k: number, g: (typeof gaps)[number]) => Math.abs(g.tau - target[k]!) / avgScene - 0.35 * Math.min(1, g.pause / 0.6);
    const dp: number[][] = [];
    const from: number[][] = [];
    for (let k = 0; k < n - 1; k++) {
      dp.push(gaps.map(() => Infinity));
      from.push(gaps.map(() => -1));
      gaps.forEach((g, i) => {
        if (k === 0) {
          if (g.before - win.start >= MIN_SCENE_SEC) dp[0]![i] = cost(0, g);
          return;
        }
        let best = Infinity;
        let bj = -1;
        for (let j = 0; j < i; j++) {
          if (dp[k - 1]![j]! < best && gaps[i]!.before - gaps[j]!.after >= MIN_SCENE_SEC) {
            best = dp[k - 1]![j]!;
            bj = j;
          }
        }
        if (bj >= 0) {
          dp[k]![i] = best + cost(k, g);
          from[k]![i] = bj;
        }
      });
    }
    let bi = -1;
    let bv = Infinity;
    gaps.forEach((g, i) => {
      if (dp[n - 2]![i]! < bv && win.end - g.after >= MIN_SCENE_SEC) {
        bv = dp[n - 2]![i]!;
        bi = i;
      }
    });
    if (bi < 0) cutTimes = target.map((tau) => timeAtSpeech(runs, tau, 'end'));
    else {
      const pick: number[] = [];
      for (let k = n - 2; k >= 0; k--) {
        pick[k] = bi;
        bi = from[k]![bi]!;
      }
      // The break sits just before the next speech starts, so the new scene has a short lead-in.
      cutTimes = pick.map((i) => Math.max(gaps[i]!.before, gaps[i]!.after - 0.12));
    }
  }
  // Keep the breaks in order and apart.
  const cuts: number[] = [];
  cutTimes.forEach((t, k) => cuts.push(r2(Math.max(t, (cuts[k - 1] ?? win.start) + MIN_SCENE_SEC))));

  return { cuts, wordTimes: placeWords(narrations, runs, [win.start, ...cuts, win.end]) };
}

/**
 * When every word is spoken, for scene breaks that are already decided (found by alignScript, or moved by the user).
 * `edges` is [start of the first scene, ...breaks, end of the last scene]. Inside each scene the words are laid over
 * the speech that falls in it, so a word is never spoken in a pause.
 */
export function placeWords(narrations: string[], rawRuns: SpeechRun[], edges: number[]): [number, number][] {
  const words = narrations.map(wordsOf);
  const runs = prepare(rawRuns, edges[0]!, edges[edges.length - 1]!);
  const wordTimes: [number, number][] = [];
  words.forEach((ws, k) => {
    const a = edges[k]!;
    const b = edges[k + 1]!;
    const inScene = prepare(runs, a, b);
    const speech = speechBefore(inScene, b);
    const ww = ws.map(weightOf);
    const sum = ww.reduce((x, y) => x + y, 0) || 1;
    let c = 0;
    ws.forEach((_, j) => {
      let s: number;
      let e: number;
      if (speech < 0.2 || !inScene.length) {
        s = a + ((b - a) * c) / sum;
        e = a + ((b - a) * (c + ww[j]!)) / sum;
      } else {
        s = timeAtSpeech(inScene, (c / sum) * speech, 'start');
        e = timeAtSpeech(inScene, ((c + ww[j]!) / sum) * speech, 'end');
      }
      c += ww[j]!;
      wordTimes.push([r2(s), r2(Math.max(e, s + 0.05))]);
    });
  });
  return wordTimes;
}

/** Sentences of a narration: split after . ! ? or । */
export const sentencesOf = (narration: string) => narration.split(/(?<=[.!?।])\s+/).map((s) => s.trim()).filter(Boolean);

/**
 * Fits the script to a recording that has a short pause after every sentence (text-to-speech does). A scene always ends
 * at the end of a sentence, so each scene break is one of those pauses. The sentences are matched to the pauses in order,
 * by how long each sentence should take (its length), allowing for extra speech at the end (a closing line that is not
 * in the script). Returns null when the recording has fewer pauses than the script has sentence ends.
 */
export function alignBySentences(narrations: string[], rawRuns: SpeechRun[], win: { start: number; end: number }): ScriptFit | null {
  if (narrations.length < 2) return null;
  const sentences = narrations.map((n) => {
    const list = sentencesOf(n);
    return (list.length ? list : [n]).map((s) => wordsOf(s).reduce((a, w) => a + weightOf(w), 0) || 1);
  });
  const flat = sentences.flat();
  const S = flat.length;
  const runs = prepare(rawRuns, win.start, win.end);
  if (!runs.length) return null;
  const total = speechBefore(runs, win.end);
  if (total < 0.5) return null;
  const gaps = runs.slice(0, -1).map((r, i) => ({ tau: speechBefore(runs, r.end), pause: runs[i + 1]!.start - r.end, after: runs[i + 1]!.start, before: r.end })).filter((g) => g.pause >= 0.2);
  if (gaps.length < S - 1) return null;
  const sum = flat.reduce((a, b) => a + b, 0);
  const cum: number[] = [];
  let acc = 0;
  for (let j = 0; j < S; j++) cum.push((acc += flat[j]!) / sum);
  // Which sentence ends are scene ends.
  const sceneEnd = new Set<number>();
  let at = -1;
  for (let k = 0; k < sentences.length - 1; k++) sceneEnd.add((at += sentences[k]!.length));

  let best: { cost: number; pick: number[]; tail: boolean } | null = null;
  for (const share of [1, 0.95, 0.9, 0.85, 0.8, 0.75]) {
    // With less than all of the speech in the script, the end of the script is a pause too, and a closing line follows it.
    const B = share < 1 ? S : S - 1;
    if (gaps.length < B) continue;
    // `share` of the speech is the script; the rest is a closing line after it.
    const scale = (total * share) / S;
    const cost = (j: number, g: (typeof gaps)[number]) => Math.abs(g.tau - cum[j]! * total * share) / scale - 0.5 * Math.min(1, g.pause / 0.5);
    const dp: number[][] = [];
    const from: number[][] = [];
    for (let j = 0; j < B; j++) {
      dp.push(gaps.map(() => Infinity));
      from.push(gaps.map(() => -1));
      gaps.forEach((g, i) => {
        if (j === 0) {
          dp[0]![i] = cost(0, g);
          return;
        }
        let bv = Infinity;
        let bj = -1;
        for (let p = 0; p < i; p++) if (dp[j - 1]![p]! < bv) (bv = dp[j - 1]![p]!), (bj = p);
        if (bj >= 0) {
          dp[j]![i] = bv + cost(j, g);
          from[j]![i] = bj;
        }
      });
    }
    let bi = -1;
    let bv = Infinity;
    dp[B - 1]!.forEach((v, i) => {
      if (v < bv) (bv = v), (bi = i);
    });
    if (bi < 0 || (best && bv / B >= best.cost)) continue;
    const pick: number[] = [];
    for (let j = B - 1; j >= 0; j--) {
      pick[j] = bi;
      bi = from[j]![bi]!;
    }
    best = { cost: bv / B, pick, tail: share < 1 };
  }
  if (!best) return null;
  // Where every sentence ends: the pause that was picked for it.
  const endTimes = best.pick.map((i) => {
    const g = gaps[i]!;
    return Math.max(g.before, g.after - 0.12);
  });
  const cutTimes = [...sceneEnd].sort((a, b) => a - b).map((j) => endTimes[j]!);
  const cuts: number[] = [];
  cutTimes.forEach((t, k) => cuts.push(r2(Math.max(t, (cuts[k - 1] ?? win.start) + MIN_SCENE_SEC))));

  // Inside each sentence, commas are short pauses too: pin the clauses to them, so the words stay in step with the voice.
  const clauses: string[] = [];
  const edges: number[] = [win.start];
  const sentenceTexts = narrations.flatMap((n) => {
    const list = sentencesOf(n);
    return list.length ? list : [n];
  });
  sentenceTexts.forEach((text, j) => {
    const a = j === 0 ? win.start : endTimes[j - 1]!;
    const b = j === S - 1 && !best!.tail ? win.end : endTimes[j]!;
    const ws = wordsOf(text);
    const breaks = ws.map((w, i) => (i < ws.length - 1 && /[,;:،]$/.test(w) ? i : -1)).filter((i) => i >= 0);
    const inner = gaps.filter((g, gi) => g.before > a && g.after < b && !best!.pick.includes(gi));
    const chosen: number[] = [];
    if (breaks.length && inner.length >= breaks.length) {
      const weightsBefore = (i: number) => ws.slice(0, i + 1).reduce((acc, w) => acc + weightOf(w), 0);
      const sum2 = ws.reduce((acc, w) => acc + weightOf(w), 0) || 1;
      let from = a;
      for (const bi of breaks) {
        const target = a + ((b - a) * weightsBefore(bi)) / sum2;
        const pool = inner.filter((g) => g.after > from + 0.2 && Math.abs((g.before + g.after) / 2 - target) < (b - a) * 0.3);
        const near = pool.sort((x, y) => Math.abs((x.before + x.after) / 2 - target) - Math.abs((y.before + y.after) / 2 - target))[0];
        if (!near) {
          chosen.length = 0;
          break;
        }
        chosen.push(Math.max(near.before, near.after - 0.12));
        from = near.after;
      }
      if (chosen.length !== breaks.length) chosen.length = 0;
    }
    if (chosen.length) {
      let prev = 0;
      breaks.forEach((bi, k) => {
        clauses.push(ws.slice(prev, bi + 1).join(' '));
        edges.push(chosen[k]!);
        prev = bi + 1;
      });
      clauses.push(ws.slice(prev).join(' '));
    } else clauses.push(text);
    edges.push(b);
  });
  return { cuts, wordTimes: placeWords(clauses, runs, edges) };
}
