import { describe, expect, it } from '@jest/globals';
import { captionLines, carryChoices, keptRanges, rangesDuration, speechSegments, toOutputTime, wordsAfterCut, wordsIn } from './footage';

const opts = { minPause: 0.1, padSec: 0.05 };

describe('speechSegments', () => {
  it('cuts every pause of at least minPause, keeping a pad of the pause next to the speech', () => {
    const segs = speechSegments([{ start: 2, end: 3 }, { start: 5, end: 5.05 }], 8, opts);
    // The 0.05 s pause is too short to cut.
    expect(segs).toEqual([
      { start: 0, end: 2.05, keep: true },
      { start: 2.95, end: 8, keep: true },
    ]);
  });

  it('drops silence at the very start and end of the clip', () => {
    const segs = speechSegments([{ start: 0, end: 1 }, { start: 9, end: 10 }], 10, opts);
    expect(segs).toEqual([{ start: 0.95, end: 9.05, keep: true }]);
  });

  it('keeps the whole clip when there are no pauses', () => {
    expect(speechSegments([], 4, opts)).toEqual([{ start: 0, end: 4, keep: true }]);
  });
});

describe('keptRanges and timing', () => {
  const segs = [
    { start: 0, end: 2, keep: true },
    { start: 3, end: 5, keep: false },
    { start: 6, end: 7, keep: true },
  ];
  it('keeps only kept segments and adds up their length', () => {
    const kept = keptRanges(segs);
    expect(kept).toEqual([{ start: 0, end: 2 }, { start: 6, end: 7 }]);
    expect(rangesDuration(kept)).toBe(3);
  });

  it('maps source times to the cut video', () => {
    const kept = keptRanges(segs);
    expect(toOutputTime(1, kept)).toBe(1);
    expect(toOutputTime(4, kept)).toBeNull();
    expect(toOutputTime(6.5, kept)).toBe(2.5);
  });

  it('moves the surviving words onto the cut timeline', () => {
    const kept = keptRanges(segs);
    const words = [
      { text: 'hi', start: 0.2, end: 0.4 },
      { text: 'gone', start: 3.5, end: 3.8 },
      { text: 'there', start: 6.2, end: 6.6 },
    ];
    expect(wordsAfterCut(words, kept).map((w) => [w.text, w.start])).toEqual([
      ['hi', 0.2],
      ['there', 2.2],
    ]);
    expect(wordsIn(words, { start: 6, end: 7 })).toBe('there');
  });

  it('keeps a word whose rough timing spills into a cut pause', () => {
    const kept = [{ start: 0, end: 1 }, { start: 1.3, end: 3 }];
    // Its middle (1.15) is in the cut, but its start was heard.
    const out = wordsAfterCut([{ text: 'friends', start: 0.9, end: 1.4 }], kept);
    expect(out).toEqual([{ text: 'friends', start: 0.9, end: 1.1 }]);
  });
});

describe('carryChoices', () => {
  it('keeps a dropped stretch dropped after a new cut', () => {
    const before = [
      { start: 0, end: 2, keep: true },
      { start: 2.5, end: 4, keep: false },
    ];
    const next = [
      { start: 0, end: 2.1, keep: true },
      { start: 2.4, end: 4, keep: true },
    ];
    expect(carryChoices(next, before).map((s) => s.keep)).toEqual([true, false]);
  });
});

describe('captionLines', () => {
  it('breaks after three words, at sentence ends and at gaps', () => {
    const w = (text: string, start: number) => ({ text, start, end: start + 0.2 });
    const lines = captionLines([w('one', 0), w('two', 0.3), w('three', 0.6), w('four.', 0.9), w('five', 1.2), w('six', 3)]);
    expect(lines.map((l) => l.map((x) => x.text).join(' '))).toEqual(['one two three', 'four.', 'five', 'six']);
  });
});
