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
  createdAt: string;
  updatedAt: string;
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
