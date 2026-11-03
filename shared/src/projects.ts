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
  createdAt: string;
  updatedAt: string;
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
}

/** A reel script: what the voice says and what each on-screen card shows. The reel engine renders it. */
export interface ReelScript {
  title: string;
  steps: string[];
  beats: ReelBeat[];
  /** Which Claude model wrote it, and when. */
  model?: string;
  writtenAt?: string;
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
