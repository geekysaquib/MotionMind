import { describe, expect, it } from '@jest/globals';
import { AnimationError, END_CARD_SEC, extractAnimation, reelTimeline, timingKey } from './animation';
import type { ReelVoice } from './projects';

const beat = (id: string, narration: string) => ({ id, narration, keywords: [], chapter: 0, card: { eyebrow: '', headline: 'h', tone: 'teal' as const, rows: [] } });
const SCRIPT = { beats: [beat('a', 'Subah dus baje Tatkal khulta hai.'), beat('b', 'Load balancer baant deta hai.')] };
const VOICE: ReelVoice = {
  voiceId: 'v',
  narrations: SCRIPT.beats.map((b) => b.narration),
  createdAt: 'now',
  beats: [
    { durationSec: 2, words: [0, 1, 2, 3, 4, 5].map((i) => ({ start: i * 0.3, end: i * 0.3 + 0.25 })) },
    { durationSec: 1.5, words: [0, 1, 2, 3, 4].map((i) => ({ start: i * 0.25, end: i * 0.25 + 0.2 })) },
  ],
};
const HTML = '<!doctype html><html><head><script src="https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/gsap.min.js"></script></head><body><div id="root" data-composition-id="main" data-start="0" data-duration="9"></div><script>window.__timelines = window.__timelines || {}; window.__timelines["main"] = gsap.timeline({ paused: true });</script></body></html>';

describe('reelTimeline', () => {
  it('times every scene and word from the generated voice, with a short gap, then the end card', () => {
    const t = reelTimeline(SCRIPT, VOICE);
    expect(t.source).toBe('voice');
    expect(t.scenes[0]).toMatchObject({ start: 0, end: 2.5 });
    expect(t.scenes[1]!.start).toBe(2.5);
    expect(t.scenes[0]!.words[0]).toEqual({ w: 'Subah', start: 0.15, end: 0.4 });
    expect(t.scenes[1]!.words[0]!.start).toBeCloseTo(2.65);
    expect(t.duration).toBeCloseTo(t.storyEnd + END_CARD_SEC);
  });

  it('estimates the timing without a voice, and ignores a voice made for other words', () => {
    expect(reelTimeline(SCRIPT).source).toBe('estimate');
    expect(reelTimeline(SCRIPT, { ...VOICE, narrations: ['old', 'lines'] }).source).toBe('estimate');
  });

  it("uses the user's own recording and its scene breaks", () => {
    const editor = { voiceSource: 'upload', upload: { track: { path: 'p', fileName: 'v.mp3', mime: 'audio/mpeg', durationSec: 12 }, cuts: [5.5], trimStart: 0.5 } } as never;
    const t = reelTimeline(SCRIPT, VOICE, editor);
    expect(t.source).toBe('recording');
    expect(t.scenes.map((s) => [s.start, s.end])).toEqual([
      [0, 5],
      [5, 11.5],
    ]);
  });

  it('changes its key when the timing changes', () => {
    expect(timingKey(reelTimeline(SCRIPT, VOICE))).not.toBe(timingKey(reelTimeline(SCRIPT)));
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
});
