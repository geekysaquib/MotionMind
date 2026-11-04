// Reel format the engine renders, plus the "Where is my Train" sample reel.
// Each beat is one narration line with an on-screen card. Durations come from real TTS word
// timings when a voice track exists, and are estimated from word count otherwise.

import voice from './voice.json';

export const FPS = 30;
const WORDS_PER_SEC = 2.7;
const BEAT_PAD_SEC = 0.6;

/** 0 = intro, then 1..steps.length for the progress steps in the header. */
export type Chapter = number;

export type CardRow =
  | { kind: 'chips'; items: { text: string; tone?: Tone; strike?: boolean }[] }
  | { kind: 'flow'; items: string[] }
  | { kind: 'kv'; k: string; v: string; tone?: Tone }
  | { kind: 'file'; name: string; size: string; note: string }
  | { kind: 'timetable'; rows: { stop: string; time: string; state: 'done' | 'here' | 'next' }[] }
  | { kind: 'note'; text: string };

export type Tone = 'red' | 'teal' | 'purple' | 'blue' | 'amber';

export interface Card {
  eyebrow: string;
  /** Words wrapped in *asterisks* are highlighted. */
  headline: string;
  tone: Tone;
  rows?: CardRow[];
}

export interface CameraKey {
  /** When true, x tracks the rider's phone on the moving train. */
  follow?: boolean;
  x: number;
  y: number;
  z: number;
  zoom: number;
}

export type WorldEvent =
  | 'rings'
  | 'towerIds'
  | 'pins'
  | 'gpsLog'
  | 'stationGlow'
  | 'errorBand'
  | 'none';

/** Objects the 3D isometric scene kit can draw ('iso' world). */
export const PROP_KINDS = ['phone', 'laptop', 'tower', 'server', 'cloud', 'bank', 'shop', 'building', 'house', 'factory', 'person', 'document', 'money', 'chip', 'car', 'satellite', 'qr', 'speaker', 'lock', 'database', 'router', 'battery', 'heart', 'gear', 'truck', 'plane', 'train', 'tree', 'hospital', 'school', 'cart', 'camera', 'bulb', 'globe', 'envelope', 'clock', 'rocket', 'syringe', 'chart', 'atm', 'custom'] as const;
export type PropKind = (typeof PROP_KINDS)[number];

/** Body of a 'custom' object (anything the 16 named kinds can't draw): a block, a tall tower, a wide slab, a flat pad or a ball. */
export const PROP_SHAPES = ['block', 'tall', 'wide', 'flat', 'round'] as const;
export type PropShape = (typeof PROP_SHAPES)[number];

/** The look of the 3D world around the props. */
export const WORLD_THEMES = ['city', 'nature', 'lab', 'plain', 'night', 'sunset', 'ocean', 'desert'] as const;
export type WorldTheme = (typeof WORLD_THEMES)[number];

export interface ScenePropSpec {
  id: string;
  kind: PropKind;
  label?: string;
  /** One emoji floated above the object. For 'custom' objects it is what makes them recognisable. */
  icon?: string;
  /** 'custom' only: the name of a Lucide icon (e.g. 'microscope', 'wheat'), drawn as a raised 3D tile. Beats `icon` and `shape`. */
  glyph?: string;
  /** 'custom' only: the body shape. */
  shape?: PropShape;
  /** Colour of a 'custom' body. Defaults to the scene's tone. */
  tone?: Tone;
}

/**
 * One scene in the 3D isometric world. Props with the same id are the same object in every scene,
 * so the camera travels around one persistent world; a prop appears the first time a scene uses it.
 */
export interface IsoScene {
  props: ScenePropSpec[];
  /** Animated signal lines between props, drawn as arcs with a travelling packet. */
  links?: { from: string; to: string; label?: string }[];
  /** rings = signal waves from the focus prop; pulse = it glows; none. */
  effect?: 'rings' | 'pulse' | 'none';
  /** The prop the camera and effect centre on. Defaults to the first prop. */
  focus?: string;
}

/** Train world only: a named camera shot instead of raw coordinates. */
export const TRAIN_SHOTS = ['phone', 'tower', 'map', 'crowd', 'station', 'accuracy', 'wide'] as const;
export type TrainShot = (typeof TRAIN_SHOTS)[number];

