import type { ReelEditor } from './editor';
import type { ReelScript, ReelVoice } from './projects';
import type { StyleId } from './styles';

// The reel's animation is written by Claude (in claude.ai, by copy and paste) as one HyperFrames HTML file:
// HTML, CSS and a paused GSAP timeline that the renderer seeks frame by frame. Motion Mind gives Claude the
// exact timing of every scene and word, and adds the voice when it renders.

/** Claude's animation, saved inside the script JSON (no migration). */
export interface ReelAnimation {
  html: string;
  /** The style it was written for. */
  style?: StyleId;
  /** The timing it was written against; when the voice changes, the animation is stale. */
  timingKey: string;
  writtenAt: string;
}

export interface SceneTiming {
  index: number;
  start: number;
  end: number;
  narration: string;
  /** Every spoken word with its start and end, in seconds from the start of the reel. */
  words: { w: string; start: number; end: number }[];
}

export interface ReelTimeline {
  scenes: SceneTiming[];
  /** When the story ends and the end card (follow / subscribe) starts. */
  storyEnd: number;
  /** Total length of the video, end card included. */
  duration: number;
  /** Where the timing comes from. */
  source: 'voice' | 'recording' | 'estimate';
}

const GAP = 0.35;
const LEAD = 0.15;
const WPS = 2.7;
export const END_CARD_SEC = 3;
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Narration words spread over [from, to] in proportion to their length. */
function spread(words: string[], from: number, to: number) {
  const weights = words.map((w) => Math.max(2, w.length) + (/[.?!।]$/.test(w) ? 4 : /[,;:]$/.test(w) ? 2 : 0));
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  let acc = 0;
  return words.map((w, i) => {
    const start = from + ((to - from) * acc) / total;
    acc += weights[i]!;
    return { w, start: r2(start), end: r2(from + ((to - from) * acc) / total) };
  });
}

/**
 * When every scene and word happens in the finished reel: from the generated voice (one clip per scene, played
 * one after another with a short gap), from the user's own recording and its scene breaks, or estimated from the
 * word count when there is no voice yet.
 */
export function reelTimeline(script: Pick<ReelScript, 'beats'>, voice?: ReelVoice | null, editor?: ReelEditor | null): ReelTimeline {
  const narr = script.beats.map((b) => b.narration);
  const matches = voice && voice.beats.length === script.beats.length && JSON.stringify(voice.narrations) === JSON.stringify(narr);
  const upload = editor?.voiceSource === 'upload' && editor.upload && editor.upload.cuts.length === script.beats.length - 1 ? editor.upload : null;
  const scenes: SceneTiming[] = [];
  let source: ReelTimeline['source'] = 'estimate';
  if (upload) {
    source = 'recording';
    const t0 = upload.trimStart ?? 0;
    const end = upload.closingAt ?? upload.trimEnd ?? upload.track.durationSec;
    const edges = [t0, ...upload.cuts, end].map((x) => x - t0);
    script.beats.forEach((b, i) => {
      const words = b.narration.split(/\s+/).filter(Boolean);
      scenes.push({ index: i, start: r2(edges[i]!), end: r2(edges[i + 1]!), narration: b.narration, words: spread(words, edges[i]! + 0.1, edges[i + 1]! - 0.15) });
    });
  } else {
    let t = 0;
    script.beats.forEach((b, i) => {
      const words = b.narration.split(/\s+/).filter(Boolean);
      const v = matches ? voice!.beats[i] : undefined;
      if (v) source = 'voice';
      const len = v ? v.durationSec + LEAD + GAP : words.length / WPS + 0.6;
      let timed: SceneTiming['words'];
      if (v && v.words.length) {
        // The voice's words (often in Devanagari) mapped onto the narration's words by position.
        const m = v.words.length;
        timed = words.map((w, j) => {
          const a = v.words[Math.min(m - 1, Math.floor((j * m) / words.length))]!;
          const z = v.words[Math.min(m - 1, Math.floor(((j + 1) * m) / words.length) - 1)] ?? a;
          return { w, start: r2(t + LEAD + a.start), end: r2(t + LEAD + Math.max(a.end, z.end)) };
        });
      } else timed = spread(words, t + LEAD, t + len - GAP);
      scenes.push({ index: i, start: r2(t), end: r2(t + len), narration: b.narration, words: timed });
      t += len;
    });
  }
  const storyEnd = scenes.length ? scenes[scenes.length - 1]!.end : 0;
  return { scenes, storyEnd, duration: r2(storyEnd + END_CARD_SEC), source };
}

/** A short fingerprint of the timing, to tell when the animation no longer matches the voice. */
export function timingKey(t: ReelTimeline): string {
  return [t.source, ...t.scenes.map((s) => `${s.start.toFixed(1)}-${s.end.toFixed(1)}`)].join('|');
}

/** Script sources the animation may load: GSAP and friends from public CDNs, and fonts. Nothing else. */
export const ALLOWED_SCRIPT_HOSTS = ['cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'unpkg.com'];
export const ALLOWED_STYLE_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net'];
export const MAX_ANIMATION_BYTES = 800_000;

export class AnimationError extends Error {}

/** Pulls the HTML document out of a chat answer (with or without a ```html fence) and checks the HyperFrames contract. */
export function extractAnimation(text: string): string {
  const fenced = /```(?:html)?\s*\n([\s\S]*?)```/i.exec(text);
  let html = (fenced ? fenced[1]! : text).trim();
  const start = html.search(/<!doctype html|<html/i);
  const end = html.toLowerCase().lastIndexOf('</html>');
  if (start < 0 || end < 0) throw new AnimationError("That doesn't look like the animation. Paste Claude's whole answer: the HTML from <!doctype html> to </html>.");
  html = html.slice(start, end + 7);
  if (html.length > MAX_ANIMATION_BYTES) throw new AnimationError('The animation is too big (over 800 KB). Ask Claude to draw with CSS and SVG instead of embedding images.');
  if (!/data-composition-id\s*=\s*["']main["']/.test(html)) throw new AnimationError('The animation is missing its root element (data-composition-id="main"). Ask Claude to follow the HyperFrames rules in the prompt.');
  if (!/window\.__timelines/.test(html)) throw new AnimationError('The animation does not register its timeline (window.__timelines["main"]). Ask Claude to follow the HyperFrames rules in the prompt.');
  for (const m of html.matchAll(/<script[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)) {
    const host = hostOf(m[1]!);
    if (!host || !ALLOWED_SCRIPT_HOSTS.includes(host)) throw new AnimationError(`The animation loads a script from ${host || m[1]}. Only GSAP from cdn.jsdelivr.net, cdnjs or unpkg is allowed.`);
  }
  for (const m of html.matchAll(/<link[^>]*\bhref\s*=\s*["']([^"']+)["']/gi)) {
    const host = hostOf(m[1]!);
    if (host && !ALLOWED_STYLE_HOSTS.includes(host)) throw new AnimationError(`The animation loads a file from ${host}. Only Google Fonts is allowed.`);
  }
  if (/\b(fetch|XMLHttpRequest|WebSocket|localStorage|document\.cookie)\b/.test(html)) throw new AnimationError('The animation tries to use the network or browser storage. Ask Claude to keep it to HTML, CSS, SVG and GSAP.');
  return html;
}

function hostOf(url: string): string | null {
  try {
    return new URL(url, 'https://local.invalid/').host.replace(/^local\.invalid$/, '') || null;
  } catch {
    return null;
  }
}
