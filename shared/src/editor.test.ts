import { describe, expect, it } from '@jest/globals';
import { DEFAULT_CAPTIONS, clampPace, editorSpecParts, moveCut, normalizeEditor, sceneBounds, usesUploadedVoice, type ReelEditor } from './editor';

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
