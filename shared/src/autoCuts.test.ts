import { describe, expect, it } from '@jest/globals';
import { autoCuts, speechWeight } from './autoCuts';
import { PEAKS_PER_SEC } from './editor';

/** 20 peaks a second: loud (80) while someone speaks, silent in the given gaps and at both ends. */
function recording(seconds: number, speech: [number, number][]): number[] {
  return Array.from({ length: Math.ceil(seconds * PEAKS_PER_SEC) }, (_, i) => {
    const t = i / PEAKS_PER_SEC;
    return speech.some(([a, b]) => t >= a && t < b) ? 80 : 0;
  });
}

describe('speechWeight', () => {
  it('counts longer lines as longer, and pauses at punctuation as time', () => {
    expect(speechWeight('Ek second mein payment ho jaata hai.')).toBeGreaterThan(speechWeight('Ek second.'));
    expect(speechWeight('Ruko, dekho. Phir bolo.')).toBeGreaterThan(speechWeight('Ruko dekho Phir bolo'));
    expect(speechWeight('')).toBeGreaterThan(0);
  });
});

describe('autoCuts', () => {
  const lines = ['Pehli baat yeh hai ki phone tower se judta hai.', 'Doosri baat yeh hai ki tower ki ID hoti hai.', 'Teesri baat yeh hai ki app map banata hai.'];

  it('puts the breaks in the pauses between lines', () => {
    const peaks = recording(20, [
      [0.5, 6.4],
      [7.0, 13.0],
      [13.8, 19.5],
    ]);
    const cuts = autoCuts(peaks, 20, lines);
    expect(cuts).toHaveLength(2);
    expect(cuts[0]!).toBeGreaterThan(6.4);
    expect(cuts[0]!).toBeLessThan(7.0);
    expect(cuts[1]!).toBeGreaterThan(13.0);
    expect(cuts[1]!).toBeLessThan(13.8);
  });

  it('ignores silence before and after the speech', () => {
    const peaks = recording(30, [
      [4.0, 10.0],
      [10.6, 16.0],
      [16.7, 22.0],
    ]);
    const cuts = autoCuts(peaks, 30, lines);
    expect(cuts[0]!).toBeGreaterThan(9.9);
    expect(cuts[0]!).toBeLessThan(10.7);
    expect(cuts[1]!).toBeGreaterThan(15.9);
    expect(cuts[1]!).toBeLessThan(16.8);
  });

  it('keeps cuts in order and apart, even for one long breathless recording', () => {
    const peaks = recording(12, [[0, 12]]);
    const cuts = autoCuts(peaks, 12, lines);
    expect(cuts[0]!).toBeGreaterThanOrEqual(0.3);
    expect(cuts[1]! - cuts[0]!).toBeGreaterThanOrEqual(0.3);
    expect(12 - cuts[1]!).toBeGreaterThanOrEqual(0.3);
  });

  it('splits by line length when there is no waveform, and has no cuts for a single scene', () => {
    const cuts = autoCuts([], 30, ['a b c d e f g h', 'a b c d e f g h']);
    expect(cuts).toEqual([15]);
    expect(autoCuts([1, 2, 3], 3, ['only one'])).toEqual([]);
  });
});
