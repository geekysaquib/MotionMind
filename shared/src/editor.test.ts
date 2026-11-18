import { describe, expect, it } from '@jest/globals';
import { clampClosingAt, clampTrimEnd, clampTrimStart, closingRange, defaultClosingAt, detectTrim, trimWindow, moveCut, normalizeEditor, sceneBounds, usesUploadedVoice, type ReelEditor } from './editor';

const track = { path: 'u/p/voice-1.mp3', fileName: 'voice.mp3', mime: 'audio/mpeg', durationSec: 30 };
const upload: ReelEditor = { upload: { track, cuts: [10, 20] }, music: null };

describe('normalizeEditor', () => {
  it('fills in a blank editor', () => {
    expect(normalizeEditor(null)).toEqual({ upload: null, music: null });
  });

  it('drops the fields of the old editor (pace, captions, sound effects, voice source)', () => {
    const old = { voiceSource: 'elevenlabs', pace: 1.2, scenePace: [1], captions: { size: 'large' }, sfx: [], upload: { track, cuts: [10] }, music: null, updatedAt: 'now' };
    expect(normalizeEditor(old as never)).toEqual({ upload: { track, cuts: [10] }, music: null, updatedAt: 'now' });
  });
});

describe('moveCut', () => {
  it('moves one break but keeps every scene at least 0.3 s long', () => {
    expect(moveCut([10, 20], 0, 12, 30)).toEqual([12, 20]);
    expect(moveCut([10, 20], 0, -5, 30)).toEqual([0.3, 20]);
    expect(moveCut([10, 20], 0, 25, 30)).toEqual([19.7, 20]);
    expect(moveCut([10, 20], 1, 99, 30)).toEqual([10, 29.7]);
    expect(moveCut([10, 20], 5, 1, 30)).toEqual([10, 20]);
  });
});

describe('sceneBounds', () => {
  it('lists where each scene starts and ends in the recording', () => {
    expect(sceneBounds([10, 20], 30)).toEqual([
      { start: 0, end: 10 },
      { start: 10, end: 20 },
      { start: 20, end: 30 },
    ]);
  });
});

describe('usesUploadedVoice', () => {
  it('needs a recording and one cut fewer than scenes', () => {
    expect(usesUploadedVoice(upload, 3)).toBe(true);
    expect(usesUploadedVoice(upload, 2)).toBe(false);
    expect(usesUploadedVoice({ ...upload, upload: null }, 3)).toBe(false);
    expect(usesUploadedVoice(null, 3)).toBe(false);
  });
});

describe('the follow line at the end of a recording', () => {
  // 14 s at 20 peaks/s: speech to 10 s, a 0.7 s pause, then a 3 s line, then silence.
  const peaks = Array.from({ length: 280 }, (_, i) => (i < 200 ? 60 : i < 214 ? 2 : i < 274 ? 55 : 1));

  it('finds where the last burst of speech starts, just before it', () => {
    const t = defaultClosingAt(peaks, 14, [4, 8]);
    expect(t).toBeGreaterThan(10.4);
    expect(t).toBeLessThan(10.8);
  });

  it('falls back to the last 4 seconds when the last burst is really the last scene, or there is nothing to listen to', () => {
    expect(defaultClosingAt([], 20, [5, 10])).toBe(16);
    expect(defaultClosingAt(Array.from({ length: 400 }, () => 60), 20, [5, 10])).toBe(16);
  });

  it('keeps the start after the last break and before the end', () => {
    const r = closingRange([10, 20], 30);
    expect(r.lo).toBeCloseTo(20.3);
    expect(r.hi).toBeCloseTo(29.6);
    expect(clampClosingAt(5, [10, 20], 30)).toBeCloseTo(20.3);
    expect(clampClosingAt(99, [10, 20], 30)).toBeCloseTo(29.6);
  });
});

describe('trimming the recording', () => {
  // 20 s at 20 peaks/s: 1.5 s of quiet, speech from 1.5 to 17, then quiet to the end.
  const peaks = Array.from({ length: 400 }, (_, i) => (i >= 30 && i < 340 ? 55 : 1));

  it('finds the quiet at each end and keeps a small margin', () => {
    const t = detectTrim(peaks, 20, [6, 12]);
    expect(t.start).toBeGreaterThan(1.2);
    expect(t.start).toBeLessThan(1.5);
    expect(t.end).toBeGreaterThan(17);
    expect(t.end).toBeLessThan(17.4);
    expect(detectTrim([], 20, [6, 12])).toEqual({ start: 0, end: 20 });
  });

  it('never trims into a scene break or the follow line', () => {
    expect(clampTrimStart(9, [6, 12], null, 20)).toBeCloseTo(5.7);
    expect(clampTrimStart(-3, [6, 12], null, 20)).toBe(0);
    expect(clampTrimEnd(1, [6, 12], null, 0, 20)).toBeCloseTo(12.3);
    expect(clampTrimEnd(99, [6, 12], null, 0, 20)).toBe(20);
    expect(clampTrimEnd(13, [6, 12], 14, 0, 20)).toBeCloseTo(14.4);
  });

  it('is the whole file unless the trimmed part is at least a second', () => {
    expect(trimWindow({ track: { durationSec: 20 } })).toEqual({ start: 0, end: 20 });
    expect(trimWindow({ track: { durationSec: 20 }, trimStart: 2, trimEnd: 18 })).toEqual({ start: 2, end: 18 });
    expect(trimWindow({ track: { durationSec: 20 }, trimStart: 10, trimEnd: 10.5 })).toEqual({ start: 0, end: 20 });
  });
});
