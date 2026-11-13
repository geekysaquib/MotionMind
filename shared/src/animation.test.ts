import { describe, expect, it } from '@jest/globals';
import { AnimationError, END_CARD_SEC, extractAnimation, reelTimeline, timingKey } from './animation';
import { narrationKey } from './alignScript';
const beat = (id: string, narration: string) => ({ id, narration, keywords: [], chapter: 0, card: { eyebrow: '', headline: 'h', tone: 'teal' as const, rows: [] } });const SCRIPT = { beats: [beat('a', 'Subah dus baje Tatkal khulta hai.'), beat('b', 'Load balancer baant deta hai.')] };

const NARR = SCRIPT.beats.map((x) => x.narration);
const track = { path: 'p', fileName: 'v.mp3', mime: 'audio/mpeg', durationSec: 12 };
const HTML = '<!doctype html><html><head><script src="https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/gsap.min.js"></script></head><body><div id="root" data-composition-id="main" data-start="0" data-duration="9"></div><script>window.__timelines = window.__timelines || {}; window.__timelines["main"] = gsap.timeline({ paused: true });</script></body></html>';

describe('reelTimeline', () => {
  it('estimates the timing while there is no recording, then adds the 3 s end card', () => {
    const t = reelTimeline(SCRIPT);
    expect(t.source).toBe('estimate');
    expect(t.scenes[0]!.start).toBe(0);
    expect(t.scenes[1]!.start).toBeCloseTo(t.scenes[0]!.end);
    expect(t.duration).toBeCloseTo(t.storyEnd + END_CARD_SEC);
  });

  it("uses the user's own recording and its scene breaks, relative to the trimmed start", () => {
    const t = reelTimeline(SCRIPT, { upload: { track, cuts: [5.5], trimStart: 0.5 }, music: null });
    expect(t.source).toBe('recording');
    expect(t.scenes.map((s) => [s.start, s.end])).toEqual([
      [0, 5],
      [5, 11.5],
    ]);
    // Without a fit the words are spread over their scene.
    expect(t.scenes[0]!.words).toHaveLength(6);
  });

  it('puts every word where the auto-fit found it, shifted by the trim', () => {
    // Scene 1's words come before the break at 4.5 s of the file, scene 2's after it.
    const wordTimes = Array.from({ length: 11 }, (_, i) => { const t = i < 6 ? 1 + i * 0.5 : 5 + (i - 6) * 0.5; return [t, t + 0.4] as [number, number]; });
    const editor = { upload: { track, cuts: [4.5], trimStart: 0.5, wordTimes, fitKey: narrationKey(NARR) }, music: null };
    const t = reelTimeline(SCRIPT, editor);
    expect(t.scenes[0]!.words[0]).toEqual({ w: 'Subah', start: 0.5, end: 0.9 });
    expect(t.scenes[1]!.words[0]!.start).toBeCloseTo(4.5, 2);
    expect(t.scenes[1]!.words.length).toBe(5);
  });

  it('ignores a fit made for other words', () => {
    const wordTimes = Array.from({ length: 11 }, (_, i) => [1 + i * 0.5, 1.4 + i * 0.5] as [number, number]);
    const stale = { upload: { track, cuts: [4.5], wordTimes, fitKey: 'old' }, music: null };
    const t = reelTimeline(SCRIPT, stale);
    expect(t.scenes[0]!.words[0]!.start).toBeCloseTo(0.1);
  });

  it('ignores a recording whose breaks do not match the scenes', () => {
    expect(reelTimeline(SCRIPT, { upload: { track, cuts: [3, 6] }, music: null }).source).toBe('estimate');
  });

  it('changes its key when the timing changes', () => {
    expect(timingKey(reelTimeline(SCRIPT, { upload: { track, cuts: [5.5] }, music: null }))).not.toBe(timingKey(reelTimeline(SCRIPT)));
  });
});

describe('extractAnimation', () => {
  it("takes the HTML out of Claude's answer, with or without a code fence", () => {
    expect(extractAnimation(`Here it is:\n\`\`\`html\n${HTML}\n\`\`\`\nEnjoy!`)).toBe(HTML);
    expect(extractAnimation(HTML)).toBe(HTML);
  });

  it('refuses answers that break the HyperFrames rules or reach outside the page', () => {
    expect(() => extractAnimation('Sorry, I cannot.')).toThrow(AnimationError);
    expect(() => extractAnimation(HTML.replace('data-composition-id="main"', ''))).toThrow(/root element/);
    expect(() => extractAnimation(HTML.replace(/window\.__timelines/g, 'x'))).toThrow(/timeline/);
    expect(() => extractAnimation(HTML.replace('cdn.jsdelivr.net', 'evil.example.com'))).toThrow(/evil\.example\.com/);
    expect(() => extractAnimation(HTML.replace('</body>', '<script>fetch("https://x.example")</script></body>'))).toThrow(/network/);
    expect(() => extractAnimation(HTML.replace('</head>', '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter"></head>'))).not.toThrow();
  });

  it('marks the animation out of date when only the words inside a scene move', () => {
    const track = { path: 'p', fileName: 'v.mp3', mime: 'audio/mpeg', durationSec: 10, peaks: [] };
    const words = (shift: number) => NARR.join(' ').split(/\s+/).map((_, i) => [i * 0.5 + shift, i * 0.5 + 0.4 + shift] as [number, number]);
    const key = (shift: number) => timingKey(reelTimeline(SCRIPT, { upload: { track, cuts: [5.5], wordTimes: words(shift), fitKey: narrationKey(NARR) }, music: null }));
    expect(key(0)).toBe(key(0.02));
    expect(key(0)).not.toBe(key(0.5));
  });
});

describe('extractAnimation with a plan and a continuation', () => {
  const FULL = '<!doctype html><html><head><script src="https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/gsap.min.js"></script></head><body><div id="root" data-composition-id="main" data-start="0" data-duration="6"></div><script>window.__timelines = window.__timelines || {}; window.__timelines["main"] = gsap.timeline({ paused: true });</script></body></html>';
  it('ignores the plan before the code, and joins an answer that was cut off and continued', () => {
    const cut = FULL.indexOf('window.__timelines = ') + 12;
    const first = 'Plan: warm palette, two fonts.\n\n```html\n' + FULL.slice(0, cut);
    expect(() => extractAnimation(first)).toThrow(AnimationError);
    // Part one was cut off (no closing fence); part two is a new answer that starts with a fence.
    const joined = first + '\n```html\n' + FULL.slice(cut) + '\n```\n';
    expect(extractAnimation(joined)).toBe(FULL);
    expect(extractAnimation('Plan.\n\n```html\n' + FULL + '\n```\n')).toBe(FULL);
  });
});
