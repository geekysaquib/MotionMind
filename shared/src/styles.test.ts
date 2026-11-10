import { describe, expect, it } from '@jest/globals';
import { DEFAULT_STYLE, STYLE_IDS, STYLES, styleOf, suggestStyles } from './styles';

const script = (title: string, narration = 'x') => ({
  title,
  beats: [{ id: 'a', narration, keywords: [], chapter: 0, card: { eyebrow: '', headline: 'h', tone: 'teal' as const, rows: [] } }],
});

describe('styles', () => {
  it('has a full catalog entry for every style', () => {
    for (const id of STYLE_IDS) expect(STYLES[id]).toMatchObject({ id, name: expect.any(String), description: expect.any(String) });
  });

  it('falls back to the default style for missing or unknown ids', () => {
    expect(styleOf(undefined).id).toBe(DEFAULT_STYLE);
    expect(styleOf('vaporwave').id).toBe(DEFAULT_STYLE);
    expect(styleOf('newsroom').id).toBe('newsroom');
  });

  it('suggests the style whose topics the script talks about', () => {
    expect(suggestStyles(script('Where is my train', 'Metro aur railway station ka route'))[0]).toBe('transit-map');
    expect(suggestStyles(script('RBI ka naya rule', 'Government ne budget mein price badhaya'))[0]).toBe('newsroom');
    expect(suggestStyles(script('ChatGPT kaise kaam karta hai', 'AI server pe data aur code'))[0]).toBe('dark-keynote');
  });

  it('pushes down styles the channel used recently, so reels do not all look the same', () => {
    const s = script('Swiggy delivery', 'Driver ki location map pe');
    expect(suggestStyles(s)[0]).toBe('live-map');
    expect(suggestStyles(s, ['live-map'])[0]).not.toBe('live-map');
    expect(suggestStyles(s, ['live-map'])).toHaveLength(STYLE_IDS.length);
  });
});
