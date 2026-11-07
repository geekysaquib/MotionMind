import sample from './sample.json';

// The reel format the engine renders. Each beat is one narration line with an on-screen card; the chosen
// style decides how the card's headline, chips, flows and numbers are drawn. Durations come from real
// voice timings when there are any, and are estimated from the word count otherwise.

export const FPS = 30;
const WORDS_PER_SEC = 2.7;
const BEAT_PAD_SEC = 0.6;

/** The looks a reel can be drawn in (same list as STYLE_IDS in the shared package; a test keeps them equal). */
export const STYLE_IDS = ['live-map', 'whiteboard', 'dark-keynote', 'transit-map', 'newsroom'] as const;
export type StyleId = (typeof STYLE_IDS)[number];
export const DEFAULT_STYLE: StyleId = 'live-map';
export const styleOf = (id: string | undefined | null): StyleId => ((STYLE_IDS as readonly string[]).includes(id ?? '') ? (id as StyleId) : DEFAULT_STYLE);

/** 0 = intro, then 1..steps.length for the progress steps in the header. */
export type Chapter = number;

export type CardRow =
  | { kind: 'chips'; items: { text: string; tone?: Tone; strike?: boolean }[] }
  | { kind: 'flow'; items: string[] }
  | { kind: 'kv'; k: string; v: string; tone?: Tone }
  | { kind: 'note'; text: string };

export type Tone = 'red' | 'teal' | 'purple' | 'blue' | 'amber';

export interface Card {
  eyebrow: string;
  /** Words wrapped in *asterisks* are highlighted. */
  headline: string;
  tone: Tone;
  rows?: CardRow[];
}

export interface Beat {
  id: string;
  narration: string;
  /** Lower-case words to colour in captions. */
  keywords: string[];
  card: Card;
  chapter: Chapter;
  /** The scene's picture as Claude designed it for the topic. Without it the style draws the card's first row. */
  visual?: SceneVisual;
}

/**
 * The building blocks Claude composes a scene from. Every style draws each kind in its own look
 * (hand-drawn on the whiteboard, dark UI panels on the keynote stage, and so on).
 */
export const ELEMENT_KINDS = ['card', 'phone', 'window', 'code', 'number', 'list', 'bars', 'ring', 'queue', 'stamp', 'logo', 'text'] as const;
export type ElementKind = (typeof ELEMENT_KINDS)[number];

export interface VisualElement {
  id: string;
  kind: ElementKind;
  /** Main text: a card's name, a number's label, a window's title, a stamp's word. Words in *stars* are highlighted. */
  label?: string;
  /** Second line under the label. */
  sub?: string;
  /** A Lucide icon name (kebab-case, like 'server', 'train-front', 'shield-check'). */
  icon?: string;
  /** A company's website, to show its logo. */
  logo?: string;
  /** number: the value with its unit ('4 sec', '1.2 lakh'); ring: a percentage ('80%'); stamp: optional. */
  value?: string;
  /** list (ok = tick, false = cross), bars (value = length), queue (tokens), code / phone / window (lines). */
  items?: { text: string; value?: number; ok?: boolean }[];
  /** Centre of the element as a percentage of the scene area (0 = left / top, 100 = right / bottom). */
  x?: number;
  y?: number;
  /** Width as a percentage of the scene area. */
  w?: number;
  tone?: Tone;
  /** Appears when the narration says this word. */
  on?: string;
  /** Or this many seconds into the scene. */
  at?: number;
  /** The element the scene is about: drawn larger, with the accent. */
  focus?: boolean;
}

export interface SceneVisual {
  elements: VisualElement[];
  /** Arrows between elements (by id); a packet travels along each. */
  links?: { from: string; to: string; label?: string; on?: string; dashed?: boolean }[];
  /** Live Map only: draw the scene over the city map (for topics about places, rides, deliveries). */
  map?: boolean;
}

export interface Brand {
  name: string;
  /** Two letters for the round badge. */
  initials: string;
  handle: string;
  tagline: string;
}

export interface VoiceBeat {
  durationSec: number;
  words: { start: number; end: number }[];
}

