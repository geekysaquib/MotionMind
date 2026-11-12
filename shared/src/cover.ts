import type { ReelScript } from './projects';

// The cover (thumbnail) of a reel: a frame of the animation from the scene you pick, with the reel's title set large
// over it and the handle, so it reads on the profile grid.

export const MAX_COVER_HEADLINE = 70;

export interface CoverSettings {
  /** Which scene is the picture (0 = first scene). */
  scene: number;
  /** The words on the cover. Missing = the reel's title. Put *stars* around words to colour them. */
  headline?: string;
  /** False = just the frame, with no words on it. */
  text?: boolean;
}

/** The cover a script starts with: its first scene, which is the hook. */
export function defaultCover(_script: Pick<ReelScript, 'beats'>): CoverSettings {
  return { scene: 0 };
}

/** Keeps saved settings valid for the script as it is now (scenes may have been deleted since). */
export function normalizeCover(raw: Partial<CoverSettings> | null | undefined, script: Pick<ReelScript, 'beats'>): CoverSettings {
  const last = Math.max(0, script.beats.length - 1);
  const headline = typeof raw?.headline === 'string' ? raw.headline.trim().slice(0, MAX_COVER_HEADLINE) : '';
  return {
    scene: Math.min(last, Math.max(0, Math.round(Number(raw?.scene ?? 0)) || 0)),
    ...(headline ? { headline } : {}),
    ...(raw?.text === false ? { text: false } : {}),
  };
}

/** The post for one platform: captions (descriptions on YouTube) to choose from, hashtags, and a title for YouTube Shorts. */
export interface PlatformPost {
  captions: string[];
  hashtags: string[];
  /** YouTube Shorts only. */
  title?: string;
  /** Short hooks for the cover picture, with *stars* around the key words. */
  covers?: string[];
  createdAt: string;
}

/** What a reel's post needs besides the video, written separately for each platform it goes to. */
export type ReelPost = Partial<Record<'instagram' | 'youtube', PlatformPost>>;
