import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import path from 'node:path';
// The engine's own logic, tested here because the engine has no Jest project of its own.
import { isoCamera, layoutProps, propTop } from '../../../backend/reel-engine/src/IsoWorld';
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
