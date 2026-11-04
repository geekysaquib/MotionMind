import { describe, expect, it } from '@jest/globals';
import { DEFAULT_CAPTIONS, clampClosingAt, clampPace, clampTrimEnd, clampTrimStart, closingRange, defaultClosingAt, detectTrim, editorSpecParts, trimWindow, moveCut, normalizeEditor, sceneBounds, usesUploadedVoice, type ReelEditor } from './editor';

const track = { path: 'u/p/voice-1.mp3', fileName: 'voice.mp3', mime: 'audio/mpeg', durationSec: 30 };
const upload: ReelEditor = { ...normalizeEditor(null), upload: { track, cuts: [10, 20] } };

describe('clampPace', () => {
  it('keeps the voice speed between 0.7x and 1.5x', () => {
    expect(clampPace(0.2)).toBe(0.7);
    expect(clampPace(9)).toBe(1.5);
    expect(clampPace(1.234)).toBe(1.23);
    expect(clampPace('fast')).toBe(1);
    expect(clampPace(NaN)).toBe(1);
  });
});

describe('normalizeEditor', () => {
  it('fills in a blank editor, picking ElevenLabs when only that voice exists', () => {
    expect(normalizeEditor(null)).toMatchObject({ voiceSource: 'upload', upload: null, pace: 1, music: null, captions: DEFAULT_CAPTIONS });
    expect(normalizeEditor(null, true).voiceSource).toBe('elevenlabs');
  });

  it('repairs out-of-range values from older saves', () => {
    const e = normalizeEditor({ pace: 5, scenePace: [0.1, 1.2], captions: { size: 'large' } as never });
    expect(e.pace).toBe(1.5);
    expect(e.scenePace).toEqual([0.7, 1.2]);
    expect(e.captions).toEqual({ ...DEFAULT_CAPTIONS, size: 'large' });
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

describe('editorSpecParts', () => {
  it('turns the editor into what the reel needs, with the voice only when its cuts fit the scenes', () => {
    const parts = editorSpecParts(upload, 3, { voice: 'https://x/voice.mp3' });
    expect(parts.voiceTrack).toEqual({ url: 'https://x/voice.mp3', durationSec: 30, cuts: [10, 20] });
    expect(parts.scenePace).toEqual([1, 1, 1]);
    expect(parts.music).toBeUndefined();
    expect(editorSpecParts(upload, 4, { voice: 'https://x/voice.mp3' }).voiceTrack).toBeUndefined();
    expect(editorSpecParts({ ...upload, voiceSource: 'elevenlabs' }, 3, { voice: 'https://x/voice.mp3' }).voiceTrack).toBeUndefined();
    expect(editorSpecParts(upload, 3, {}).voiceTrack).toBeUndefined();
  });

  it('adds music with a safe volume, pace per scene and caption style', () => {
    const e: ReelEditor = { ...upload, pace: 1.2, scenePace: [1, 0.8], music: { track: { ...track, path: 'u/p/music-1.mp3', durationSec: 90 }, volume: 3 }, captions: { size: 'large', position: 'middle', look: 'plain' } };
    const parts = editorSpecParts(e, 3, { music: 'https://x/music.mp3' });
    expect(parts.music).toEqual({ url: 'https://x/music.mp3', durationSec: 90, volume: 1 });
    expect(parts.pace).toBe(1.2);
    expect(parts.scenePace).toEqual([1, 0.8, 1]);
    expect(parts.captions).toEqual({ size: 'large', position: 'middle', look: 'plain' });
    expect(editorSpecParts(null, 3, {})).toEqual({});
  });
});

describe('usesUploadedVoice', () => {
  it('needs the upload chosen and one cut fewer than scenes', () => {
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

  it('reaches the reel engine only when it is a usable point', () => {
    const e = (closingAt: number | null): ReelEditor => ({ ...upload, upload: { track, cuts: [10, 20], closingAt } });
    expect(editorSpecParts(e(26), 3, { voice: 'u' }).voiceTrack?.closingAt).toBe(26);
    expect(editorSpecParts(e(null), 3, { voice: 'u' }).voiceTrack?.closingAt).toBeUndefined();
    expect(editorSpecParts(e(20.1), 3, { voice: 'u' }).voiceTrack?.closingAt).toBeUndefined();
    expect(editorSpecParts(e(29.9), 3, { voice: 'u' }).voiceTrack?.closingAt).toBeUndefined();
  });
});

describe('trimming the recording', () => {
  // 20 s at 20 peaks/s: 1.5 s of quiet, speech from 1.5 to 17, then quiet to the end.
  const peaks = Array.from({ length: 400 }, (_, i) => (i >= 30 && i < 340 ? 55 : 1));
  const withTrim = (trimStart: number | null, trimEnd: number | null, closingAt: number | null = null): ReelEditor => ({
    ...upload,
    upload: { track: { ...track, durationSec: 20 }, cuts: [6, 12], closingAt, trimStart, trimEnd },
  });

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

  it('reaches the engine, and the follow line is judged against the trimmed end', () => {
    const p = editorSpecParts(withTrim(1.5, 18), 3, { voice: 'u' }).voiceTrack!;
    expect(p.trimStart).toBe(1.5);
    expect(p.trimEnd).toBe(18);
    expect(editorSpecParts(withTrim(null, null), 3, { voice: 'u' }).voiceTrack).toMatchObject({ cuts: [6, 12] });
    expect(editorSpecParts(withTrim(null, null), 3, { voice: 'u' }).voiceTrack!.trimStart).toBeUndefined();
    expect(editorSpecParts(withTrim(null, 15, 14.8), 3, { voice: 'u' }).voiceTrack!.closingAt).toBeUndefined();
    expect(editorSpecParts(withTrim(null, 15, 13), 3, { voice: 'u' }).voiceTrack!.closingAt).toBe(13);
  });
});

describe('sound effects', () => {
  const clip = (name: string, at: number, volume = 0.8) => ({ track: { ...track, path: `u/p/${name}.mp3`, durationSec: 2 }, at, volume });
  const withSfx = (sfx: NonNullable<ReelEditor['sfx']>): ReelEditor => ({ ...upload, sfx });

  it('is empty by default, and a reel can have at most twelve', () => {
    expect(normalizeEditor(null).sfx).toEqual([]);
    const many = Array.from({ length: 15 }, (_, i) => clip(`s${i}`, i));
    expect(normalizeEditor({ sfx: many }).sfx).toHaveLength(12);
  });

  it('reaches the engine with its url, start time and volume, and skips clips without a url', () => {
    const e = withSfx([clip('a', 1.5, 0.5), clip('b', 4), clip('c', -2, 3)]);
    const parts = editorSpecParts(e, 3, { voice: 'u', sfx: { 'u/p/a.mp3': 'ua', 'u/p/c.mp3': 'uc' } });
    expect(parts.sfx).toEqual([
      { url: 'ua', durationSec: 2, at: 1.5, volume: 0.5 },
      { url: 'uc', durationSec: 2, at: 0, volume: 1 },
    ]);
    expect(editorSpecParts(upload, 3, { voice: 'u' }).sfx).toBeUndefined();
  });
});
