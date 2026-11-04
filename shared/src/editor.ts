// The Reel editor's saved state: the user's own voiceover and how it is cut into scenes, the pace of
// the voice, background music and caption style. Everything here is stored on the project (`editor`).

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
/** Slowest and fastest voice speed (1 = as recorded). Scene speed is multiplied with the reel's pace. */
export const PACE_MIN = 0.7;
export const PACE_MAX = 1.5;
/** A scene can't be shorter than this in the uploaded recording. */
export const MIN_SCENE_SEC = 0.3;
export const MAX_AUDIO_SEC = 300;
/** Sound effects: how many a reel can have, how long each can be, and how loud they start. */
export const MAX_SFX = 12;
export const MAX_SFX_SEC = 30;
export const DEFAULT_SFX_VOLUME = 0.8;

/** A short sound (a whoosh, a pop, a ding) placed at a moment of the reel. */
export interface SfxClip {
  track: AudioTrack;
  /** Seconds from the start of the reel. */
  at: number;
  volume: number;
}

export type CaptionSize = 'small' | 'medium' | 'large';
export type CaptionPosition = 'bottom' | 'middle';
export type CaptionLook = 'box' | 'plain';

/** Same shape as the reel engine's CaptionStyle (the engine doesn't import this package). */
export interface CaptionStyle {
  size: CaptionSize;
  position: CaptionPosition;
  look: CaptionLook;
}

export const DEFAULT_CAPTIONS: CaptionStyle = { size: 'medium', position: 'bottom', look: 'box' };

export interface ReelEditor {
  /** Which voice plays: the user's own upload or the ElevenLabs voiceover. */
  voiceSource: 'upload' | 'elevenlabs';
  /**
   * The uploaded voiceover (one file for the whole reel) and where each scene after the first starts in it, in
   * seconds. There is one cut fewer than there are scenes.
   */
  upload: { track: AudioTrack; cuts: number[]; closingAt?: number | null; trimStart?: number | null; trimEnd?: number | null } | null;
  /** Speed of the voice for the whole reel. 1 = as recorded. */
  pace: number;
  /** Extra speed for single scenes, multiplied with `pace`. Missing entries mean 1. */
  scenePace: number[];
  music: { track: AudioTrack; volume: number } | null;
  /** Sound effects placed on the reel's timeline. Missing means none. */
  sfx?: SfxClip[];
  captions: CaptionStyle;
  updatedAt?: string;
}

export const DEFAULT_EDITOR: ReelEditor = {
  voiceSource: 'upload',
  upload: null,
  pace: 1,
  scenePace: [],
  music: null,
  sfx: [],
  captions: DEFAULT_CAPTIONS,
};

export const DEFAULT_MUSIC_VOLUME = 0.18;

export function clampPace(n: unknown): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : 1;
  return Math.round(Math.min(PACE_MAX, Math.max(PACE_MIN, v)) * 100) / 100;
}

/** Fills in anything a saved editor is missing, so older or empty projects open cleanly. */
export function normalizeEditor(raw: Partial<ReelEditor> | null | undefined, hasElevenLabsVoice = false): ReelEditor {
  const base: ReelEditor = { ...DEFAULT_EDITOR, voiceSource: hasElevenLabsVoice ? 'elevenlabs' : 'upload' };
  if (!raw) return base;
  return {
    ...base,
    ...raw,
    pace: clampPace(raw.pace ?? 1),
    scenePace: (raw.scenePace ?? []).map(clampPace),
    sfx: (raw.sfx ?? []).slice(0, MAX_SFX),
    captions: { ...DEFAULT_CAPTIONS, ...raw.captions },
  };
}

/** True when the uploaded voice is chosen and its cuts fit the script's scenes. */
export function usesUploadedVoice(editor: ReelEditor | null | undefined, beatCount: number): boolean {
  return Boolean(editor && editor.voiceSource === 'upload' && editor.upload && editor.upload.cuts.length === beatCount - 1);
}

/** Pieces of the reel engine's ReelSpec that come from the editor, with playback URLs filled in. */
export interface EditorSpecParts {
  pace?: number;
  scenePace?: number[];
  voiceTrack?: { url: string; durationSec: number; cuts: number[]; closingAt?: number; trimStart?: number; trimEnd?: number };
  music?: { url: string; durationSec: number; volume: number };
  sfx?: { url: string; durationSec: number; at: number; volume: number }[];
  captions?: CaptionStyle;
}

export function editorSpecParts(editor: ReelEditor | null | undefined, beatCount: number, urls: { voice?: string; music?: string; sfx?: Record<string, string> }): EditorSpecParts {
  if (!editor) return {};
  const out: EditorSpecParts = {
    pace: clampPace(editor.pace),
    scenePace: Array.from({ length: beatCount }, (_, i) => clampPace(editor.scenePace[i] ?? 1)),
    captions: { ...DEFAULT_CAPTIONS, ...editor.captions },
  };
  if (usesUploadedVoice(editor, beatCount) && urls.voice) {
    const up = editor.upload!;
    out.voiceTrack = { url: urls.voice, durationSec: up.track.durationSec, cuts: up.cuts };
    const w = trimWindow(up);
    if (w.start > 0.01) out.voiceTrack.trimStart = w.start;
    if (w.end < up.track.durationSec - 0.01) out.voiceTrack.trimEnd = w.end;
    const r = closingRange(up.cuts, w.end, w.start);
    if (up.closingAt != null && up.closingAt >= r.lo && up.closingAt <= r.hi) out.voiceTrack.closingAt = up.closingAt;
  }
  if (editor.music && urls.music) {
    out.music = { url: urls.music, durationSec: editor.music.track.durationSec, volume: Math.min(1, Math.max(0, editor.music.volume)) };
  }
  const clips = (editor.sfx ?? []).flatMap((c) => {
    const url = urls.sfx?.[c.track.path];
    return url ? [{ url, durationSec: c.track.durationSec, at: Math.max(0, c.at), volume: Math.min(1, Math.max(0, c.volume)) }] : [];
  });
  if (clips.length) out.sfx = clips;
  return out;
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