export interface Beat {
  id: string;
  narration: string;
  /** Lower-case words to colour in captions. */
  keywords: string[];
  card: Card;
  chapter: Chapter;
  /** Train world only: where the camera looks during this beat. */
  camera?: CameraKey;
  /** Train world only: effects shown in the scene. */
  events?: WorldEvent[];
  /** Train world only: a named shot, turned into a camera key when `camera` is not given. */
  shot?: TrainShot;
  /** Iso world only: what this scene shows. */
  scene?: IsoScene;
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
  /** 'train' = the isometric railway world; 'iso' = the 3D isometric scene kit for any topic; 'cards' = flat animated graphics. */
  world: 'train' | 'iso' | 'cards';
  /** Iso world: what the ground and background look like. */
  theme?: WorldTheme;
  /** Names of the progress steps shown in the header (chapters 1..n). */
  steps: string[];
  brand: Brand;
  beats: Beat[];
  /** Per-beat TTS timings; audio files are expected at voice/beat_<i>.mp3 unless audioUrls is given. */
  voice?: VoiceBeat[];
  /** Where each beat's voiceover MP3 is (the web app passes signed URLs). */
  audioUrls?: string[];
  /**
   * The user's own voiceover: one recording for the whole reel. `cuts[i]` is where scene i + 1 starts in it
   * (seconds), so there is one cut fewer than beats. It replaces `voice` and `audioUrls`.
   */
  voiceTrack?: { url: string; durationSec: number; cuts: number[] };
  /** Speed of the voice for the whole reel (1 = as recorded). */
  pace?: number;
  /** Extra speed per scene, multiplied with `pace`. */
  scenePace?: number[];
  /** Background music, looped under the whole reel. */
  music?: { url: string; durationSec: number; volume: number };
  captions?: CaptionStyle;
};

/** Same shape as CaptionStyle in the shared package (the engine doesn't import it). */
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

const TRAIN_BEATS: Beat[] = [
  {
    id: 'hook',
    narration: 'Na internet, na GPS. Phir bhi ye app bilkul sahi batata hai ki aapki train kahan hai. Kaise?',
    keywords: ['internet,', 'gps.', 'sahi', 'kaise?'],
    chapter: 0,
    camera: { follow: true, x: 0, y: 0, z: 1, zoom: 56 },
    events: ['none'],
    card: {
      eyebrow: 'Where is my Train',
      headline: 'Na *GPS*, na *internet*. Phir bhi tracking.',
      tone: 'red',
      rows: [
        {
          kind: 'chips',
          items: [
            { text: 'GPS off', tone: 'red', strike: true },
            { text: 'Mobile data off', tone: 'red', strike: true },
            { text: 'Live status on', tone: 'teal' },
          ],
        },
      ],
    },
  },
  {
    id: 'towers',
    narration:
      'Aapka phone hamesha sabse paas wale mobile tower se baat karta rehta hai, mobile data band ho tab bhi.',
    keywords: ['hamesha', 'tower', 'band', 'bhi.'],
    chapter: 1,
    camera: { follow: true, x: -1, y: -1.5, z: 2, zoom: 34 },
    events: ['rings'],
    card: {
      eyebrow: 'Step 1 · Mobile tower',
      headline: 'Phone *hamesha* paas wale tower se baat karta hai',
      tone: 'teal',
      rows: [{ kind: 'flow', items: ['Aapka phone', 'Paas ka tower', 'Network'] }],
    },
  },
  {
    id: 'ids',
    narration: 'Har tower ki apni ek ID hoti hai. App ye ID seedhe aapke phone se padh leta hai.',
    keywords: ['id', 'seedhe'],
    chapter: 1,
    camera: { follow: true, x: -1, y: -1.5, z: 2, zoom: 30 },
    events: ['rings', 'towerIds'],
    card: {
      eyebrow: 'Step 1 · Mobile tower',
      headline: 'Har tower ki apni *ID* hoti hai',
      tone: 'teal',
      rows: [
        { kind: 'kv', k: 'Connected to', v: 'Tower 40471', tone: 'teal' },
        { kind: 'note', text: 'Example ID. Phone mein network signal hona chahiye.' },
      ],
    },
  },
  {
    id: 'map',
    narration:
      'App ke andar ek chhota sa offline naksha hai, ki kaun se tower kis railway line par khade hain. Poore Bharat ka data, sirf saat-aath MB mein.',
    keywords: ['offline', 'naksha', 'railway', 'mb'],
    chapter: 2,
    camera: { x: 30, y: 0, z: 0, zoom: 17 },
    events: ['towerIds', 'pins'],
    card: {
      eyebrow: 'Step 2 · Tower ka naksha',
      headline: 'Tracks ke towers ka chhota sa *offline naksha*',
      tone: 'purple',
      rows: [{ kind: 'file', name: 'rail routes ke towers', size: '7–8 MB', note: 'Poora Bharat, founder ke mutabik' }],
    },
  },
  {
    id: 'built',
    narration:
      'Ye naksha banaya kisne? Shuruaati yatriyon ne. Unke phone ne GPS aur tower ID saath-saath record kiye, aur har tower track par apni jagah pin ho gaya.',
    keywords: ['yatriyon', 'gps', 'pin', 'track'],
    chapter: 2,
    camera: { x: 34, y: 0, z: 1, zoom: 24 },
    events: ['gpsLog', 'pins'],
    card: {
      eyebrow: 'Naksha kaise bana',
      headline: 'Yatriyon ne *GPS + tower ID* saath record kiye',
      tone: 'purple',
      rows: [
        { kind: 'flow', items: ['GPS point', 'Tower ID', 'Track par pin'] },
        { kind: 'note', text: 'Train mein safar karne walon se crowdsourced' },
      ],
    },
  },
  {
    id: 'timetable',
    narration: 'Ab isme jodiye timetable, wo bhi offline. Tower plus timetable, yaani aapki train ka live status.',
    keywords: ['timetable,', 'offline.', 'live', 'status.'],
    chapter: 3,
    camera: { x: 45, y: 1, z: 1, zoom: 30 },
    events: ['stationGlow'],
    card: {
      eyebrow: 'Step 3 · Offline timetable',
      headline: 'Tower + timetable = *live status*',
      tone: 'blue',
      rows: [
        {
          kind: 'timetable',
          rows: [
            { stop: 'Pichhla stop', time: '10:05', state: 'done' },
            { stop: 'Tower 40477 ke paas', time: 'now', state: 'here' },
            { stop: 'Agla station', time: '10:40', state: 'next' },
          ],
        },
      ],
    },
  },
  {
    id: 'accuracy',
    narration:
      'Kya ye ekdam sateek hai? Nahi, kuch kilometre ka fark ho sakta hai. Lekin train khud aadha kilometre lambi hoti hai, to itna kaafi hai.',
    keywords: ['sateek', 'kilometre', 'aadha', 'kaafi'],
    chapter: 4,
    camera: { x: 28, y: 0, z: 0, zoom: 20 },
    events: ['errorBand'],
    card: {
      eyebrow: 'Step 4 · Kitna sahi?',
      headline: 'Kuch km ka fark bhi *kaafi hai*',
      tone: 'amber',
      rows: [
        { kind: 'kv', k: 'Stations ke beech', v: 'kuch km', tone: 'amber' },
        { kind: 'kv', k: 'Train ki lambai', v: '~0.5 km', tone: 'blue' },
      ],
    },
  },
  {
    id: 'google',
    narration: 'Ye itna badhiya chala ki 2018 mein Google ne ye app hi khareed liya.',
    keywords: ['google', '2018'],
    chapter: 4,
    camera: { x: 30, y: 0, z: 0, zoom: 15 },
    events: ['none'],
    card: {
      eyebrow: 'Twist',
      headline: 'Dec 2018 mein *Google* ne khareeda',
      tone: 'teal',
      rows: [{ kind: 'note', text: 'Banaya tha Sigmoid Labs, Bengaluru ne' }],
    },
  },
  {
    id: 'cta',
    narration: 'Agli baar kis app ke baare mein jaanna chahte hain? Comment mein bataiye.',
    keywords: ['agli', 'comment'],
    chapter: 4,
    camera: { x: 30, y: 0, z: 0, zoom: 14 },
    events: ['none'],
    card: {
      eyebrow: 'Comment mein batao',
      headline: 'Agla *kaunsa app* samjhayein?',
      tone: 'teal',
      rows: [
        {
          kind: 'chips',
          items: [
            { text: 'Google Maps traffic', tone: 'blue' },
            { text: 'UPI payments', tone: 'purple' },
          ],
        },
      ],
    },
  },
];

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
  track?: { durationSec: number; cuts: number[] };
}

