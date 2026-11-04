import { describe, expect, it } from '@jest/globals';
// The engine's own logic, tested here because the engine has no Jest project of its own.
import { reelTiming, sceneRates, timeBeats, type Beat, type ReelSpec } from '../../../backend/reel-engine/src/script';

const beat = (id: string, narration: string): Beat => ({ id, narration, keywords: [], chapter: 1, card: { eyebrow: 'E', headline: 'H', tone: 'teal', rows: [] } });
const TEN = 'Ek do teen char paanch chhe saat aath nau das.';
const beats = [beat('a', TEN), beat('b', TEN), beat('c', TEN)];

describe('timeBeats without a voice', () => {
  it('estimates from the words, and a faster pace makes scenes shorter', () => {
    expect(timeBeats(beats)[0]!.frames).toBe(Math.round((10 / 2.7) * 30) + 18);
    const fast = timeBeats(beats, [], { rates: [1.5, 1, 1] });
    expect(fast[0]!.frames).toBeLessThan(timeBeats(beats)[0]!.frames);
    expect(fast[1]!.frames).toBe(timeBeats(beats)[1]!.frames);
    expect(fast[1]!.start).toBe(fast[0]!.frames);
    expect(timeBeats(beats)[0]!.audio).toBeUndefined();
  });
});

describe('timeBeats with one uploaded recording', () => {
  const track = { durationSec: 30, cuts: [10, 20] };

  it('gives each scene its own part of the recording, back to back', () => {
    const t = timeBeats(beats, [], { track });
    expect(t.map((b) => b.frames)).toEqual([300, 300, 300]);
    expect(t.map((b) => b.start)).toEqual([0, 300, 600]);
    expect(t.map((b) => b.audio)).toEqual([
      { from: 0, frames: 300, srcStartSec: 0, rate: 1, source: 'track' },
      { from: 300, frames: 300, srcStartSec: 10, rate: 1, source: 'track' },
      { from: 600, frames: 300, srcStartSec: 20, rate: 1, source: 'track' },
    ]);
  });

  it('plays a scene faster by giving it fewer frames, and moves the scenes after it up', () => {
    const t = timeBeats(beats, [], { track, rates: [1, 2, 1] });
    expect(t.map((b) => b.frames)).toEqual([300, 150, 300]);
    expect(t[2]!.start).toBe(450);
    expect(t[1]!.audio).toMatchObject({ from: 300, frames: 150, srcStartSec: 10, rate: 2 });
    expect(t[2]!.audio).toMatchObject({ from: 450, srcStartSec: 20 });
  });

  it('spreads the caption words over the scene, in order', () => {
    const [first] = timeBeats(beats, [], { track });
    const w = first!.words;
    expect(w).toHaveLength(10);
    for (let i = 0; i < w.length; i++) {
      expect(w[i]!.start).toBeGreaterThanOrEqual(first!.start);
      expect(w[i]!.end).toBeLessThanOrEqual(first!.start + first!.frames);
      expect(w[i]!.end).toBeGreaterThan(w[i]!.start);
      if (i > 0) expect(w[i]!.start).toBe(w[i - 1]!.end);
    }
    // Words ending a sentence hold the beat a little longer than short words do.
    expect(w[9]!.end - w[9]!.start).toBeGreaterThan(w[0]!.end - w[0]!.start);
  });

  it('ignores cuts that do not fit the number of scenes', () => {
    const t = timeBeats(beats, [], { track: { durationSec: 30, cuts: [10] } });
    expect(t[0]!.audio).toBeUndefined();
    expect(t[0]!.frames).toBe(timeBeats(beats)[0]!.frames);
  });
});

describe('timeBeats with ElevenLabs voice', () => {
  const voice = beats.map(() => ({ durationSec: 4, words: [{ start: 0, end: 1 }, { start: 1.2, end: 2 }, { start: 2.5, end: 4 }] }));

  it('starts the audio after a short lead, and scales everything with the speed', () => {
    const normal = timeBeats(beats, voice)[0]!;
    expect(normal.frames).toBe(120 + 6 + 8);
    expect(normal.audio).toMatchObject({ from: 6, frames: normal.frames - 6, srcStartSec: 0, rate: 1, source: 'beat' });
    const fast = timeBeats(beats, voice, { rates: [2, 1, 1] })[0]!;
    expect(fast.frames).toBe(60 + 3 + 4);
    expect(fast.audio).toMatchObject({ rate: 2, from: 3 });
    expect(fast.words[0]!.start).toBeLessThan(normal.words[0]!.start + 1);
  });
});

describe('reelTiming', () => {
  const spec: Pick<ReelSpec, 'beats' | 'voice' | 'pace' | 'scenePace' | 'voiceTrack'> = { beats };

  it('adds the end card, and takes pace, scene speed and the recording from the spec', () => {
    const base = reelTiming(spec);
    expect(base.totalFrames).toBe(base.storyFrames + 90);
    const slow = reelTiming({ ...spec, pace: 0.8 });
    expect(slow.storyFrames).toBeGreaterThan(base.storyFrames);
    const withTrack = reelTiming({ ...spec, pace: 1.25, scenePace: [1, 1, 0.8], voiceTrack: { url: 'u', durationSec: 30, cuts: [10, 20] } });
    expect(withTrack.timed[0]!.frames).toBe(Math.round((10 / 1.25) * 30));
    expect(withTrack.timed[2]!.frames).toBe(Math.round((10 / 1) * 30));
  });
});

describe('sceneRates', () => {
  it('multiplies pace and scene speed, and keeps the result in a range audio can play', () => {
    expect(sceneRates({ beats, pace: 1.2, scenePace: [1, 1.5] })).toEqual([1.2, 1.2 * 1.5, 1.2]);
    expect(sceneRates({ beats, pace: 1.5, scenePace: [1.5, 0.1] })).toEqual([2, 0.5, 1.5]);
    expect(sceneRates({ beats })).toEqual([1, 1, 1]);
    expect(sceneRates({ beats, pace: NaN })).toEqual([1, 1, 1]);
  });
});
