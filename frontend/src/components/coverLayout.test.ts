import { describe, expect, it } from '@jest/globals';
// The engine's own logic, tested here because the engine has no Jest project of its own.
import { COVER_DIMS, countLines, fitHeadline, worldRegion } from '../../../backend/reel-engine/src/coverLayout';

describe('fitHeadline', () => {
  it('makes a short headline huge and a long one smaller, and always fits the box it is given', () => {
    const short = fitHeadline('Soundbox', 940, 600);
    const long = fitHeadline('How does a UPI Soundbox know the money has arrived in two seconds', 940, 600);
    expect(short.fontSize).toBeGreaterThan(long.fontSize);
    expect(short.fontSize).toBeLessThanOrEqual(168);
    for (const f of [short, long]) expect(f.lines * f.fontSize * 1.06).toBeLessThanOrEqual(600 + 1);
  });

  it('ignores the highlight stars when measuring, and has a floor for absurd text', () => {
    expect(fitHeadline('*Soundbox* kaise bolta hai', 940, 500)).toEqual(fitHeadline('Soundbox kaise bolta hai', 940, 500));
    expect(fitHeadline('word '.repeat(200), 940, 100).fontSize).toBe(54);
  });

  it('gives a smaller box a smaller headline', () => {
    const tall = fitHeadline('Soundbox kaise bolta hai', 940, 576);
    const square = fitHeadline('Soundbox kaise bolta hai', 940, 324);
    expect(square.fontSize).toBeLessThan(tall.fontSize);
  });
});

describe('countLines', () => {
  it('wraps on words, and breaks a word longer than a line', () => {
    expect(countLines('aa bb cc', 100, 1000)).toBe(1);
    expect(countLines('aaaa bbbb cccc dddd', 100, 300)).toBeGreaterThan(1);
    expect(countLines('x'.repeat(100), 100, 560)).toBeGreaterThan(5);
  });
});

describe('worldRegion', () => {
  it('keeps the 3D scene out of the text area for each layout', () => {
    const { height } = COVER_DIMS.reel;
    expect(worldRegion('bold', 1080, height).bottom).toBeLessThan(height * 0.62); // text is at the bottom
    expect(worldRegion('split', 1080, height).top).toBeGreaterThan(height * 0.4); // text is at the top
    const c = worldRegion('center', 1080, height);
    expect(c.bottom).toBeLessThan(height * 0.585); // the card starts at 58.5%
    expect(c.left).toBe(70);
    expect(c.right).toBe(1010);
  });
});
