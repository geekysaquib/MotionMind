import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import path from 'node:path';
// The engine's own logic, tested here because the engine has no Jest project of its own.
import { arcFor, footprint, isoCamera, KIND_SCALE, layoutProps, propTop } from '../../../backend/reel-engine/src/IsoWorld';
import { toScreen } from '../../../backend/reel-engine/src/iso';
import { reelTiming, type ReelSpec } from '../../../backend/reel-engine/src/script';

const sample = (name: string) => JSON.parse(readFileSync(path.resolve(process.cwd(), `backend/reel-engine/samples/${name}.json`), 'utf8')) as ReelSpec;

describe.each(['soundbox', 'vaccine'])('3D scene framing: %s sample', (name) => {
  const spec = sample(name);
  const { timed, storyFrames } = reelTiming(spec);
  const placed = layoutProps(timed);

  it('gives every object its own spot, and keeps each scene close together', () => {
    const spots = [...placed.values()].map((p) => `${p.pos.x},${p.pos.y}`);
    expect(new Set(spots).size).toBe(spots.length);
    for (const b of timed) {
      const ps = (b.scene?.props ?? []).map((p) => placed.get(p.id)!);
      const spread = Math.max(...ps.map((p) => p.pos.x)) - Math.min(...ps.map((p) => p.pos.x));
      expect(spread).toBeLessThanOrEqual(6.4 * 3);
    }
  });

  it("keeps every object of a scene, with its icon, inside the frame while the scene holds", () => {
    for (const b of timed) {
      const frame = b.start + Math.round(b.frames * 0.8);
      const cam = isoCamera(timed, placed, storyFrames, frame);
      for (const sp of b.scene?.props ?? []) {
        const p = placed.get(sp.id)!;
        const [x, y] = toScreen({ ...p.pos, z: propTop(p) }, cam);
        expect(x).toBeGreaterThan(60);
        expect(x).toBeLessThan(1020);
        expect(y).toBeGreaterThan(450);
        expect(y).toBeLessThan(1560);
      }
    }
  });
});

describe('custom objects', () => {
  it('are placed and sized by their shape, whatever their kind says', () => {
    const spec = sample('vaccine');
    const placed = layoutProps(reelTiming(spec).timed);
    expect(placed.get('shot')!.spec.icon).toBe('💉');
    expect(propTop(placed.get('shot')!)).toBeGreaterThan(propTop(placed.get('cells')!)); // tall > block
  });
});

describe('3D model library', () => {
  it('every extra model builds items and has a height', async () => {
    const { EXTRA_KINDS, EXTRA_TOP, extraItems } = await import('../../../backend/reel-engine/src/props3d');
    expect(EXTRA_KINDS.length).toBeGreaterThanOrEqual(24);
    for (const kind of EXTRA_KINDS) {
      const items = extraItems(kind, { id: kind, pos: { x: 0, y: 0, z: 0 } }, '#8B5CF6', 12);
      expect(items && items.length).toBeGreaterThan(1);
      expect(EXTRA_TOP[kind]).toBeGreaterThan(0);
    }
    const { MORE_KINDS, MORE_TOP, moreItems } = await import('../../../backend/reel-engine/src/props3d-more');
    for (const kind of MORE_KINDS) {
      const items = moreItems(kind, { id: kind, pos: { x: 0, y: 0, z: 0 } }, '#8B5CF6', 12);
      expect(items && items.length).toBeGreaterThan(1);
      expect(MORE_TOP[kind]).toBeGreaterThan(0);
    }
    expect(extraItems('nope', { id: 'n', pos: { x: 0, y: 0, z: 0 } }, '#000', 0)).toBeNull();
  });
});

describe('icon tiles', () => {
  it('draws any known Lucide icon as a 3D tile and rejects unknown names', async () => {
    const { glyphItems, hasGlyph, glyphNames } = await import('../../../backend/reel-engine/src/glyph');
    expect(glyphNames().length).toBeGreaterThan(1000);
    expect(hasGlyph('microscope')).toBe(true);
    expect(hasGlyph('not-an-icon')).toBe(false);
    expect(hasGlyph(undefined)).toBe(false);
    const items = glyphItems({ id: 'g', pos: { x: 0, y: 0, z: 0 }, glyph: 'wheat', tone: '#F59E0B' }, 5);
    expect(items.length).toBe(4); // shadow, base, tile, icon layers
  });
});

describe('label declutter', () => {
  it('lifts a label that would sit on another one, and leaves clear labels alone', async () => {
    const { declutter, pillWidth } = await import('../../../backend/reel-engine/src/declutter');
    const w = pillWidth('train');
    const shift = declutter([
      { id: 'a', x: 500, y: 800, w },
      { id: 'b', x: 520, y: 810, w },
      { id: 'c', x: 100, y: 800, w },
    ]);
    expect(shift.get('a')).toBe(0);
    expect(shift.get('b')).toBeGreaterThan(0);
    expect(shift.get('c')).toBe(0);
  });
});

describe('footprint-aware layout', () => {
  it.each(['soundbox', 'vaccine', 'models', 'models2', 'icons'])('never puts two objects on top of each other: %s sample', (name) => {
    const placed = [...layoutProps(reelTiming(sample(name)).timed).values()];
    for (let i = 0; i < placed.length; i++)
      for (let j = i + 1; j < placed.length; j++) {
        const a = placed[i]!;
        const b = placed[j]!;
        const fa = footprint(a.kind, a.spec);
        const fb = footprint(b.kind, b.spec);
        const apartX = Math.abs(a.pos.x - b.pos.x) >= fa[0] + fb[0];
        const apartY = Math.abs(a.pos.y - b.pos.y) >= fa[1] + fb[1];
        expect(apartX || apartY).toBe(true);
      }
  });

  it('gives wide objects more room than small ones', () => {
    expect(footprint('train')[0]).toBeGreaterThan(footprint('phone')[0] * 4);
    expect(footprint('custom', { id: 'x', kind: 'custom', glyph: 'wheat' })[0]).toBeGreaterThan(1);
  });
});

describe('links and big vehicles', () => {
  const at = (id: string, kind: string, x: number, y: number) => ({ id, kind: kind as never, spec: { id, kind: kind as never }, pos: { x, y, z: 0 }, appearsAt: 0 });

  it('a link goes straight when nothing is in the way, and bends away from an object that is', () => {
    const a = at('a', 'phone', 0, 0);
    const b = at('b', 'phone', 12, 0);
    expect(arcFor(a, b, [a, b])).toEqual({ dx: 0, dy: 0, lift: 0 });
    const blocker = at('c', 'bank', 6, 0.3);
    const arc = arcFor(a, b, [a, b, blocker]);
    expect(Math.hypot(arc.dx, arc.dy)).toBeGreaterThan(0.5);
    expect(Math.hypot(arc.dx, arc.dy)).toBeLessThanOrEqual(2.2 + 1e-9);
    // It bends to the side the blocker is not on (the blocker sits slightly toward +y).
    expect(arc.dy).toBeLessThan(0);
    // An object that is only near an end does not bend it.
    expect(arcFor(a, b, [a, b, at('d', 'bank', 0.5, 1)])).toEqual({ dx: 0, dy: 0, lift: 0 });
  });

  it('draws trains, planes and ships smaller, and their footprint follows', () => {
    expect(KIND_SCALE.train).toBeLessThan(1);
    expect(footprint('train')[0]).toBeCloseTo(2.9 * KIND_SCALE.train!, 5);
    expect(footprint('phone')[0]).toBe(0.5);
  });
});
