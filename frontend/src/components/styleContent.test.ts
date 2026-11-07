import { describe, expect, it } from '@jest/globals';
// The engine's own logic, tested here because the engine has no Jest project of its own.
import { captionChunks, contentOf, countText, splitNumber } from '../../../backend/reel-engine/src/styles/common';
import { reelTiming, SAMPLE_REEL, STYLE_IDS } from '../../../backend/reel-engine/src/script';
import { KITS } from '../../../backend/reel-engine/src/styles';

const card = (headline: string, rows: Parameters<typeof contentOf>[0]['card']['rows']) => ({ card: { headline, rows } });

describe('contentOf: what a scene shows', () => {
  it('draws the first row as the main picture', () => {
    expect(contentOf(card('h', [{ kind: 'flow', items: ['A', 'B'] }, { kind: 'kv', k: 'x', v: '1' }])).lead).toBe('flow');
    expect(contentOf(card('h', [{ kind: 'kv', k: 'Lookup', v: '2 ms' }])).stats).toEqual([{ label: 'Lookup', value: '2 ms', tone: undefined }]);
    expect(contentOf(card('h', [{ kind: 'chips', items: [{ text: 'Cash' }, { text: '' }] }])).chips).toHaveLength(1);
  });
  it('falls back to the headline, and notices a question', () => {
    const c = contentOf(card('Uber ko *kaise pata*?', []));
    expect(c.lead).toBe('headline');
    expect(c.question).toBe(true);
    expect(contentOf(card('h', [{ kind: 'flow', items: ['Only one'] }])).lead).toBe('headline');
  });
});

describe('numbers that count up', () => {
  it('splits a value around its number, keeping units and commas', () => {
    expect(splitNumber('₹2,000 cr')).toMatchObject({ pre: '₹', num: 2000, post: ' cr', commas: true });
    expect(splitNumber('1.8x')).toMatchObject({ num: 1.8, decimals: 1, post: 'x' });
    expect(splitNumber('fast')).toBeNull();
    expect(splitNumber('40471123')).toBeNull(); // a long code, not an amount
  });
  it('counts from zero to the value', () => {
    expect(countText('25,000', 0)).toBe('0');
    expect(countText('25,000', 1)).toBe('25,000');
    expect(countText('4 sec', 1)).toBe('4 sec');
    expect(countText('fast', 0.5)).toBe('fast');
  });
});

describe('captions', () => {
  it('groups words into short lines, breaking after punctuation, never leaving one word alone', () => {
    const w = (text: string, i: number) => ({ text, start: i, end: i + 1 });
    const chunks = captionChunks(['Concert', 'khatam,', 'aur', 'hazaaron', 'log', 'ek', 'saath', 'Uber.', 'Kaise?'].map(w));
    expect(chunks.map((c) => c.map((x) => x.text).join(' '))).toEqual(['Concert khatam,', 'aur hazaaron log ek', 'saath Uber. Kaise?']);
  });
});

describe('style kits', () => {
  it('has a kit for every style, and the sample reel times out', () => {
    for (const id of STYLE_IDS) expect(KITS[id].Stage).toEqual(expect.any(Function));
    const t = reelTiming(SAMPLE_REEL);
    expect(t.timed).toHaveLength(SAMPLE_REEL.beats.length);
    expect(t.totalFrames).toBeGreaterThan(t.storyFrames);
  });
});
