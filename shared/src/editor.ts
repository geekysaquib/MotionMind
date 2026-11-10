// The voice step's saved state: the user's own recording of the narration, how it is cut into scenes and fitted to
// the script's words, and background music. Everything here is stored on the project (`editor`).

/** An audio file kept in storage for a project: the user's voiceover or the background music. */
export interface AudioTrack {
  /** Storage path, always under `<userId>/<projectId>/`. */
  path: string;
  fileName: string;
  mime: string;
  durationSec: number;
  /** Loudness every 1 / PEAKS_PER_SEC seconds, 0..99, for drawing the waveform and finding pauses. */
  peaks?: number[];
}

export const PEAKS_PER_SEC = 20;
/** A scene can't be shorter than this in the uploaded recording. */
export const MIN_SCENE_SEC = 0.3;
export const MAX_AUDIO_SEC = 300;

/** The user's recording of the whole narration, and how the script is fitted to it. */
export interface VoiceUpload {
  track: AudioTrack;
  /** Where each scene after the first starts in the recording, in seconds. One fewer than there are scenes. */
  cuts: number[];
  closingAt?: number | null;
  trimStart?: number | null;
  trimEnd?: number | null;
  /** Start and end of every word of the script's narration, in order, in seconds of the recording (set by the auto-fit). */
  wordTimes?: [number, number][];
  /** The script's words the fit was made for (`narrationKey`); when the narration changes, the fit is out of date. */
  fitKey?: string;
  /** The words heard in the recording (start and end in seconds), kept so the words can be re-fitted when a scene break is moved by hand. */
  speech?: [number, number][];
  /** How the fit was made: from the words heard in the recording, or from its loudness only. */
  fit?: 'speech' | 'loudness';
}

export interface ReelEditor {
  upload: VoiceUpload | null;
  music: { track: AudioTrack; volume: number } | null;
  updatedAt?: string;
}

export const DEFAULT_EDITOR: ReelEditor = { upload: null, music: null };

export const DEFAULT_MUSIC_VOLUME = 0.18;

/** Fills in anything a saved editor is missing, and drops fields of the old editor, so older projects open cleanly. */
export function normalizeEditor(raw: Partial<ReelEditor> | null | undefined): ReelEditor {
  if (!raw) return { ...DEFAULT_EDITOR };
  return { upload: raw.upload ?? null, music: raw.music ?? null, ...(raw.updatedAt ? { updatedAt: raw.updatedAt } : {}) };
}

/** True when a recording is saved and its cuts fit the script's scenes. */
export function usesUploadedVoice(editor: ReelEditor | null | undefined, beatCount: number): boolean {
  return Boolean(editor?.upload && editor.upload.cuts.length === beatCount - 1);
}

/**
 * Moves one scene break to `t` seconds, keeping every scene at least `min` long, and returns the new cuts.
 * Cut k is where scene k + 1 starts.
 */
export function moveCut(cuts: number[], k: number, t: number, durationSec: number, min = MIN_SCENE_SEC, startSec = 0): number[] {
  if (k < 0 || k >= cuts.length) return cuts;
  const lo = (k > 0 ? cuts[k - 1]! : startSec) + min;
  const hi = (k < cuts.length - 1 ? cuts[k + 1]! : durationSec) - min;
  if (hi < lo) return cuts;
  const next = Math.round(Math.min(hi, Math.max(lo, t)) * 100) / 100;
  return cuts.map((c, i) => (i === k ? next : c));
}

/** Where the "follow us" line can start: after the last scene has had at least MIN_SCENE_SEC, and with a moment left to say it. */
export function closingRange(cuts: number[], durationSec: number, startSec = 0): { lo: number; hi: number } {
  return { lo: (cuts.length ? cuts[cuts.length - 1]! : startSec) + MIN_SCENE_SEC, hi: durationSec - 0.4 };
}