const MIN_SCENE_FRAMES = Math.round(0.3 * FPS);

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

export function timeBeats(beats: Beat[], voiceBeats: VoiceBeat[] = [], opts: TimingOptions = {}): TimedBeat[] {
  const track = opts.track && opts.track.durationSec > 0 && opts.track.cuts.length === beats.length - 1 ? opts.track : null;
  const useVoice = !track && voiceBeats.length === beats.length;
  const edges = track ? [0, ...track.cuts, track.durationSec] : [];
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
      timedWords = spreadWords(words, cursor + edge, cursor + frames - Math.min(8, Math.round(frames * 0.1)));
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
  const track = spec.voiceTrack ? { durationSec: spec.voiceTrack.durationSec, cuts: spec.voiceTrack.cuts } : undefined;
  const timed = timeBeats(spec.beats, hasVoice(spec) && !track ? spec.voice : [], { rates: sceneRates(spec), track });
  const storyFrames = timed.reduce((n, b) => n + b.frames, 0);
  return { timed, storyFrames, totalFrames: storyFrames + END_CARD_FRAMES };
}

export const DEFAULT_BRAND: Brand = { name: 'Reel Studio', initials: 'RS', handle: '@yourchannel', tagline: 'Roz ki tech, andar ki baat' };

/** The sample reel, rendered in the train world with its recorded voice track (if generated). */
export const TRAIN_REEL: ReelSpec = {
  title: 'Where is my Train',
  world: 'train',
  steps: ['Tower', 'Naksha', 'Timetable', 'Accuracy'],
  brand: DEFAULT_BRAND,
  beats: TRAIN_BEATS,
  voice: (voice as { beats?: VoiceBeat[] }).beats ?? [],
};
