import { describe, expect, it } from '@jest/globals';
// The engine's own logic, tested here because the engine has no Jest project of its own.
import { autoScene, withScenes } from '../../../backend/reel-engine/src/autoScene';
import type { Beat, ReelSpec } from '../../../backend/reel-engine/src/script';

const beat = (over: Omit<Partial<Beat>, 'card'> & { card?: Partial<Beat['card']> } = {}): Beat => ({
  id: 'b',
  narration: 'Aapka phone tower se baat karta hai.',
  keywords: ['tower'],
  chapter: 1,
  ...over,
  card: { eyebrow: 'Step 1', headline: 'Phone *tower* se baat karta hai', tone: 'teal', rows: [], ...over.card },
});

describe('autoScene', () => {
  it('turns a flow into a chain of guessed 3D objects', () => {
    const s = autoScene(beat({ card: { rows: [{ kind: 'flow', items: ['Your phone', 'NPCI', 'Their bank'] }] } }), undefined);
    expect(s.props.map((p) => p.kind)).toEqual(['phone', 'bank', 'bank']);
    expect(s.links).toEqual([
      { from: 'your-phone', to: 'npci' },
      { from: 'npci', to: 'their-bank' },
    ]);
  });

  it('uses the highlighted word and keeps the previous scene in view', () => {
    const first = autoScene(beat(), undefined);
    expect(first.props[0]).toMatchObject({ id: 'tower', kind: 'tower' });
    expect(first.effect).toBe('rings');
    const next = autoScene(beat({ narration: 'Server data store karta hai.', card: { headline: 'Data *server* par' } }), first);
    expect(next.props.map((p) => p.id)).toEqual(['tower', 'server']);
    expect(next.links).toEqual([{ from: 'tower', to: 'server' }]);
  });
});

describe('autoScene for objects the 3D kit has no model for', () => {
  it('uses a real 3D model when the library has one (a vaccine is a syringe)', () => {
    const s = autoScene(beat({ narration: 'Vaccine ka dose aapke sharir mein jaata hai.', keywords: ['vaccine'], card: { headline: '*Vaccine* ka dose', tone: 'purple' } }), undefined);
    expect(s.props[0]).toMatchObject({ kind: 'syringe' });
  });

  it('turns a word that names a Lucide icon into that icon tile', () => {
    const s = autoScene(beat({ narration: 'Microscope se dekho.', keywords: ['microscope'], card: { eyebrow: 'Step', headline: '*Microscope* se', tone: 'blue' } }), undefined);
    expect(s.props[0]).toMatchObject({ kind: 'custom', glyph: 'microscope' });
  });

  it('draws a custom object with a fitting emoji when no model fits', () => {
    const s = autoScene(beat({ narration: 'Virus aapke sharir mein jaata hai.', keywords: ['virus'], card: { headline: '*Virus* aata hai', tone: 'purple' } }), undefined);
    expect(s.props[0]).toMatchObject({ kind: 'custom', icon: '🦠', glyph: 'bug', shape: 'round', tone: 'purple' });
  });

  it('still falls back to a custom object (with a generic icon) for unknown words', () => {
    const s = autoScene(beat({ narration: 'Zxqv hota hai.', keywords: ['zxqv'], card: { eyebrow: 'Zxqv', headline: '*Zxqv* hota hai' } }), undefined);
    expect(s.props[0]).toMatchObject({ kind: 'custom', icon: '💡' });
  });
});

describe('withScenes', () => {
  const spec = (world: ReelSpec['world'], beats: Beat[]): ReelSpec => ({ title: 't', world, steps: [], brand: { name: 'n', initials: 'N', handle: '@n', tagline: '' }, beats });

  it('fills every iso beat without a scene and leaves described ones alone', () => {
    const described = beat({ id: 'd', scene: { props: [{ id: 'x', kind: 'chip' }] } });
    const out = withScenes(spec('iso', [beat(), described]));
    expect(out.beats[0]!.scene!.props.length).toBeGreaterThan(0);
    expect(out.beats[1]!.scene).toBe(described.scene);
  });

  it('gives train beats a shot and effects from their words', () => {
    const out = withScenes(
      spec('train', [beat({ id: 'h' }), beat({ id: 't', narration: 'Har tower ki ID hoti hai.' }), beat({ id: 's', card: { eyebrow: 'Step 3', headline: 'Timetable se *delay*' }, narration: 'Timetable dekhta hai.' }), beat({ id: 'e' })]),
    );
    expect(out.beats.map((b) => b.shot)).toEqual(['phone', 'tower', 'station', 'wide']);
    expect(out.beats[1]!.events).toEqual(['rings', 'towerIds']);
  });
});
