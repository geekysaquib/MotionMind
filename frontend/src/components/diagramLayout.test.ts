import { describe, expect, it } from '@jest/globals';
import { TEMPLATES, TEMPLATE_IDS } from '@motionmind/shared';
// The engine's own logic, tested here because the engine has no Jest project of its own.
import { DEFAULT_REGION, layoutNodes } from '../../../backend/reel-engine/src/DiagramWorld';

const overlap = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

describe('layoutNodes', () => {
  it('fits one to four cards inside the region without overlap, leaving a gap wide enough for an arrow and its label', () => {
    for (const n of [1, 2, 3, 4]) {
      const boxes = layoutNodes(n, DEFAULT_REGION);
      expect(boxes).toHaveLength(n);
      for (const b of boxes) {
        expect(b.x).toBeGreaterThanOrEqual(DEFAULT_REGION.l - 1);
        expect(b.x + b.w).toBeLessThanOrEqual(DEFAULT_REGION.r + 1);
        expect(b.y).toBeGreaterThanOrEqual(DEFAULT_REGION.t - 1);
        expect(b.y + b.h).toBeLessThanOrEqual(DEFAULT_REGION.b + 1);
      }
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) expect(overlap(boxes[i]!, boxes[j]!)).toBe(false);
    }
    const col = layoutNodes(3, DEFAULT_REGION);
    expect(col[1]!.y - (col[0]!.y + col[0]!.h)).toBeGreaterThanOrEqual(120);
    const grid = layoutNodes(4, DEFAULT_REGION);
    expect(grid[1]!.x - (grid[0]!.x + grid[0]!.w)).toBeGreaterThanOrEqual(150);
  });

  it('works in a smaller region (the cover)', () => {
    const R = { l: 70, r: 1010, t: 100, b: 700 };
    const boxes = layoutNodes(3, R);
    expect(boxes[2]!.y + boxes[2]!.h).toBeLessThanOrEqual(R.b + 1);
  });
});

describe('template looks', () => {
  it('four templates draw flat diagrams in four different styles, the others keep the 3D world', () => {
    const flat = TEMPLATE_IDS.filter((id) => TEMPLATES[id].look.scene === 'diagram');
    expect(flat.sort()).toEqual(['conversation', 'dark-diagram', 'neon-system', 'paper-interview']);
    expect(new Set(flat.map((id) => TEMPLATES[id].look.diagram)).size).toBe(4);
    expect(TEMPLATES['night-3d'].look.links).toBe('dotted');
    expect(TEMPLATES['explainer-3d'].look.scene).toBeUndefined();
  });
});
