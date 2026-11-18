/**
 * Raw footage editing: the user uploads a clip they filmed, the API finds the pauses (FFmpeg) and the words
 * (whisper.cpp), the user reviews the cut as a storyboard, and the API exports a 1080x1920 reel with captions.
 * Everything here is pure, so the web app and the API cut and caption the same way.
 */

/** A stretch of the source clip, in seconds. */
export interface TimeRange {
  start: number;
  end: number;
}

/** One stretch of speech between pauses. The user can drop any of them on the storyboard. */
export interface FootageSegment extends TimeRange {
  keep: boolean;
}

/** One spoken word, in seconds of the source clip. */
export interface FootageWord extends TimeRange {
  text: string;
}

export interface FootageSettings {
  /** Pauses at least this long are cut out (the starter kit's rule is 0.1 s). */
  minPause: number;
  /** Quieter than this counts as silence, in dB. */
  noiseDb: number;
  /** Speech kept on each side of a cut, so words don't lose their first and last sounds. */
  padSec: number;
  captions: boolean;
  captionPosition: 'lower' | 'middle';
}

export const DEFAULT_FOOTAGE_SETTINGS: FootageSettings = { minPause: 0.1, noiseDb: -35, padSec: 0.05, captions: true, captionPosition: 'lower' };

export const FOOTAGE_LIMITS = {
  minPause: [0.1, 2],
  noiseDb: [-60, -15],
  padSec: [0, 0.3],
  /** Largest clip the API takes. */
  maxBytes: 1024 * 1024 * 1024,
  maxSec: 20 * 60,
} as const;

export interface FootageSource {
  /** File name inside the edit's folder. */
  file: string;
  durationSec: number;
  /** As displayed, after the phone's rotation. */
  width: number;
  height: number;
  hasAudio: boolean;
}

export interface FootageJob {
  kind: 'analyze' | 'export';
  status: 'running' | 'done' | 'failed';
  /** 0 to 1. */
  progress: number;
  /** What is happening, as a plain sentence. */
  step: string;
  error?: string;
  startedAt: string;
  finishedAt?: string;
}

export interface FootageEdit {
  id: string;
  ownerId: string;
  name: string;
  fileName: string;
  createdAt: string;
  updatedAt: string;
  source: FootageSource | null;
  settings: FootageSettings;
  /** The silences FFmpeg found, so the cut can be redone with other settings without running it again. */
  silences: TimeRange[] | null;
  segments: FootageSegment[];
  /** Null when there is no transcript (whisper.cpp isn't set up, or the clip has no sound). */
  words: FootageWord[] | null;
  /** Why there are no words, as a plain sentence. */
  transcriptNote: string | null;
  /** Set when the user approves the storyboard. Any change to the cut clears it. */
  approvedAt: string | null;
  job: FootageJob | null;
  output: { file: string; durationSec: number; createdAt: string } | null;
}

const round = (n: number) => Math.round(n * 1000) / 1000;

/**
 * The stretches of speech left after cutting every pause of at least `minPause`.
 * Each cut keeps `padSec` of the pause on both sides; pauses too short to cut stay in.
 */
export function speechSegments(silences: TimeRange[], durationSec: number, opts: Pick<FootageSettings, 'minPause' | 'padSec'>): FootageSegment[] {
  const cuts = silences
    .map((s) => ({ start: Math.max(0, s.start), end: Math.min(durationSec, s.end) }))
    .filter((s) => s.end - s.start >= opts.minPause)
    .sort((a, b) => a.start - b.start)
    .map((s) => ({
      // Pauses at the very start or end are cut fully, apart from the pad next to the speech.
      start: s.start <= 0 ? 0 : s.start + opts.padSec,
      end: s.end >= durationSec ? durationSec : s.end - opts.padSec,
    }))
    .filter((s) => s.end - s.start > 0.01);
  const out: FootageSegment[] = [];
  let at = 0;
  for (const c of cuts) {
    if (c.start > at + 0.01) out.push({ start: round(at), end: round(c.start), keep: true });
    at = Math.max(at, c.end);
  }
  if (durationSec > at + 0.01) out.push({ start: round(at), end: round(durationSec), keep: true });
  return out;
}

/** Applies the user's earlier keep/drop choices to a new cut: a new segment is dropped when most of it was dropped before. */
export function carryChoices(next: FootageSegment[], previous: FootageSegment[]): FootageSegment[] {
  const dropped = previous.filter((s) => !s.keep);
  if (!dropped.length) return next;
  return next.map((s) => {
    const overlap = dropped.reduce((sum, d) => sum + Math.max(0, Math.min(s.end, d.end) - Math.max(s.start, d.start)), 0);
    return { ...s, keep: overlap < (s.end - s.start) / 2 };
  });
}

/** The kept stretches, merged where they touch. */
export function keptRanges(segments: FootageSegment[]): TimeRange[] {
  const out: TimeRange[] = [];
  for (const s of [...segments].filter((x) => x.keep).sort((a, b) => a.start - b.start)) {
    const last = out[out.length - 1];
    if (last && s.start <= last.end + 0.001) last.end = Math.max(last.end, s.end);
    else out.push({ start: s.start, end: s.end });
  }
  return out;
}

export function rangesDuration(ranges: TimeRange[]): number {
  return round(ranges.reduce((sum, r) => sum + (r.end - r.start), 0));
}

/** Where a moment of the source lands in the cut video; null when it was cut out. */
export function toOutputTime(t: number, kept: TimeRange[]): number | null {
  let before = 0;
  for (const r of kept) {
    if (t < r.start) return null;
    if (t <= r.end) return round(before + t - r.start);
    before += r.end - r.start;
  }
  return null;
}

/**
 * The words still heard after the cut, in seconds of the cut video. Word timings from speech recognition are
 * rough, so a word counts when any noticeable part of it (30 ms) survived, and it starts where that part starts.
 */
export function wordsAfterCut(words: FootageWord[], kept: TimeRange[]): FootageWord[] {
  const out: FootageWord[] = [];
  for (const w of words) {
    const parts = kept.map((r) => ({ start: Math.max(r.start, w.start), end: Math.min(r.end, w.end) })).filter((p) => p.end - p.start > 0);
    const heard = parts.reduce((sum, p) => sum + (p.end - p.start), 0);
    if (heard < Math.min(0.03, (w.end - w.start) / 2)) continue;
    const start = toOutputTime(parts[0]!.start, kept)!;
    const prev = out[out.length - 1];
    const from = Math.max(start, prev ? prev.start + 0.05 : 0);
    out.push({ text: w.text, start: round(from), end: round(Math.max(from + 0.05, from + Math.min(heard, 2))) });
  }
  return out;
}

/** The words spoken in one stretch of the source (for the storyboard). */
export function wordsIn(words: FootageWord[] | null, range: TimeRange): string {
  if (!words) return '';
  return words
    .filter((w) => (w.start + w.end) / 2 >= range.start && (w.start + w.end) / 2 < range.end)
    .map((w) => w.text)
    .join(' ');
}

/** Captions shown a few words at a time: a new line starts after `maxWords` words, a sentence end or a gap. */
export function captionLines(words: FootageWord[], maxWords = 3, gapSec = 0.6): FootageWord[][] {
  const lines: FootageWord[][] = [];
  let line: FootageWord[] = [];
  for (const w of words) {
    const prev = line[line.length - 1];
    if (line.length && (line.length >= maxWords || w.start - prev!.end > gapSec || /[.!?।]$/.test(prev!.text))) {
      lines.push(line);
      line = [];
    }
    line.push(w);
  }
  if (line.length) lines.push(line);
  return lines;
}
