import { describe, expect, it } from '@jest/globals';
import { endCardParts, hasEndCardMarker, NO_END_CARD_MARKER, withEndCard } from './endCard';

const HTML = `<!doctype html><html><head><title>x</title></head><body><!-- ${NO_END_CARD_MARKER} --><div id="root" data-composition-id="main" data-start="0" data-duration="7"><section class="clip" data-start="0" data-duration="4"></section></div><script>window.__timelines = {};</script></body></html>`;
const OPTS = { storyEnd: 4, duration: 7, handle: '@decodify_x', platforms: ['instagram', 'youtube'] as ('instagram' | 'youtube')[], language: 'hinglish' as const, accent: '#B7F34A' };

describe('end card', () => {
  it('is added inside the root, after the story: a quiet label over the handle, nothing more', () => {
    const out = withEndCard(HTML, OPTS);
    expect(out).toContain('class="clip mm-end" data-start="4" data-duration="3"');
    expect(out.indexOf('class="clip mm-end"')).toBeGreaterThan(out.indexOf('data-composition-id="main"'));
    expect(out).toContain('>@decodify_x<');
    expect(out).toContain('>Follow & subscribe<'.replace('&', '&amp;'));
    expect(out).toContain('main.add(tl,E)');
    // Its script runs after Claude's, which registers the timeline.
    expect(out.lastIndexOf('main.add(tl,E)')).toBeGreaterThan(out.indexOf('window.__timelines = {}'));
    // No buttons, no tap, no confetti, no invite line, no "karo".
    expect(out).not.toMatch(/mm-btn|mm-conf|ripple|karo|explainers/i);
  });

  it('says Follow, Subscribe or both, in the reel\'s language', () => {
    const label = (platforms: ('instagram' | 'youtube')[], language: 'en' | 'hi' | 'hinglish') => />([^<]+)<\/div><div class="mm-handle"/.exec(endCardParts({ ...OPTS, platforms, language }).section)![1];
    expect(label(['instagram'], 'hinglish')).toBe('Follow');
    expect(label(['youtube'], 'en')).toBe('Subscribe');
    expect(label(['instagram', 'youtube'], 'en')).toBe('Follow &amp; subscribe');
    expect(label(['instagram'], 'hi')).toBe('फ़ॉलो करें');
  });

  it('leaves an animation alone when Claude did not hand the end card over (older animations)', () => {
    const old = HTML.replace(`<!-- ${NO_END_CARD_MARKER} -->`, '');
    expect(hasEndCardMarker(old)).toBe(false);
    expect(withEndCard(old, OPTS)).toBe(old);
  });

  it('shrinks a long handle, and escapes what it prints', () => {
    const size = (h: string) => Number(/\.mm-handle\{[^}]*font-size:(\d+)px/.exec(endCardParts({ ...OPTS, handle: h }).head)![1]);
    expect(size('@a_very_long_channel_handle_here')).toBeLessThan(size('@abc'));
    expect(endCardParts({ ...OPTS, handle: '@<b>x', accent: 'red;}</style>' }).section).toContain('@&lt;b&gt;x');
    expect(endCardParts({ ...OPTS, accent: 'red;}</style>' }).head).not.toContain('red;}');
  });
});
