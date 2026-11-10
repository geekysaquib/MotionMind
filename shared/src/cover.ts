import type { ReelScript } from './projects';

// The cover (thumbnail) of a reel: a frame of Claude's animation, taken late in the scene you pick.

export interface CoverSettings {
  /** Which scene is the picture (0 = first scene). */
  scene: number;
}

/** The cover a script starts with: its first scene, which is the hook. */
export function defaultCover(_script: Pick<ReelScript, 'beats'>): CoverSettings {
  return { scene: 0 };
}

/** Keeps saved settings valid for the script as it is now (scenes may have been deleted since). */
export function normalizeCover(raw: Partial<CoverSettings> | null | undefined, script: Pick<ReelScript, 'beats'>): CoverSettings {
  const last = Math.max(0, script.beats.length - 1);
  return { scene: Math.min(last, Math.max(0, Math.round(Number(raw?.scene ?? 0)) || 0)) };
}
