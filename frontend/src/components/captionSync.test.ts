import { describe, expect, it } from '@jest/globals';
// The engine's own logic, tested here because the engine has no Jest project of its own.
import { timeBeats, wordsFromPeaks } from '../../../backend/reel-engine/src/script';

/** 20 loudness bins per second: `quiet` seconds of silence, then `talk` seconds of speech, then `tail` seconds of silence. */
const peaks = (quiet: number, talk: number, tail: number) => [...Array(quiet * 20).fill(0), ...Array(talk * 20).fill(70), ...Array(tail * 20).fill(0)] as number[];

describe('caption timing from the recording', () => {
  const words = 'ek do teen chaar paanch'.split(' ');

  it('starts the words when the voice starts and ends them when it stops, not at the scene edges', () => {
    // A 6 s scene: 2 s of silence, 3 s of speech, 1 s of silence.
    const t = wordsFromPeaks(words, peaks(2, 3, 1), 0, 6, 1, 0)!;
    expect(t[0]!.start).toBeGreaterThanOrEqual(58); // about 2 s in, at 30 fps
    expect(t[0]!.start).toBeLessThanOrEqual(62);
    expect(t.at(-1)!.end).toBeGreaterThanOrEqual(148); // about 5 s
    expect(t.at(-1)!.end).toBeLessThanOrEqual(152);
    for (let i = 1; i < t.length; i++) expect(t[i]!.start).toBeGreaterThanOrEqual(t[i - 1]!.start);
  });

  it('skips a pause in the middle of the scene, so words after it wait for the voice to come back', () => {
    const p = [...Array(20).fill(70), ...Array(60).fill(0), ...Array(20).fill(70)] as number[]; // 1 s speech, 3 s pause, 1 s speech
    const t = wordsFromPeaks(['a1', 'a2', 'b1', 'b2'], p, 0, 5, 1, 0)!;
    expect(t[2]!.start).toBeGreaterThanOrEqual(120); // the second half starts after the pause (4 s)
    expect(t[1]!.end).toBeLessThanOrEqual(36);
  });

  it('follows the playback speed and the scene position, and gives up without usable loudness', () => {
    const fast = wordsFromPeaks(words, peaks(0, 4, 0), 0, 4, 2, 100)!;
    expect(fast[0]!.start).toBe(100);
    expect(fast.at(-1)!.end).toBeLessThanOrEqual(100 + 61); // 4 s at 2x = 2 s = 60 frames
    expect(wordsFromPeaks(words, undefined, 0, 4, 1, 0)).toBeNull();
    expect(wordsFromPeaks(words, Array(80).fill(0), 0, 4, 1, 0)).toBeNull();
  });

  it('is used for every scene of an uploaded recording, and falls back to an even spread without peaks', () => {
    const beats = [
      { id: 'a', narration: 'ek do teen', keywords: [], chapter: 0, card: { eyebrow: 'x', headline: 'h', tone: 'teal' as const, rows: [] } },
      { id: 'b', narration: 'chaar paanch', keywords: [], chapter: 0, card: { eyebrow: 'x', headline: 'h', tone: 'teal' as const, rows: [] } },
    ];
    const withPeaks = timeBeats(beats, [], { track: { durationSec: 8, cuts: [4], peaks: peaks(1, 2, 1).concat(peaks(2, 1, 1)) } });
    expect(withPeaks[0]!.words[0]!.start).toBeGreaterThanOrEqual(28); // 1 s of silence first
    const plain = timeBeats(beats, [], { track: { durationSec: 8, cuts: [4] } });
    expect(plain[0]!.words[0]!.start).toBeLessThan(15);
  });
});
