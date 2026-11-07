import type { ReelScript, ReelTone } from './projects';

// The cover (thumbnail) of a reel: one scene, drawn in the reel's style, as a still image with a big headline on it.

/** Where the text sits: big at the bottom, on a card in the middle, or in a panel at the top. */
export const COVER_STYLES = ['bold', 'center', 'split'] as const;
export type CoverStyle = (typeof COVER_STYLES)[number];

/** Image sizes: the Reels cover, the 4:5 feed post / profile grid, and a square. */
export const COVER_SIZES = {
  reel: { width: 1080, height: 1920, label: 'Reel cover 9:16' },
  feed: { width: 1080, height: 1350, label: 'Feed post 4:5' },
  square: { width: 1080, height: 1080, label: 'Square 1:1' },
} as const;
export type CoverSize = keyof typeof COVER_SIZES;

export interface CoverSettings {
  /** Which scene is the picture (0 = first scene). */
  scene: number;
  /** The big text. Words in *stars* are highlighted. */
  headline: string;
  /** A small label above it, shown in capitals. */
  kicker: string;
  style: CoverStyle;
  size: CoverSize;
  /** Highlight colour. Missing means the scene's own colour. */
  tone?: ReelTone | null;
  /** Show the channel name and handle. */
  brand: boolean;
}

export const MAX_HEADLINE = 120;
export const MAX_KICKER = 40;

const STAR = '*';

/** Wraps the longest word in stars so the headline has an accent, unless the author already did. */
export function withAccent(text: string): string {
  if (text.includes(STAR)) return text;
  const words = text.split(/\s+/).filter(Boolean);
  const best = words.reduce((a, w) => (w.replace(/[^\p{L}\p{N}]/gu, '').length > a.replace(/[^\p{L}\p{N}]/gu, '').length ? w : a), '');
  if (best.replace(/[^\p{L}\p{N}]/gu, '').length < 5) return text;
  const clean = best.replace(/[^\p{L}\p{N}-]+$/u, '');
  return text.replace(best, `${STAR}${clean}${STAR}${best.slice(clean.length)}`);
}

/** The cover a script starts with: its busiest scene, the title with a highlighted word, and the first scene's label. */
export function defaultCover(script: Pick<ReelScript, 'title' | 'beats'>): CoverSettings {
  let scene = 0;
  let most = -1;
  script.beats.forEach((b, i) => {
    const n = b.card.rows?.length ?? 0;
    if (n > most) {
      most = n;
      scene = i;
    }
  });
  const title = script.title.trim().slice(0, MAX_HEADLINE);
  const eyebrow = script.beats[0]?.card.eyebrow?.trim();
  return { scene, headline: withAccent(title), kicker: (eyebrow || 'Explained').slice(0, MAX_KICKER), style: 'bold', size: 'reel', tone: null, brand: true };
}

/** Keeps saved settings valid for the script as it is now (scenes may have been deleted since). */
export function normalizeCover(raw: Partial<CoverSettings> | null | undefined, script: Pick<ReelScript, 'title' | 'beats'>): CoverSettings {
  const base = defaultCover(script);
  if (!raw) return base;
  const last = Math.max(0, script.beats.length - 1);
  return {
    scene: Math.min(last, Math.max(0, Math.round(Number(raw.scene ?? base.scene)) || 0)),
    headline: (raw.headline ?? base.headline).slice(0, MAX_HEADLINE),
    kicker: (raw.kicker ?? base.kicker).slice(0, MAX_KICKER),
    style: (COVER_STYLES as readonly string[]).includes(raw.style ?? '') ? raw.style! : base.style,
    size: raw.size && raw.size in COVER_SIZES ? raw.size : base.size,
    tone: raw.tone ?? null,
    brand: raw.brand ?? base.brand,
  };
}
