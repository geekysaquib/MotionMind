import { describe, expect, it } from '@jest/globals';
import { COVER_SIZES, defaultCover, normalizeCover, withAccent } from './cover';

const beat = (id: string, eyebrow: string, props = 0) => ({
  id,
  narration: 'x',
  keywords: [],
  chapter: 0,
  card: { eyebrow, headline: 'h', tone: 'teal' as const, rows: Array.from({ length: props }, () => ({ kind: 'note' as const, text: 'n' })) },
});

describe('withAccent', () => {
  it('highlights the longest word, keeps punctuation outside the stars, and leaves a headline that already has stars alone', () => {
    expect(withAccent('Soundbox kaise bolta hai')).toBe('*Soundbox* kaise bolta hai');
    expect(withAccent('How does UPI function?')).toBe('How does UPI *function*?');
    expect(withAccent('Already *marked* here')).toBe('Already *marked* here');
    expect(withAccent('A b c d')).toBe('A b c d'); // nothing long enough to stand out
  });
});

describe('defaultCover', () => {
  it('picks the busiest scene, the title with an accent, and the first scene label', () => {
    const c = defaultCover({ title: 'Soundbox kaise bolta hai', beats: [beat('a', 'Interview', 1), beat('b', 'Step 1', 4), beat('c', 'Step 2', 2)] });
    expect(c).toEqual({ scene: 1, headline: '*Soundbox* kaise bolta hai', kicker: 'Interview', style: 'bold', size: 'reel', tone: null, brand: true });
  });

  it('takes the first scene when none has objects, and a generic label when there is no eyebrow', () => {
    const c = defaultCover({ title: 'Hi', beats: [beat('a', ''), beat('b', '')] });
    expect(c.scene).toBe(0);
    expect(c.kicker).toBe('Explained');
  });

  it('cuts a very long title', () => {
    expect(defaultCover({ title: 'x'.repeat(300), beats: [beat('a', 'E')] }).headline.length).toBeLessThanOrEqual(122);
  });
});

describe('normalizeCover', () => {
  const script = { title: 'UPI kaise kaam karta hai', beats: [beat('a', 'One', 1), beat('b', 'Two', 3)] };

  it('is the defaults without saved settings', () => {
    expect(normalizeCover(null, script)).toEqual(defaultCover(script));
  });

  it('keeps saved settings, but never points at a scene that no longer exists or an unknown style or size', () => {
    const c = normalizeCover({ scene: 9, headline: 'Mine', kicker: 'K', style: 'wild' as never, size: 'huge' as never, tone: 'red', brand: false }, script);
    expect(c).toEqual({ scene: 1, headline: 'Mine', kicker: 'K', style: 'bold', size: 'reel', tone: 'red', brand: false });
    expect(normalizeCover({ scene: -3 }, script).scene).toBe(0);
  });

  it('offers three sizes at the right dimensions', () => {
    expect(COVER_SIZES.reel).toMatchObject({ width: 1080, height: 1920 });
    expect(COVER_SIZES.feed).toMatchObject({ width: 1080, height: 1350 });
    expect(COVER_SIZES.square).toMatchObject({ width: 1080, height: 1080 });
  });
});
