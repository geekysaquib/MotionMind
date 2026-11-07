import { describe, expect, it } from '@jest/globals';
import type { ReelScript } from '@motionmind/shared';
import { specFromScript } from './reelSpec';

const base: ReelScript = {
  title: 'How UPI works',
  steps: ['App'],
  beats: [{ id: 'a', narration: 'Hi.', keywords: [], chapter: 0, card: { eyebrow: 'E', headline: 'H', tone: 'teal', rows: [] } }],
};

describe('style', () => {
  it('uses the picked style, the default before one is picked, or the one asked for (the Style page tries each)', () => {
    expect(specFromScript(base).style).toBe('live-map');
    expect(specFromScript({ ...base, style: 'whiteboard' }).style).toBe('whiteboard');
    expect(specFromScript({ ...base, style: 'whiteboard' }, undefined, undefined, undefined, undefined, 'newsroom').style).toBe('newsroom');
  });
});