/** Everything needed to render one reel. Passed to the Reel composition as props. */
// A type alias (not an interface) so Remotion accepts it as composition props.
export type ReelSpec = {
  title: string;
  /** The look the whole reel is drawn in. Missing = the default style. */
  style?: StyleId;
  /** Short forms and what they stand for: a scene that uses one shows its full form. */
  glossary?: { short: string; full: string }[];
  /** Companies named in the reel, so their logos can be shown. */
  brands?: { name: string; domain: string }[];
  /** Where the logo images come from (the API's origin, or empty for the same origin). Logos are `<base>/api/logo/<domain>`. */
  logoBase?: string;
  /** Where the reel is going. Shorts keeps clear of its taller top bar and bottom caption area, and the end card asks to subscribe. Default: instagram. */
  platform?: 'instagram' | 'youtube';
  /** Names of the progress steps shown in the header (chapters 1..n). */
  steps: string[];
  brand: Brand;
  beats: Beat[];
  /** Per-beat voice timings; audio files are expected at voice/beat_<i>.mp3 unless audioUrls is given. */
  voice?: VoiceBeat[];
  /** Where each beat's voiceover MP3 is (the web app passes signed URLs). */
  audioUrls?: string[];
  /** One recording for the whole reel. `cuts[i]` = where scene i + 1 starts (seconds). `closingAt` = where its follow line starts. */
  voiceTrack?: { url: string; durationSec: number; cuts: number[]; closingAt?: number; trimStart?: number; trimEnd?: number; peaks?: number[] };
  /** Speed of the voice for the whole reel (1 = as recorded). */
  pace?: number;
  /** Extra speed per scene, multiplied with `pace`. */
  scenePace?: number[];
  /** Background music, looped under the whole reel. */
  music?: { url: string; durationSec: number; volume: number };
  /** Sound effects: each plays once, starting `at` seconds into the reel. */
  sfx?: { url: string; durationSec: number; at: number; volume: number }[];
  /** The built-in sound design (a whoosh per scene, pops, ticks and thuds as pieces appear). On unless false. */
  soundDesign?: boolean;
  captions?: CaptionStyle;
};

/** Same shape as CaptionStyle in the shared package (the engine doesn't import it). Each style draws captions its own way; size and position apply to all. */
export type CaptionStyle = { size: 'small' | 'medium' | 'large'; position: 'bottom' | 'middle'; look: 'box' | 'plain' };

export const DEFAULT_CAPTION_STYLE: CaptionStyle = { size: 'medium', position: 'bottom', look: 'box' };

/** Voice speed limits the audio player and the video renderer both handle well. */
export const RATE_MIN = 0.5;
export const RATE_MAX = 2;

/** Playback speed of every scene: the reel's pace times the scene's own speed. */
export function sceneRates(spec: Pick<ReelSpec, 'beats' | 'pace' | 'scenePace'>): number[] {
  const pace = Number.isFinite(spec.pace) && spec.pace! > 0 ? spec.pace! : 1;
  return spec.beats.map((_, i) => {
    const own = spec.scenePace?.[i];
    const r = pace * (Number.isFinite(own) && own! > 0 ? own! : 1);
    return Math.min(RATE_MAX, Math.max(RATE_MIN, r));
  });
}

export const END_CARD_FRAMES = 3 * FPS;

export interface TimedBeat extends Beat {
  start: number;
  frames: number;
  words: { text: string; start: number; end: number }[];
  /** The voice for this scene: where it starts on the reel, how long it plays, and which part of the recording. */
  audio?: {
    /** Frame of the reel where it starts playing. */
    from: number;
    frames: number;
    /** Where in the audio file (seconds) this scene's voice starts. */
    srcStartSec: number;
    /** Playback speed (1 = as recorded). */
    rate: number;
    /** 'beat' = this scene has its own file; 'track' = one recording for the whole reel. */
    source: 'beat' | 'track';
  };
}

export function hasVoice(spec: Pick<ReelSpec, 'beats' | 'voice'>): boolean {
  return (spec.voice?.length ?? 0) === spec.beats.length && spec.beats.length > 0;
}

export interface TimingOptions {
  /** Playback speed per scene (1 = as recorded). Missing entries mean 1. */
  rates?: number[];
  /** One recording for the whole reel, cut into scenes. */
  track?: { durationSec: number; cuts: number[]; closingAt?: number; trimStart?: number; trimEnd?: number; peaks?: number[] };
}

const MIN_SCENE_FRAMES = Math.round(0.3 * FPS);
const PEAKS_PER_SEC = 20;

/**
 * Where each caption word falls, using the loudness of the recording: the words are spread over the time the
 * speaker is actually talking, so a pause or silence at the start or end of a scene no longer drags the captions
 * away from the voice. Returns null when there is no usable loudness (then the words are spread evenly).
 * `srcStart`/`srcEnd` are seconds in the recording; the result is in frames from `cursor`, at playback speed `rate`.
 */
