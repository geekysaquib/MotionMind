import { describe, expect, it } from '@jest/globals';
import { defaultCover, normalizeCover } from './cover';

const beats = (n: number) => ({ beats: Array.from({ length: n }, (_, i) => ({ id: String(i), narration: 'x', keywords: [], chapter: 0, card: { eyebrow: '', headline: 'h', tone: 'teal' as const, rows: [] } })) });

describe('cover', () => {
  it('starts at the hook scene', () => {
    expect(defaultCover(beats(5))).toEqual({ scene: 0 });
  });

  it('keeps the saved scene inside the script as it is now', () => {
    expect(normalizeCover({ scene: 3 }, beats(5))).toEqual({ scene: 3 });
    expect(normalizeCover({ scene: 9 }, beats(5))).toEqual({ scene: 4 });
    expect(normalizeCover({ scene: -3 }, beats(5))).toEqual({ scene: 0 });
    expect(normalizeCover(null, beats(5))).toEqual({ scene: 0 });
  });
});
