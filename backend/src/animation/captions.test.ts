import { describe, expect, it } from '@jest/globals';
import type { ReelTimeline } from '@motionmind/shared';
import { captionChunks, withCaptions } from './captions';

const words = (list: [string, number, number][]) => list.map(([w, start, end]) => ({ w, start, end }));
const timeline: ReelTimeline = {
  scenes: [
    { index: 0, start: 0, end: 3, narration: '', words: words([['Duniya', 0.1, 0.5], ['ki', 0.5, 0.7], ['sabse', 0.7, 1.0], ['keemti', 1.0, 1.4], ['company.', 1.4, 2.0], ['Kyun?', 2.2, 2.8]]) },
    { index: 1, start: 3, end: 5, narration: '', words: words([['Ek', 3.1, 3.4], ['*chip*', 3.4, 4.2]]) },
  ],
  storyEnd: 5,
  duration: 7,
  source: 'recording',
} as unknown as ReelTimeline;

describe('captionChunks', () => {
  it('breaks at sentence ends, scene changes and full lines, and keeps each chunk up until the next', () => {
    const c = captionChunks(timeline, [[], ['chip']]);
    expect(c.map((x) => x.words.map((w) => w.w).join(' '))).toEqual(['Duniya ki sabse', 'keemti company.', 'Kyun?', 'Ek chip']);
    expect(c[0]).toMatchObject({ start: 0.1, end: 1.0 });
    expect(c[1]).toMatchObject({ start: 1.0, end: 2.2 });
    expect(c[3]!.words[1]).toMatchObject({ w: 'chip', key: true });
    expect(c[3]!.end).toBeLessThanOrEqual(5);
    for (const x of c) expect(x.size).toBeGreaterThanOrEqual(44);
  });
});

describe('withCaptions', () => {
  const html = '<!doctype html><html><head></head><body><!-- motionmind:no-captions --><div id="root" data-composition-id="main" data-start="0" data-duration="7"></div></body></html>';

  it('adds a caption layer with real spaces between words, timed on the main timeline', () => {
    const out = withCaptions(html, timeline, [], '#8B7CFF');
    expect(out).toContain('class="clip mm-cap"');
    expect(out).toContain('id="mmw0_0">Duniya</span> <span');
    expect(out).toContain('main.set(el,{opacity:1},c[0])');
  });

  it('leaves animations that make their own captions alone', () => {
    const own = html.replace('<!-- motionmind:no-captions -->', '');
    expect(withCaptions(own, timeline, [], '#8B7CFF')).toBe(own);
  });
});
