import { describe, expect, it } from '@jest/globals';
import { exportFileName } from './projects';

describe('exportFileName', () => {
  it('joins the reel title and the platform word, and is safe as a file name', () => {
    expect(exportFileName('How does a UPI Soundbox know the money arrived?', 'instagram', 'mp4')).toBe('How-does-a-UPI-Soundbox-know-the-money-arrived-instagram.mp4');
    expect(exportFileName('IRCTC Tatkal: kaise/kaam karta hai', 'youtube', 'mp4')).toBe('IRCTC-Tatkal-kaise-kaam-karta-hai-shorts.mp4');
  });
  it('keeps Hindi letters, falls back to "reel", and leaves the platform off for covers', () => {
    expect(exportFileName('यूपीआई कैसे काम करता है', 'instagram', 'mp4')).toContain('instagram.mp4');
    expect(exportFileName('???', 'youtube', 'mp4')).toBe('reel-shorts.mp4');
    expect(exportFileName('My reel cover', null, 'png')).toBe('My-reel-cover.png');
  });
  it('cuts a very long title', () => {
    expect(exportFileName('word '.repeat(60), 'instagram', 'mp4').length).toBeLessThanOrEqual(60 + '-instagram.mp4'.length);
  });
});