export function wordsFromPeaks(words: string[], peaks: number[] | undefined, srcStart: number, srcEnd: number, rate: number, cursor: number): TimedBeat['words'] | null {
  if (!peaks || peaks.length < 4 || !words.length || srcEnd <= srcStart) return null;
  const a = Math.max(0, Math.floor(srcStart * PEAKS_PER_SEC));
  const b = Math.min(peaks.length, Math.ceil(srcEnd * PEAKS_PER_SEC));
  if (b - a < 3) return null;
  const slice = peaks.slice(a, b);
  const loud = Math.max(...slice);
  if (loud < 8) return null;
  const thr = Math.max(6, loud * 0.14);
  // Voiced bins, with short dips (a breath, a hard consonant) bridged so one sentence stays one stretch.
  const voiced = slice.map((v) => v >= thr);
  const bridge = Math.round(0.25 * PEAKS_PER_SEC);
  let last = -1;
  for (let i = 0; i < voiced.length; i++) {
    if (voiced[i]) {
      if (last >= 0 && i - last > 1 && i - last <= bridge) for (let j = last + 1; j < i; j++) voiced[j] = true;
      last = i;
    }
  }
  const total = voiced.filter(Boolean).length;
  if (total < Math.min(words.length, 4)) return null;
  // Cumulative voiced time: position p (0..total) -> the bin where that much speech has been heard.
  const binAt = (p: number, isStart: boolean) => {
    let acc = 0;
    for (let i = 0; i < voiced.length; i++) {
      if (!voiced[i]) continue;
      // A word that begins exactly where speech ran out waits for the next stretch of speech.
      if (isStart ? acc + 1 > p : acc + 1 >= p) return i + (p - acc);
      acc += 1;
    }
    return voiced.length;
  };
  const weights = words.map((w) => Math.max(2, w.length) + (/[.?!]$/.test(w) ? 3 : /[,;:]$/.test(w) ? 1 : 0));
  const sum = weights.reduce((x, y) => x + y, 0) || 1;
  const frameOf = (bin: number) => cursor + Math.round(((a + bin) / PEAKS_PER_SEC - srcStart) / rate * FPS);
  let acc = 0;
  return words.map((text, k) => {
    const start = frameOf(binAt((acc / sum) * total, true));
    acc += weights[k]!;
    return { text, start, end: frameOf(binAt((acc / sum) * total, false)) };
  });
}

/** Spreads words over a stretch of frames in proportion to how long each takes to say. */
function spreadWords(words: string[], from: number, to: number): TimedBeat['words'] {
  const weights = words.map((w) => Math.max(2, w.length) + (/[.?!]$/.test(w) ? 5 : /[,;:]$/.test(w) ? 2 : 0));
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  const span = Math.max(0, to - from);
  let acc = 0;
  return words.map((text, k) => {
    const start = from + Math.round((acc / total) * span);
    acc += weights[k]!;
    return { text, start, end: from + Math.round((acc / total) * span) };
  });
}

/** The part of the recording that plays, after trimming the quiet at either end. */
export function windowOf(track: { durationSec: number; trimStart?: number; trimEnd?: number }): { start: number; end: number } {
  const start = Math.min(Math.max(0, track.trimStart ?? 0), track.durationSec);
  const end = Math.min(track.durationSec, track.trimEnd ?? track.durationSec);
  return end - start >= 1 ? { start, end } : { start: 0, end: track.durationSec };
}

/** Where the follow line starts in a recording, when that is a usable point (after the last break, before the end). */
export function closingOf(track: { durationSec: number; cuts: number[]; closingAt?: number; trimStart?: number; trimEnd?: number } | undefined | null): number | null {
  if (!track || track.closingAt == null) return null;
  const w = windowOf(track);
  const last = track.cuts.length ? track.cuts[track.cuts.length - 1]! : w.start;
  return track.closingAt >= last + 0.3 - 1e-6 && track.closingAt <= w.end - 0.4 + 1e-6 ? track.closingAt : null;
}

