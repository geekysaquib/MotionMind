import { describe, expect, it } from '@jest/globals';
import type { ReelScript } from '@motionmind/shared';
import { specFromScript, worldFor } from './reelSpec';

const base: ReelScript = {
  title: 'T',
  steps: ['A'],
  beats: [{ id: 'a', narration: 'Hi.', keywords: [], chapter: 0, card: { eyebrow: 'E', headline: 'H', tone: 'teal', rows: [] } }],
};

describe('worldFor', () => {
  it('uses the world Claude picked, or iso when beats have scenes, else flat cards for old scripts', () => {
    expect(worldFor({ ...base, world: 'train' })).toBe('train');
    expect(worldFor({ ...base, world: 'iso' })).toBe('iso');
    expect(worldFor({ ...base, beats: [{ ...base.beats[0]!, scene: { props: [{ id: 'p', kind: 'phone' }] } }] })).toBe('iso');
    expect(worldFor(base)).toBe('cards');
    expect(specFromScript({ ...base, world: 'iso' }).world).toBe('iso');
  });
});
