import { describe, expect, it } from '@jest/globals';
import type { ReelScript } from '@motionmind/shared';
import { specFromScript, worldFor } from './reelSpec';

const base: ReelScript = {
  title: 'How UPI works',
  steps: ['App'],
  beats: [{ id: 'a', narration: 'Hi.', keywords: [], chapter: 0, card: { eyebrow: 'E', headline: 'H', tone: 'teal', rows: [] } }],
};

describe('worldFor', () => {
  it('always picks a 3D world: the one Claude chose, else train for train topics and the scene kit otherwise', () => {
    expect(worldFor({ ...base, world: 'train' })).toBe('train');
    expect(worldFor({ ...base, world: 'iso' })).toBe('iso');
    expect(worldFor(base)).toBe('iso');
    expect(worldFor({ ...base, title: 'Where is my Train', steps: ['Tower'] })).toBe('train');
    expect(worldFor({ ...base, title: 'Brain science' })).toBe('iso');
    expect(specFromScript(base).world).toBe('iso');
  });
});
