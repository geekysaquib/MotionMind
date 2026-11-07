import type { ReelEditor } from './editor';

export const STAGES = ['topic', 'research', 'graphics', 'script', 'storyboard', 'voice', 'final'] as const;
export type Stage = (typeof STAGES)[number];
export type ProjectStatus = 'draft' | 'in_progress' | 'completed' | 'archived';
export type QualityTier = 'draft' | 'standard' | 'premium' | 'cinematic';

/** Where a reel is going. Both are 1080x1920; they differ in safe areas, the closing call to action and the cover crop. */
export const PLATFORM_IDS = ['instagram', 'youtube'] as const;
export type Platform = (typeof PLATFORM_IDS)[number];
export const PLATFORMS: Record<Platform, { label: string; short: string; cta: string; maxSec: number }> = {
  instagram: { label: 'Instagram Reels', short: 'Instagram', cta: 'follow', maxSec: 90 },
  youtube: { label: 'YouTube Shorts', short: 'Shorts', cta: 'subscribe', maxSec: 180 },
};
/** A project made before platforms existed makes both. */
export const ALL_PLATFORMS: Platform[] = ['instagram', 'youtube'];
/** Clean a saved list: known platforms only, in a fixed order, never empty. */
export function normalizePlatforms(list: unknown): Platform[] {
  const set = new Set(Array.isArray(list) ? list : []);
  const out = PLATFORM_IDS.filter((p) => set.has(p));
  return out.length ? [...out] : [...ALL_PLATFORMS];
}

export interface Project {
  id: string;
  ownerId: string;
  title: string;
  topic: string | null;
  stage: Stage;
  status: ProjectStatus;
  qualityTier: QualityTier;
  /** The platforms this reel is made for. */
  platforms: Platform[];
  durationSec: number;
  /** The reel script Claude wrote for this project, or null before the Script stage. */
  script: ReelScript | null;
  /** Fact-checked research for the topic, or null before the Research stage. */
  research: ResearchReport | null;
  /** ElevenLabs voiceover timings; the audio files themselves live in storage. */
  voice: ReelVoice | null;
  /** The Reel editor's state: uploaded voiceover and cuts, pace, music, caption style. */
  editor: ReelEditor | null;
  createdAt: string;
  updatedAt: string;
}

/** Per-beat voiceover: how long each line is and when each word is spoken (seconds). */
export interface ReelVoice {
  voiceId: string;
  voiceName?: string;
  beats: { durationSec: number; words: { start: number; end: number }[] }[];
  /** Narration the audio was made from, to tell when the script changed since. */
  narrations: string[];
  createdAt: string;
}

export type FactStatus = 'verified' | 'single_source' | 'estimate' | 'conflicting';

export const FACT_STATUS_LABELS: Record<FactStatus, string> = {
  verified: 'Verified',
  single_source: 'Single source',
  estimate: 'Estimate',
  conflicting: 'Conflicting',
};

/** What Claude found about a topic: checked facts, each pointing at the sources it came from. */
export interface ResearchReport {
  summary: string;
  facts: { claim: string; status: FactStatus; sources: number[] }[];
  sources: { title: string; url: string }[];
  /** Set when the user approves it; the script is then written from these facts. */
  approvedAt?: string | null;
  model?: string;
  writtenAt?: string;
}

export type ReelTone = 'red' | 'teal' | 'purple' | 'blue' | 'amber';

export type ReelRow =
  | { kind: 'chips'; items: { text: string; tone?: ReelTone; strike?: boolean }[] }
  | { kind: 'flow'; items: string[] }
  | { kind: 'kv'; k: string; v: string; tone?: ReelTone }
  | { kind: 'note'; text: string };

export interface ReelBeat {
  id: string;
  narration: string;
  /** Words to highlight in captions, as they appear in the narration (lower-case). */
  keywords: string[];
  /** 0 = hook, then 1..steps.length */
  chapter: number;
  card: { eyebrow: string; headline: string; tone: ReelTone; rows: ReelRow[] };
  /** The scene picture Claude designed for this topic, in the chosen style. Without it the style draws the first row. */
  visual?: SceneVisual;
}

/** Pieces Claude composes a scene from (same list as ELEMENT_KINDS in the reel engine). */
export const ELEMENT_KINDS = ['card', 'phone', 'window', 'code', 'number', 'list', 'bars', 'ring', 'queue', 'stamp', 'logo', 'text'] as const;
export type ElementKind = (typeof ELEMENT_KINDS)[number];

export interface VisualElement {
  id: string;
  kind: ElementKind;
  label?: string;
  sub?: string;
  icon?: string;
  logo?: string;
  value?: string;
  items?: { text: string; value?: number; ok?: boolean }[];
  /** Centre and width in percent of the scene area. */
  x?: number;
  y?: number;
  w?: number;
  tone?: ReelTone;
  /** Appears when the narration says this word (or `at` seconds into the scene). */
  on?: string;
  at?: number;
  focus?: boolean;
}

/** A scene as Claude designed it: pieces placed in the scene area, arrows between them, each appearing on a spoken word. */
export interface SceneVisual {
  elements: VisualElement[];
  links?: { from: string; to: string; label?: string; on?: string; dashed?: boolean }[];
  /** Live Map only: draw the scene over the city map. */
  map?: boolean;
}

/** A reel script: what the voice says and what each on-screen card shows. The reel engine renders it. */
export interface ReelScript {
  title: string;
  /** The look the reel is drawn in (picked on the Style step). Missing = the default style. */
  style?: import('./styles').StyleId;
  /** The cover (thumbnail) settings. Missing means the defaults. */
  cover?: import('./cover').CoverSettings;
  steps: string[];
  beats: ReelBeat[];
  /** Short forms used in the reel with what they stand for. The reel shows the full form whenever a beat uses one. */
  glossary?: { short: string; full: string }[];
  /** Companies and products named in the reel, with their website so their logo can be shown. */
  brands?: { name: string; domain: string }[];
  /** Which Claude model wrote it, and when. */
  model?: string;
  writtenAt?: string;
  /** Set when the user changes it in the Storyboard. */
  editedAt?: string;
}

export interface Profile {
  id: string;
  handle: string | null;
  displayName: string | null;
  channelName: string | null;
  niche: string | null;
  language: 'en' | 'hi' | 'hinglish';
  /** How the user works with AI. Null until they choose. */
  aiMode: 'paste' | 'keys' | null;
  onboardedAt: string | null;
}

export const STAGE_LABELS: Record<Stage, string> = {
  topic: 'Topic',
  research: 'Research',
  script: 'Script',
  storyboard: 'Storyboard',
  graphics: 'Style',
  voice: 'Voice',
  final: 'Final video',
};

/** The word used for a platform in file names. */
export const PLATFORM_FILE_WORD: Record<Platform, string> = { instagram: 'instagram', youtube: 'shorts' };

/**
 * A safe file name for something exported from a project: the reel's title and the platform, like
 * "How-UPI-Soundbox-works-instagram.mp4". Letters (any language) and digits stay; everything else becomes a dash.
 */
export function exportFileName(title: string, platform: Platform | null, ext: string): string {
  const slug = title
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
  return [slug || 'reel', platform ? PLATFORM_FILE_WORD[platform] : ''].filter(Boolean).join('-') + `.${ext}`;
}
