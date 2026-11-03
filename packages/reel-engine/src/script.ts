// Storyboard for the test reel. Each beat is one narration line on a continuous camera path.
// Durations are estimated from word count until real TTS word timings are available.

import voice from './voice.json';

export const FPS = 30;
const WORDS_PER_SEC = 2.7;
const BEAT_PAD_SEC = 0.6;

export type Chapter = 0 | 1 | 2 | 3 | 4;

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

export interface Beat {
  id: string;
  narration: string;
  /** Lower-case words to colour in captions. */
  keywords: string[];
  card: Card;
  chapter: Chapter;
  camera: CameraKey;
  events: WorldEvent[];
}

export const BEATS: Beat[] = [
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

export const END_CARD_FRAMES = 3 * FPS;

export interface TimedBeat extends Beat {
  start: number;
  frames: number;
  words: { text: string; start: number; end: number }[];
}

interface VoiceBeat {
  durationSec: number;
  words: { start: number; end: number }[];
}
const VOICE: VoiceBeat[] = (voice as { beats: VoiceBeat[] }).beats ?? [];
export const HAS_VOICE = VOICE.length === BEATS.length;

export function timeBeats(beats: Beat[]): TimedBeat[] {
  let cursor = 0;
  const lead = Math.round(0.2 * FPS);
  return beats.map((beat, idx) => {
    const words = beat.narration.split(/\s+/);
    const v = HAS_VOICE ? VOICE[idx] : undefined;
    let frames: number;
    let timedWords: TimedBeat['words'];
    if (v && v.words.length) {
      // Real TTS timings. Caption words (Hinglish) are mapped onto spoken words (Devanagari) by position.
      frames = Math.round(v.durationSec * FPS) + lead + Math.round(0.25 * FPS);
      const m = v.words.length;
      timedWords = words.map((text, j) => {
        const a = v.words[Math.min(m - 1, Math.floor((j * m) / words.length))];
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

export const TIMED = timeBeats(BEATS);
export const STORY_FRAMES = TIMED.reduce((n, b) => n + b.frames, 0);
export const TOTAL_FRAMES = STORY_FRAMES + END_CARD_FRAMES;
