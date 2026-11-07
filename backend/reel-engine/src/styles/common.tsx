import React, { useEffect, useState } from 'react';
import { continueRender, delayRender, Easing, interpolate, spring } from 'remotion';
import type { Brand, CaptionStyle, CardRow, ReelSpec, TimedBeat, Tone } from '../script';
import { brandsFor, logoUrl, termsFor, type BrandRef, type Term } from '../terms';

// Pieces every style shares: what a beat contains, timing helpers, caption chunks and the safe areas of the frame.

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);
export const easeOut = Easing.out(Easing.cubic);
/** 0..1 over [from, from + len] frames, eased. */
export const ramp = (f: number, from: number, len: number, ease: (t: number) => number = easeOut) => ease(clamp01((f - from) / Math.max(1, len)));
/** A spring that starts at `delay` frames into the scene. */
export const pop = (f: number, fps: number, delay = 0, damping = 14, stiffness = 160) => spring({ frame: f - delay, fps, config: { damping, stiffness } });
/** Deterministic randomness: same seed, same number, so every render of a frame is identical. */
export const rnd = (seed: number) => {
  const x = Math.sin(seed * 9301.17 + 49297.3) * 233280;
  return x - Math.floor(x);
};
export const fade = (f: number, a: number, b: number, from = 0, to = 1) => interpolate(f, [a, b], [from, to], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

/** A headline split into plain and *highlighted* parts. */
export function parts(text: string): { text: string; hi: boolean }[] {
  return text
    .split(/(\*[^*]+\*)/g)
    .filter(Boolean)
    .map((p) => (p.startsWith('*') && p.endsWith('*') && p.length > 2 ? { text: p.slice(1, -1), hi: true } : { text: p, hi: false }));
}
export const plain = (text: string) => text.replace(/\*/g, '');

export type Stat = { label: string; value: string; tone?: Tone };
export type Chip = { text: string; tone?: Tone; strike?: boolean };

/** What a beat puts on screen, sorted by kind. Each style draws the same content in its own way. */
export interface BeatContent {
  /** The main picture of the scene, chosen from its rows. */
  lead: 'flow' | 'stats' | 'chips' | 'note' | 'headline';
  flow: string[];
  stats: Stat[];
  chips: Chip[];
  notes: string[];
  /** The headline asks a question (a hook). */
  question: boolean;
}

export function contentOf(beat: { card: { headline: string; rows?: CardRow[] } }): BeatContent {
  const rows = beat.card.rows ?? [];
  const flow = rows.flatMap((r) => (r.kind === 'flow' ? r.items : [])).filter(Boolean).slice(0, 6);
  const stats = rows.flatMap((r) => (r.kind === 'kv' ? [{ label: r.k, value: r.v, tone: r.tone }] : [])).slice(0, 3);
  const chips = rows.flatMap((r) => (r.kind === 'chips' ? r.items : [])).filter((c) => c.text?.trim()).slice(0, 5);
  const notes = rows.flatMap((r) => (r.kind === 'note' ? [r.text] : [])).filter(Boolean).slice(0, 2);
  const first = rows[0]?.kind;
  const lead: BeatContent['lead'] =
    first === 'flow' && flow.length >= 2 ? 'flow' : first === 'kv' && stats.length ? 'stats' : first === 'chips' && chips.length ? 'chips' : flow.length >= 2 ? 'flow' : stats.length ? 'stats' : chips.length ? 'chips' : notes.length ? 'note' : 'headline';
  return { lead, flow, stats, chips, notes, question: /\?\s*$/.test(plain(beat.card.headline).trim()) };
}

/** A value like "25,000", "1.8x" or "₹2,000 cr" split so its number can count up. Null when it holds no number. */
export function splitNumber(v: string): { pre: string; num: number; decimals: number; post: string; commas: boolean } | null {
  const m = /^(.*?)(\d[\d,]*(?:\.\d+)?)(.*)$/.exec(v.trim());
  if (!m) return null;
  const raw = m[2]!;
  // Long digit runs without commas are codes (an ID, a phone number), not amounts.
  if (!raw.includes(',') && !raw.includes('.') && raw.length > 7) return null;
  const num = Number(raw.replace(/,/g, ''));
  if (!Number.isFinite(num)) return null;
  return { pre: m[1]!, num, decimals: raw.includes('.') ? raw.split('.')[1]!.length : 0, post: m[3]!, commas: raw.includes(',') };
}

/** The value as it reads part-way through counting up (t = 0..1). */
export function countText(v: string, t: number): string {
  const n = splitNumber(v);
  if (!n) return v;
  const cur = n.num * easeOut(clamp01(t));
  const fixed = cur.toFixed(n.decimals);
  const shown = n.commas ? Number(fixed).toLocaleString('en-IN', { minimumFractionDigits: n.decimals, maximumFractionDigits: n.decimals }) : fixed;
  return `${n.pre}${shown}${n.post}`;
}

export type Word = TimedBeat['words'][number];

/** Words grouped into short caption lines: at most `max` words, broken after punctuation. */
export function captionChunks(words: Word[], max = 4): Word[][] {
  const out: Word[][] = [];
  let cur: Word[] = [];
  for (const w of words) {
    cur.push(w);
    if (cur.length >= max || (cur.length >= 2 && /[,.?:!।]$/.test(w.text))) {
      out.push(cur);
      cur = [];
    }
  }
  if (cur.length) {
    const last = out[out.length - 1];
    if (cur.length === 1 && last && last.length < max + 1) last.push(cur[0]!);
    else out.push(cur);
  }
  return out;
}

/** The caption line showing at `frame`, or null between lines. */
export function chunkAt(beat: TimedBeat, frame: number, max = 4): { words: Word[]; since: number } | null {
  const chunks = captionChunks(beat.words, max);
  if (!chunks.length) return null;
  const idx = chunks.findIndex((_c, i) => frame < (chunks[i + 1]?.[0]!.start ?? Infinity));
  const chunk = chunks[Math.max(0, idx)]!;
  if (frame < chunk[0]!.start - 4) return null;
  return { words: chunk, since: frame - chunk[0]!.start };
}

/** Is this caption word a keyword (highlighted)? */
export const isKey = (beat: TimedBeat, w: string) => {
  const bare = w.toLowerCase().replace(/[^\p{L}\p{N}-]/gu, '');
  return beat.keywords.some((k) => k.toLowerCase().replace(/[^\p{L}\p{N}-]/gu, '') === bare && bare.length > 0);
};
export const cleanWord = (w: string) => w.replace(/[,.:;]$/, '');

/** Where things go on a 1080x1920 frame, per platform (Shorts has a taller top bar and a bigger bottom area). */
export interface Zones {
  /** Top of the headline area. */
  head: number;
  /** Top and bottom of the area for the scene's picture. */
  top: number;
  bottom: number;
  /** Top of the captions. */
  caption: number;
}
export function zonesFor(platform: ReelSpec['platform'], captions: CaptionStyle): Zones {
  const yt = platform === 'youtube';
  const z: Zones = yt ? { head: 190, top: 700, bottom: 1330, caption: 1400 } : { head: 110, top: 640, bottom: 1440, caption: 1520 };
  if (captions.position === 'middle') z.caption = yt ? 1180 : 1240;
  return z;
}
export const captionScale = (c: CaptionStyle) => (c.size === 'small' ? 0.82 : c.size === 'large' ? 1.2 : 1);

/** Everything a style's scene needs to draw one frame. */
export interface SceneProps {
  frame: number;
  fps: number;
  spec: ReelSpec;
  timed: TimedBeat[];
  beat: TimedBeat;
  index: number;
  storyFrames: number;
  zones: Zones;
  captions: CaptionStyle;
  /** Cover pictures: leave out the scene's own headline (the cover draws its own text). */
  bare?: boolean;
}

/** A style: how its world, captions and end card look. */
export interface StyleKit {
  Stage: React.FC<SceneProps>;
  Captions: React.FC<SceneProps>;
  EndCard: React.FC<{ frame: number; fps: number; brand: Brand; platform?: ReelSpec['platform'] }>;
  /** Colours and font for text the app draws on top (the cover's headline). */
  palette: { bg: string; ink: string; accent: string; panel: string; font: string; hiBg: string; hiInk: string };
}

/** The beat's short forms and companies (with logo URLs), as every style shows them. */
export function extrasOf(beat: TimedBeat, spec: ReelSpec): { terms: Term[]; logos: (BrandRef & { url: string })[] } {
  return {
    terms: termsFor(beat, spec.glossary),
    logos: brandsFor(beat, spec.brands).map((b) => ({ ...b, url: logoUrl(spec.logoBase, b.domain, b.name) })),
  };
}

/** Every logo a reel shows, so they can be loaded before drawing. */
export function logoUrlsOf(spec: Pick<ReelSpec, 'brands' | 'logoBase'>): string[] {
  return [...new Set((spec.brands ?? []).map((b) => logoUrl(spec.logoBase, b.domain, b.name)))];
}

/** Holds the render until every company logo has loaded (a missing one is skipped, never an error). */
export function useLogosLoaded(urls: string[]) {
  const key = urls.join('|');
  const [handle] = useState(() => (urls.length ? delayRender('Loading company logos') : null));
  useEffect(() => {
    if (handle === null) return;
    let left = urls.length;
    const done = () => {
      left -= 1;
      if (left <= 0) continueRender(handle);
    };
    const timer = setTimeout(() => continueRender(handle), 8000);
    for (const u of urls) {
      const img = new Image();
      img.onload = done;
      img.onerror = done;
      img.src = u;
    }
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

/** The step name for a beat's chapter (chapter 0 = the intro). */
export const stepName = (spec: ReelSpec, chapter: number) => (chapter > 0 ? spec.steps[chapter - 1] ?? '' : '');

/** The closing line of the end card, in the reel's language. */
export const ctaFor = (platform: ReelSpec['platform']) => (platform === 'youtube' ? { big: 'Subscribe karo', small: 'Aisi aur kahaaniyan' } : { big: 'Follow karo', small: 'Aisi aur kahaaniyan' });

/** A company logo; hidden when it can't be loaded (never a broken-image icon). */
export const Logo: React.FC<{ src: string; style?: React.CSSProperties }> = ({ src, style }) => (
  <img src={src} style={style} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
);

/** The biggest font size (up to `base`) at which a one-line value fits `width` px (0.6 em per character on average). */
export const fitSize = (text: string, base: number, width: number) => Math.min(base, Math.floor(width / (Math.max(1, [...text].length) * 0.6)));
