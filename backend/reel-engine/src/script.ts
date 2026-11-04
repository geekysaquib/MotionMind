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
export const PROP_KINDS = ['phone', 'laptop', 'tower', 'server', 'cloud', 'bank', 'shop', 'building', 'house', 'factory', 'person', 'document', 'money', 'chip', 'car', 'satellite'] as const;
export type PropKind = (typeof PROP_KINDS)[number];

/**
 * One scene in the 3D isometric world. Props with the same id are the same object in every scene,
 * so the camera travels around one persistent world; a prop appears the first time a scene uses it.
 */
export interface IsoScene {
  props: { id: string; kind: PropKind; label?: string }[];
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
  /** Names of the progress steps shown in the header (chapters 1..n). */
  steps: string[];
  brand: Brand;
  beats: Beat[];
  /** Per-beat TTS timings; audio files are expected at voice/beat_<i>.mp3 unless audioUrls is given. */
  voice?: VoiceBeat[];
  /** Where each beat's voiceover MP3 is (the web app passes signed URLs). */
  audioUrls?: string[];
};

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
}

export function hasVoice(spec: Pick<ReelSpec, 'beats' | 'voice'>): boolean {
  return (spec.voice?.length ?? 0) === spec.beats.length && spec.beats.length > 0;
}

export function timeBeats(beats: Beat[], voiceBeats: VoiceBeat[] = []): TimedBeat[] {
  const useVoice = voiceBeats.length === beats.length;
  let cursor = 0;
  const lead = Math.round(0.2 * FPS);
  return beats.map((beat, idx) => {
    const words = beat.narration.split(/\s+/);
    const v = useVoice ? voiceBeats[idx] : undefined;
    let frames: number;
    let timedWords: TimedBeat['words'];
    if (v && v.words.length) {
      // Real TTS timings. Caption words (Hinglish) are mapped onto spoken words (Devanagari) by position.
      frames = Math.round(v.durationSec * FPS) + lead + Math.round(0.25 * FPS);
      const m = v.words.length;
      timedWords = words.map((text, j) => {
        const a = v.words[Math.min(m - 1, Math.floor((j * m) / words.length))]!;
        const b = v.words[Math.min(m - 1, Math.floor(((j + 1) * m) / words.length) - 1)] ?? a;
        return { text, start: cursor + lead + Math.round(a.start * FPS), end: cursor + lead + Math.round(Math.max(a.end, b.end) * FPS) };
      });
    } else {
      const speechFrames = Math.round((words.length / WORDS_PER_SEC) * FPS);
      frames = speechFrames + Math.round(BEAT_PAD_SEC * FPS);
      const perWord = speechFrames / words.length;
      timedWords = words.map((text, i) => ({
        text,
        start: cursor + lead + Math.round(i * perWord),
        end: cursor + lead + Math.round((i + 1) * perWord),
      }));
    }
    const timed: TimedBeat = { ...beat, start: cursor, frames, words: timedWords };
    cursor += frames;
    return timed;
  });
}

/** Frame layout of a reel: the timed beats, then a 3-second end card. */
export function reelTiming(spec: Pick<ReelSpec, 'beats' | 'voice'>) {
  const timed = timeBeats(spec.beats, hasVoice(spec) ? spec.voice : []);
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