/** Keeps a follow-line start inside the allowed range, rounded to 1/100 s. */
export function clampClosingAt(t: number, cuts: number[], durationSec: number, startSec = 0): number {
  const { lo, hi } = closingRange(cuts, durationSec, startSec);
  return Math.round(Math.min(Math.max(lo, hi), Math.max(lo, t)) * 100) / 100;
}

/** The follow-line start a recording usually has: where its last burst of speech begins (a pause of 0.5 s or more before it). */
export function defaultClosingAt(peaks: number[], durationSec: number, cuts: number[], peaksPerSec = PEAKS_PER_SEC, startSec = 0): number {
  const fallback = clampClosingAt(durationSec - 4, cuts, durationSec, startSec);
  if (!peaks.length) return fallback;
  const loud = Math.max(...peaks);
  const quiet = Math.max(6, loud * 0.12);
  let end = peaks.length - 1;
  while (end > 0 && peaks[end]! < quiet) end--;
  let start = end;
  let run = 0;
  const gap = Math.round(0.5 * peaksPerSec);
  for (let j = end; j >= 0; j--) {
    if (peaks[j]! >= quiet) {
      run = 0;
      start = j;
    } else if (++run >= gap) break;
  }
  const t = start / peaksPerSec;
  // A "last burst" longer than 8 s is the last scene itself, not a follow line.
  if (durationSec - t > 8 || t <= 0) return fallback;
  return clampClosingAt(t - 0.1, cuts, durationSec, startSec);
}

/** The part of the recording that is used: [start, end] in seconds, after trimming. */
export function trimWindow(up: { track: { durationSec: number }; trimStart?: number | null; trimEnd?: number | null }): { start: number; end: number } {
  const d = up.track.durationSec;
  const start = Math.min(Math.max(0, up.trimStart ?? 0), d);
  const end = Math.min(d, up.trimEnd ?? d);
  return end - start >= 1 ? { start, end } : { start: 0, end: d };
}

/** Earliest and latest the start of the recording can be trimmed to: before the first scene break (or follow line). */
export function clampTrimStart(t: number, cuts: number[], closingAt: number | null | undefined, endSec: number): number {
  const first = cuts.length ? cuts[0]! : closingAt ?? endSec - 1;
  const hi = Math.max(0, first - MIN_SCENE_SEC);
  return Math.round(Math.min(hi, Math.max(0, t)) * 100) / 100;
}

/** The end of the recording can be trimmed to anywhere after the last scene break (or after the follow line has begun). */
export function clampTrimEnd(t: number, cuts: number[], closingAt: number | null | undefined, startSec: number, durationSec: number): number {
  const lo = closingAt != null ? closingAt + 0.4 : cuts.length ? cuts[cuts.length - 1]! + MIN_SCENE_SEC : startSec + 1;
  return Math.round(Math.min(durationSec, Math.max(Math.min(lo, durationSec), t)) * 100) / 100;
}

/** Finds the quiet at the start and the end of a recording, keeping a short margin so nothing is clipped. */
export function detectTrim(peaks: number[], durationSec: number, cuts: number[], closingAt?: number | null, peaksPerSec = PEAKS_PER_SEC): { start: number; end: number } {
  if (!peaks.length) return { start: 0, end: durationSec };
  const loud = Math.max(...peaks);
  const quiet = Math.max(6, loud * 0.1);
  let a = 0;
  while (a < peaks.length - 1 && peaks[a]! < quiet) a++;
  let b = peaks.length - 1;
  while (b > a && peaks[b]! < quiet) b--;
  const margin = 0.15;
  const start = clampTrimStart(a / peaksPerSec - margin, cuts, closingAt, durationSec);
  const end = clampTrimEnd((b + 1) / peaksPerSec + margin, cuts, closingAt, start, durationSec);
  return { start, end };
}

/** Start and end of every scene in the uploaded file, in seconds. */
export function sceneBounds(cuts: number[], durationSec: number, startSec = 0): { start: number; end: number }[] {
  const edges = [startSec, ...cuts, durationSec];
  return edges.slice(0, -1).map((start, i) => ({ start, end: edges[i + 1]! }));
}
