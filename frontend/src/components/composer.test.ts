import { describe, expect, it } from '@jest/globals';
// The engine's own logic, tested here because the engine has no Jest project of its own.
import { appearFrame, iconFor, placeElements } from '../../../backend/reel-engine/src/styles/composer';
import type { SceneVisual, TimedBeat } from '../../../backend/reel-engine/src/script';

const beat = {
  id: 'a',
  narration: 'Load balancer requests ko servers mein baant deta hai.',
  keywords: [],
  chapter: 1,
  card: { eyebrow: 'x', headline: 'y', tone: 'teal' },
  start: 100,
  frames: 200,
  words: 'Load balancer requests ko servers mein baant deta hai.'.split(' ').map((text, i) => ({ text, start: 100 + i * 10, end: 108 + i * 10 })),
} as TimedBeat;
const AREA = { l: 50, r: 1030, t: 640, b: 1440 };

describe('scene composer', () => {
  it('shows a piece when its word is spoken, at its time, or one after another', () => {
    expect(appearFrame(beat, { on: 'servers' }, 0)).toBe(140 - 4);
    expect(appearFrame(beat, { on: 'Servers,' }, 0)).toBe(136);
    expect(appearFrame(beat, { at: 2 }, 0)).toBe(160);
    expect(appearFrame(beat, { on: 'missing' }, 2)).toBe(100 + 8 + 24);
  });

  it('keeps every piece inside the area and shrinks pieces that would overlap', () => {
    const v: SceneVisual = { elements: [{ id: 'a', kind: 'card', label: 'Payment', x: 22, y: 20 }, { id: 'b', kind: 'card', label: 'PNR', x: 72, y: 20 }, { id: 'c', kind: 'phone', label: 'App' }] };
    const placed = placeElements(v, AREA, beat);
    for (const p of placed) {
      expect(p.x - p.w / 2).toBeGreaterThanOrEqual(AREA.l - 0.5);
      expect(p.x + p.w / 2).toBeLessThanOrEqual(AREA.r + 0.5);
      expect(p.y - p.h / 2).toBeGreaterThanOrEqual(AREA.t - 0.5);
      expect(p.y + p.h / 2).toBeLessThanOrEqual(AREA.b + 0.5);
    }
    const [a, b] = placed;
    expect(Math.abs(a!.x - b!.x)).toBeGreaterThanOrEqual((a!.w + b!.w) / 2);
  });

  it('finds Lucide icons by their kebab-case name', () => {
    expect(iconFor('train-front')).toBeTruthy();
    expect(iconFor('Server')).toBeTruthy();
    expect(iconFor('no-such-icon-here')).toBeNull();
    expect(iconFor(undefined)).toBeNull();
  });
});
