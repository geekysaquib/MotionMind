// Pure layout helpers for the cover image, kept apart from React so they can be tested.

/** Settings of one cover (the same shape as the app's CoverSettings; the engine does not import the app's shared package). */
export interface CoverProps {
  scene: number;
  headline: string;
  kicker: string;
  style: 'bold' | 'center' | 'split';
  size: 'reel' | 'feed' | 'square';
  tone?: 'red' | 'teal' | 'purple' | 'blue' | 'amber' | null;
  brand: boolean;
}

export const COVER_DIMS = {
  reel: { width: 1080, height: 1920 },
  feed: { width: 1080, height: 1350 },
  square: { width: 1080, height: 1080 },
} as const;

/** How many lines a text needs at a font size in a given width (words wrap; 0.56 em is an average bold letter). */
export function countLines(text: string, fontSize: number, widthPx: number): number {
  const perLine = Math.max(4, Math.floor(widthPx / (fontSize * 0.56)));
  let lines = 1;
  let used = 0;
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const len = word.length;
    if (used === 0) used = len;
    else if (used + 1 + len <= perLine) used += 1 + len;
    else {
      lines++;
      used = len;
    }
    // A word longer than a line is broken over several.
    if (len > perLine) lines += Math.floor((len - 1) / perLine);
  }
  return lines;
}

/** The biggest headline size (px) whose lines fit in the width and height given. Never below 54, never above 168. */
export function fitHeadline(text: string, widthPx: number, maxHeightPx: number): { fontSize: number; lines: number } {
  const plain = text.replace(/\*/g, '');
  for (let size = 168; size >= 54; size -= 6) {
    const lines = countLines(plain, size, widthPx);
    if (lines * size * 1.06 <= maxHeightPx) return { fontSize: size, lines };
  }
  return { fontSize: 54, lines: countLines(plain, 54, widthPx) };
}

/** The area of the picture where the 3D scene is framed, so the headline never covers it. */
export function worldRegion(style: CoverProps['style'], width: number, height: number) {
  const pad = 70;
  const f: Record<CoverProps['style'], [number, number]> = { bold: [0.07, 0.6], center: [0.09, 0.53], split: [0.45, 0.94] };
  const [top, bottom] = f[style];
  return { left: pad, right: width - pad, top: height * top, bottom: height * bottom };
}
