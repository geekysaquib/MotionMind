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
  upload: { track: AudioTrack; cuts: number[] } | null;
  /** Speed of the voice for the whole reel. 1 = as recorded. */
  pace: number;
  /** Extra speed for single scenes, multiplied with `pace`. Missing entries mean 1. */
  scenePace: number[];
  music: { track: AudioTrack; volume: number } | null;
  captions: CaptionStyle;
  updatedAt?: string;
}

export const DEFAULT_EDITOR: ReelEditor = {
  voiceSource: 'upload',
  upload: null,
  pace: 1,
  scenePace: [],
  music: null,
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
  voiceTrack?: { url: string; durationSec: number; cuts: number[] };
  music?: { url: string; durationSec: number; volume: number };
  captions?: CaptionStyle;
}

export function editorSpecParts(editor: ReelEditor | null | undefined, beatCount: number, urls: { voice?: string; music?: string }): EditorSpecParts {
  if (!editor) return {};
  const out: EditorSpecParts = {
    pace: clampPace(editor.pace),
    scenePace: Array.from({ length: beatCount }, (_, i) => clampPace(editor.scenePace[i] ?? 1)),
    captions: { ...DEFAULT_CAPTIONS, ...editor.captions },
  };
  if (usesUploadedVoice(editor, beatCount) && urls.voice) {
    out.voiceTrack = { url: urls.voice, durationSec: editor.upload!.track.durationSec, cuts: editor.upload!.cuts };
  }
  if (editor.music && urls.music) {
    out.music = { url: urls.music, durationSec: editor.music.track.durationSec, volume: Math.min(1, Math.max(0, editor.music.volume)) };
  }
  return out;
}

/**
 * Moves one scene break to `t` seconds, keeping every scene at least `min` long, and returns the new cuts.
 * Cut k is where scene k + 1 starts.
 */
export function moveCut(cuts: number[], k: number, t: number, durationSec: number, min = MIN_SCENE_SEC): number[] {
  if (k < 0 || k >= cuts.length) return cuts;
  const lo = (k > 0 ? cuts[k - 1]! : 0) + min;
  const hi = (k < cuts.length - 1 ? cuts[k + 1]! : durationSec) - min;
  if (hi < lo) return cuts;
  const next = Math.round(Math.min(hi, Math.max(lo, t)) * 100) / 100;
  return cuts.map((c, i) => (i === k ? next : c));
}

/** Start and end of every scene in the uploaded file, in seconds. */
export function sceneBounds(cuts: number[], durationSec: number): { start: number; end: number }[] {
  const edges = [0, ...cuts, durationSec];
  return edges.slice(0, -1).map((start, i) => ({ start, end: edges[i + 1]! }));
}
