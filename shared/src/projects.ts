import type { ReelEditor } from './editor';

export const STAGES = ['topic', 'research', 'script', 'storyboard', 'graphics', 'voice', 'final'] as const;
export type Stage = (typeof STAGES)[number];
export type ProjectStatus = 'draft' | 'in_progress' | 'completed' | 'archived';
export type QualityTier = 'draft' | 'standard' | 'premium' | 'cinematic';

export interface Project {
  id: string;
  ownerId: string;
  title: string;
  topic: string | null;
  stage: Stage;
  status: ProjectStatus;
  qualityTier: QualityTier;
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

/** Objects the 3D isometric world can draw (same list as the reel engine's PROP_KINDS). */
export type ScenePropKind = 'phone' | 'laptop' | 'tower' | 'server' | 'cloud' | 'bank' | 'shop' | 'building' | 'house' | 'factory' | 'person' | 'document' | 'money' | 'chip' | 'car' | 'satellite' | 'qr' | 'speaker' | 'lock' | 'database' | 'router' | 'battery' | 'heart' | 'gear' | 'truck' | 'plane' | 'train' | 'tree' | 'hospital' | 'school' | 'cart' | 'camera' | 'bulb' | 'globe' | 'envelope' | 'clock' | 'rocket' | 'syringe' | 'chart' | 'atm' | 'custom';

/** Every kind the scene editor offers (the engine's PROP_KINDS). */
export const SCENE_PROP_KINDS: ScenePropKind[] = ['phone', 'laptop', 'tower', 'server', 'cloud', 'bank', 'shop', 'building', 'house', 'factory', 'person', 'document', 'money', 'chip', 'car', 'satellite', 'qr', 'speaker', 'lock', 'database', 'router', 'battery', 'heart', 'gear', 'truck', 'plane', 'train', 'tree', 'hospital', 'school', 'cart', 'camera', 'bulb', 'globe', 'envelope', 'clock', 'rocket', 'syringe', 'chart', 'atm', 'custom'];
export const SCENE_PROP_SHAPES: ScenePropShape[] = ['block', 'tall', 'wide', 'flat', 'round'];
export const WORLD_THEMES: WorldTheme[] = ['city', 'nature', 'lab', 'plain', 'night', 'sunset', 'ocean', 'desert'];

/** Body of a 'custom' object. */
export type ScenePropShape = 'block' | 'tall' | 'wide' | 'flat' | 'round';

/** The look of the ground and background in the iso world. */
export type WorldTheme = 'city' | 'nature' | 'lab' | 'plain' | 'night' | 'sunset' | 'ocean' | 'desert';

/** A beat's 3D scene: which objects are on screen, what moves between them, and the effect. */
export interface ReelScene {
  props: { id: string; kind: ScenePropKind; label?: string; icon?: string; shape?: ScenePropShape; tone?: 'red' | 'teal' | 'purple' | 'blue' | 'amber' }[];
  links?: { from: string; to: string; label?: string }[];
  effect?: 'rings' | 'pulse' | 'none';
  focus?: string;
}

export interface ReelBeat {
  id: string;
  narration: string;
  /** Words to highlight in captions, as they appear in the narration (lower-case). */
  keywords: string[];
  /** 0 = hook, then 1..steps.length */
  chapter: number;
  card: { eyebrow: string; headline: string; tone: ReelTone; rows: ReelRow[] };
  /** 3D isometric world: what this beat shows. */
  scene?: ReelScene;
  /** Train world: a named camera shot and effects. */
  shot?: 'phone' | 'tower' | 'map' | 'crowd' | 'station' | 'accuracy' | 'wide';
  events?: ('rings' | 'towerIds' | 'pins' | 'gpsLog' | 'stationGlow' | 'errorBand' | 'none')[];
}

/**
 * Which 3D world renders a script. Claude picks it; older scripts without a choice get the train world
 * when they are about trains, and the isometric scene kit otherwise. Every reel is 3D.
 */
export function reelWorld(script: Pick<ReelScript, 'world' | 'title' | 'steps'> & { beats: Pick<ReelBeat, 'narration'>[] }): 'iso' | 'train' {
  if (script.world) return script.world;
  const text = [script.title, ...script.steps, ...script.beats.slice(0, 3).map((b) => b.narration)].join(' ');
  return /\b(train|trains|railway|railways|rail|irctc|metro)\b/i.test(text) ? 'train' : 'iso';
}

/** A reel script: what the voice says and what each on-screen card shows. The reel engine renders it. */
export interface ReelScript {
  title: string;
  /** Which 3D world renders it. Missing on older scripts, which render as flat cards. */
  world?: 'iso' | 'train';
  /** Iso world: the look of the ground and background. */
  theme?: WorldTheme;
  steps: string[];
  beats: ReelBeat[];
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
  onboardedAt: string | null;
}

export const STAGE_LABELS: Record<Stage, string> = {
  topic: 'Topic',
  research: 'Research',
  script: 'Script',
  storyboard: 'Storyboard',
  graphics: 'Graphics',
  voice: 'Voice',
  final: 'Final video',
};