export function timeBeats(beats: Beat[], voiceBeats: VoiceBeat[] = [], opts: TimingOptions = {}): TimedBeat[] {
  const track = opts.track && opts.track.durationSec > 0 && opts.track.cuts.length === beats.length - 1 ? opts.track : null;
  const useVoice = !track && voiceBeats.length === beats.length;
  const win = track ? windowOf(track) : { start: 0, end: 0 };
  const edges = track ? [win.start, ...track.cuts, closingOf(track) ?? win.end] : [];
  let cursor = 0;
  return beats.map((beat, idx) => {
    const rate = Math.min(RATE_MAX, Math.max(RATE_MIN, opts.rates?.[idx] ?? 1));
    const lead = Math.round((0.2 * FPS) / rate);
    const words = beat.narration.split(/\s+/).filter(Boolean);
    const v = useVoice ? voiceBeats[idx] : undefined;
    let frames: number;
    let timedWords: TimedBeat['words'];
    let audio: TimedBeat['audio'];
    if (track) {
      // The user's own recording: this scene plays the part of the file between its two breaks.
      const srcStart = edges[idx]!;
      const srcEnd = edges[idx + 1]!;
      frames = Math.max(MIN_SCENE_FRAMES, Math.round(((srcEnd - srcStart) / rate) * FPS));
      const edge = Math.min(6, Math.round(frames * 0.05));
      timedWords = wordsFromPeaks(words, track.peaks, srcStart, srcEnd, rate, cursor) ?? spreadWords(words, cursor + edge, cursor + frames - Math.min(8, Math.round(frames * 0.1)));
      audio = { from: cursor, frames, srcStartSec: srcStart, rate, source: 'track' };
    } else if (v && v.words.length) {
      // Real TTS timings. Caption words (Hinglish) are mapped onto spoken words (Devanagari) by position.
      frames = Math.round((v.durationSec / rate) * FPS) + lead + Math.round((0.25 * FPS) / rate);
      const m = v.words.length;
      timedWords = words.map((text, j) => {
        const a = v.words[Math.min(m - 1, Math.floor((j * m) / words.length))]!;
        const b = v.words[Math.min(m - 1, Math.floor(((j + 1) * m) / words.length) - 1)] ?? a;
        return { text, start: cursor + lead + Math.round((a.start / rate) * FPS), end: cursor + lead + Math.round((Math.max(a.end, b.end) / rate) * FPS) };
      });
      audio = { from: cursor + lead, frames: frames - lead, srcStartSec: 0, rate, source: 'beat' };
    } else {
      const speechFrames = Math.round((words.length / WORDS_PER_SEC / rate) * FPS);
      frames = speechFrames + Math.round((BEAT_PAD_SEC * FPS) / rate);
      const perWord = speechFrames / words.length;
      timedWords = words.map((text, i) => ({
        text,
        start: cursor + lead + Math.round(i * perWord),
        end: cursor + lead + Math.round((i + 1) * perWord),
      }));
      if (v) audio = { from: cursor + lead, frames: Math.max(1, frames - lead), srcStartSec: 0, rate, source: 'beat' };
    }
    const timed: TimedBeat = { ...beat, start: cursor, frames, words: timedWords, ...(audio ? { audio } : {}) };
    cursor += frames;
    return timed;
  });
}

/** Frame layout of a reel: the timed beats, then a 3-second end card. */
export function reelTiming(spec: Pick<ReelSpec, 'beats' | 'voice' | 'pace' | 'scenePace' | 'voiceTrack'>) {
  const track = spec.voiceTrack ? { durationSec: spec.voiceTrack.durationSec, cuts: spec.voiceTrack.cuts, closingAt: spec.voiceTrack.closingAt, trimStart: spec.voiceTrack.trimStart, trimEnd: spec.voiceTrack.trimEnd, peaks: spec.voiceTrack.peaks } : undefined;
  const timed = timeBeats(spec.beats, hasVoice(spec) && !track ? spec.voice : [], { rates: sceneRates(spec), track });
  const storyFrames = timed.reduce((n, b) => n + b.frames, 0);
  // With a follow line in the recording, the end card appears as the line starts and stays until it has been said.
  const usable = track && track.durationSec > 0 && track.cuts.length === spec.beats.length - 1;
  const at = usable ? closingOf(track) : null;
  const pace = Number.isFinite(spec.pace) && spec.pace! > 0 ? Math.min(RATE_MAX, Math.max(RATE_MIN, spec.pace!)) : 1;
  const endFrames = at != null ? Math.max(END_CARD_FRAMES, Math.round(((windowOf(track!).end - at) / pace) * FPS) + Math.round(0.5 * FPS)) : END_CARD_FRAMES;
  return { timed, storyFrames, endFrames, totalFrames: storyFrames + endFrames, closing: at != null ? { srcStartSec: at, rate: pace } : null };
}


export const DEFAULT_BRAND: Brand = { name: 'Reel Studio', initials: 'RS', handle: '@yourchannel', tagline: 'Roz ki tech, andar ki baat' };

/** The sample reel (IRCTC Tatkal, scenes designed the way Claude is asked to), for the CLI render, the studio and the Style page. */
export const SAMPLE_REEL: ReelSpec = { ...(sample as unknown as Omit<ReelSpec, 'brand' | 'style'>), style: 'live-map', brand: DEFAULT_BRAND };
