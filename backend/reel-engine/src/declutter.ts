/** A label's anchor on screen: Pill sits with its bottom-centre at (x, y). */
export interface LabelBox {
  id: string;
  x: number;
  y: number;
  /** Approximate width in pixels. */
  w: number;
}

/** Approximate pill width for a text (monospace, 26px). */
export const pillWidth = (text: string) => text.length * 16 + 52;

/**
 * Keeps labels from sitting on top of each other: in the given order (most important first), a label that would
 * overlap one already placed is lifted by `step` pixels until it clears (at most `tries` times).
 * Returns how many pixels each label moves up.
 */
export function declutter(boxes: LabelBox[], height = 56, step = 62, tries = 4): Map<string, number> {
  const placed: { x: number; y: number; w: number }[] = [];
  const shift = new Map<string, number>();
  for (const b of boxes) {
    let dy = 0;
    const clash = (y: number) => placed.some((p) => Math.abs(p.x - b.x) < (p.w + b.w) / 2 + 6 && Math.abs(p.y - y) < height + 4);
    for (let i = 0; i < tries && clash(b.y - dy); i++) dy += step;
    placed.push({ x: b.x, y: b.y - dy, w: b.w });
    shift.set(b.id, dy);
  }
  return shift;
}
