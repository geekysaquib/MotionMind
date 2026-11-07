import React from 'react';
import { icons } from 'lucide-react';
import type { SceneVisual, TimedBeat, Tone, VisualElement } from '../script';
import { clamp01, countText, easeOut, Logo, parts, rnd } from './common';
import { logoUrl } from '../terms';

// The scene composer: draws the pieces Claude placed in a scene (cards, phones, queues, numbers, stamps,
// arrows...) inside an area of the frame. What the pieces look like comes from the style's skin, so the
// same scene is hand-drawn on the whiteboard, a dark UI panel on the keynote stage, and so on.

export type Pt = { x: number; y: number };
export type Area = { l: number; t: number; r: number; b: number };

export interface Skin {
  font: string;
  mono: string;
  /** Main text, secondary text, the accent, and how a *highlighted* word looks. */
  ink: string;
  sub: string;
  accent: string;
  hiInk: string;
  hiBg: string;
  tone: (t?: Tone) => string;
  /** The box every piece sits in: a style for the box, and anything drawn over it (a hand-drawn outline). */
  panel: (o: { w: number; h: number; k: number; color: string; focus: boolean; seed: number; frame: number; round?: number }) => { style: React.CSSProperties; overlay?: React.ReactNode };
  /** How a piece comes in, for k going 0 to 1. */
  enter: (k: number, seed: number) => React.CSSProperties;
  /** An arrow between two pieces, drawn on as k goes 0 to 1, with a packet travelling once it is drawn. */
  Link: React.FC<{ a: Pt; b: Pt; k: number; frame: number; label?: string; dashed?: boolean; color: string; seed: number }>;
}

const FPS = 30;

/** A Lucide icon by its kebab-case name ('train-front'), or null when there is no such icon. */
export function iconFor(name: string | undefined): React.FC<{ size?: number; color?: string; strokeWidth?: number }> | null {
  if (!name) return null;
  const pascal = name
    .trim()
    .toLowerCase()
    .split(/[-_\s]+/)
    .map((p) => (p ? p[0]!.toUpperCase() + p.slice(1) : ''))
    .join('');
  return ((icons as Record<string, unknown>)[pascal] as React.FC<{ size?: number; color?: string; strokeWidth?: number }>) ?? null;
}

/** Default size (px) of each kind of piece in a 1000 px wide area. */
const SIZE: Record<VisualElement['kind'], (el: VisualElement) => { w: number; h: number }> = {
  card: (el) => ({ w: 560, h: el.sub ? 190 : 150 }),
  phone: () => ({ w: 400, h: 740 }),
  window: (el) => ({ w: 880, h: 150 + Math.min(6, el.items?.length ?? 2) * 78 }),
  code: (el) => ({ w: 940, h: 120 + Math.min(8, el.items?.length ?? 3) * 66 }),
  number: () => ({ w: 760, h: 300 }),
  list: (el) => ({ w: 900, h: 70 + Math.min(6, el.items?.length ?? 3) * 108 }),
  bars: (el) => ({ w: 920, h: 90 + Math.min(6, el.items?.length ?? 3) * 112 }),
  ring: () => ({ w: 420, h: 500 }),
  queue: () => ({ w: 980, h: 240 }),
  stamp: () => ({ w: 680, h: 210 }),
  logo: () => ({ w: 300, h: 300 }),
  text: (el) => ({ w: 940, h: (el.label ?? '').length > 40 ? 280 : 190 }),
};

type Placed = { el: VisualElement; x: number; y: number; w: number; h: number; appear: number; i: number };

const clean = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

/** The frame a piece appears on: when its word is spoken, at its time, or one after the other. */
export function appearFrame(beat: TimedBeat, el: { on?: string; at?: number }, i: number): number {
  if (el.on) {
    const target = clean(el.on.split(/\s+/)[0] ?? '');
    const w = target ? beat.words.find((x) => clean(x.text).startsWith(target) || (target.length > 3 && clean(x.text).includes(target))) : undefined;
    if (w) return Math.max(beat.start, w.start - 4);
  }
  if (typeof el.at === 'number' && Number.isFinite(el.at)) return beat.start + Math.round(Math.max(0, el.at) * FPS);
  return beat.start + 8 + i * 12;
}

/** Where every piece goes, in pixels, kept inside the area. Pieces without a position are stacked top to bottom. */
export function placeElements(visual: SceneVisual, area: Area, beat: TimedBeat): Placed[] {
  // Pieces that would overlap are drawn smaller (down to 55%) until they don't.
  for (const shrink of [1, 0.9, 0.8, 0.7, 0.62, 0.55]) {
    const placed = layout(visual, area, beat, shrink);
    if (shrink === 0.55 || !overlaps(placed)) return placed;
  }
  return layout(visual, area, beat, 0.55);
}

function overlaps(ps: Placed[]): boolean {
  const solid = ps;
  for (let i = 0; i < solid.length; i++)
    for (let j = i + 1; j < solid.length; j++) {
      const a = solid[i]!;
      const b = solid[j]!;
      if (Math.abs(a.x - b.x) < (a.w + b.w) / 2 + 8 && Math.abs(a.y - b.y) < (a.h + b.h) / 2 + 8) return true;
    }
  return false;
}

function layout(visual: SceneVisual, area: Area, beat: TimedBeat, shrink: number): Placed[] {
  const W = area.r - area.l;
  const H = area.b - area.t;
  const els = visual.elements.slice(0, 8);
  const scale = Math.min(1.1, W / 980) * shrink;
  const auto = els.filter((e) => e.x == null || e.y == null);
  return els.map((el, i) => {
    const base = SIZE[el.kind]?.(el) ?? { w: 400, h: 140 };
    let w = el.w ? (el.w / 100) * W * Math.max(shrink, 0.85) : base.w * scale * (el.focus ? 1.12 : 1);
    let h = el.w ? base.h * (w / base.w) : base.h * scale * (el.focus ? 1.12 : 1);
    if (['card', 'list', 'bars', 'window', 'code', 'queue', 'text', 'stamp'].includes(el.kind) && el.w) h = base.h * scale;
    w = Math.min(w, W);
    h = Math.min(h, H);
    let cx: number;
    let cy: number;
    if (el.x != null && el.y != null) {
      cx = area.l + (Math.min(100, Math.max(0, el.x)) / 100) * W;
      cy = area.t + (Math.min(100, Math.max(0, el.y)) / 100) * H;
    } else {
      const k = auto.indexOf(el);
      cx = area.l + W / 2;
      cy = area.t + ((k + 0.5) / auto.length) * H;
    }
    // Keep the whole piece inside the area.
    cx = Math.min(area.r - w / 2, Math.max(area.l + w / 2, cx));
    cy = Math.min(area.b - h / 2, Math.max(area.t + h / 2, cy));
    return { el, x: cx, y: cy, w, h, appear: appearFrame(beat, el, i), i };
  });
}

/** Where the line from a box's centre towards a point leaves the box. */
function edge(p: Placed, toward: Pt, pad = 10): Pt {
  const dx = toward.x - p.x;
  const dy = toward.y - p.y;
  if (!dx && !dy) return { x: p.x, y: p.y };
  const sx = dx ? (p.w / 2 + pad) / Math.abs(dx) : Infinity;
  const sy = dy ? (p.h / 2 + pad) / Math.abs(dy) : Infinity;
  const s = Math.min(sx, sy, 1);
  return { x: p.x + dx * s, y: p.y + dy * s };
}

const Rich: React.FC<{ text: string; skin: Skin }> = ({ text, skin }) => (
  <>
    {parts(text).map((p, i) =>
      p.hi ? (
        <span key={i} style={{ color: skin.hiInk, background: skin.hiBg, padding: skin.hiBg === 'transparent' ? 0 : '0 6px', borderRadius: 6 }}>
          {p.text}
        </span>
      ) : (
        <span key={i}>{p.text}</span>
      ),
    )}
  </>
);

/** What goes inside each kind of piece. `t` = frames since it appeared. */
function Body({ p, skin, t, frame, logoBase }: { p: Placed; skin: Skin; t: number; frame: number; logoBase?: string }) {
  const { el, w, h } = p;
  const color = el.tone ? skin.tone(el.tone) : el.focus ? skin.accent : skin.tone(undefined);
  const base = SIZE[el.kind]?.(el) ?? { w: 560, h: 150 };
  const s = Math.max(0.8, w / base.w) * 1.3; // text scale
  const Icon = iconFor(el.icon);
  const label = el.label ?? '';
  const items = (el.items ?? []).slice(0, 8);
  switch (el.kind) {
    case 'card':
      return (
        <div style={{ display: 'flex', flexDirection: w < 380 ? 'column' : 'row', justifyContent: 'center', textAlign: w < 380 ? 'center' : 'left', alignItems: 'center', gap: 14 * s, height: '100%', padding: `0 ${18 * s}px` }}>
          {(Icon || el.logo) && (
            <div style={{ width: 76 * s, height: 76 * s, borderRadius: 18 * s, background: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {el.logo ? <Logo src={logoUrl(logoBase, el.logo, label)} style={{ width: 56 * s, height: 56 * s, objectFit: 'contain' }} /> : Icon && <Icon size={44 * s} color={color} strokeWidth={2.2} />}
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 38 * s, fontWeight: 800, color: skin.ink, lineHeight: 1.1 }}>
              <Rich text={label} skin={skin} />
            </div>
            {el.sub && <div style={{ fontSize: 25 * s, color: skin.sub, marginTop: 6 * s, lineHeight: 1.2 }}>{el.sub}</div>}
          </div>
        </div>
      );
    case 'phone':
    case 'window': {
      const phone = el.kind === 'phone';
      const fs = phone ? 30 * Math.max(0.8, w / 400) : 34 * Math.max(0.8, w / 880);
      return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: phone ? `${60 * (w / 400)}px ${22 * (w / 400)}px` : `${16 * s}px ${22 * s}px` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: fs * 1.1, fontWeight: 800, color: skin.ink, paddingBottom: 10, borderBottom: `2px solid ${skin.sub}33` }}>
            {Icon ? <Icon size={fs * 1.3} color={color} strokeWidth={2.2} /> : el.logo ? <Logo src={logoUrl(logoBase, el.logo, label)} style={{ width: fs * 1.4, height: fs * 1.4, objectFit: 'contain' }} /> : null}
            <Rich text={label} skin={skin} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
            {items.map((it, i) => {
              const k = clamp01((t - 8 - i * 9) / 8);
              const mine = phone && i % 2 === 1;
              return (
                <div key={i} style={{ alignSelf: mine ? 'flex-end' : 'stretch', opacity: k, transform: `translateY(${(1 - k) * 14}px)`, background: it.ok === false ? '#ff4a3d22' : it.ok ? `${color}22` : `${skin.sub}18`, color: skin.ink, borderRadius: 14, padding: '10px 14px', fontSize: fs, fontWeight: 600, lineHeight: 1.2 }}>
                  {it.ok === false ? '✕ ' : it.ok ? '✓ ' : ''}
                  {it.text}
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    case 'code': {
      const lines = items.length ? items : [{ text: label }];
      const typed = Math.max(0, t - 6) * 1.6; // characters per frame
      let used = 0;
      return (
        <div style={{ height: '100%', padding: `${18 * s}px ${24 * s}px`, fontFamily: skin.mono, fontSize: 31 * Math.max(0.8, w / 940), color: skin.ink }}>
          {label && items.length > 0 && <div style={{ color: skin.sub, marginBottom: 10 }}>{label}</div>}
          {lines.map((ln, i) => {
            const shown = Math.max(0, Math.min(ln.text.length, Math.floor(typed - used)));
            used += ln.text.length + 6;
            return (
              <div key={i} style={{ whiteSpace: 'pre', overflow: 'hidden', lineHeight: 1.7, color: ln.ok === false ? '#ff5a5f' : ln.ok ? color : skin.ink }}>
                <span style={{ color: skin.sub }}>{'> '}</span>
                {ln.text.slice(0, shown)}
                {shown < ln.text.length && shown > 0 && Math.floor(frame / 8) % 2 === 0 ? '▌' : ''}
              </div>
            );
          })}
        </div>
      );
    }
    case 'number': {
      const value = el.value ?? label;
      const size = Math.min(h * 0.55, w / (Math.max(3, [...value].length) * 0.58));
      return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: `0 ${26 * s}px` }}>
          {el.value && label && <div style={{ fontSize: 26 * Math.min(1.3, s), fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: skin.sub }}>{label}</div>}
          <div style={{ fontSize: size, fontWeight: 900, color, lineHeight: 1.05, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', letterSpacing: -size * 0.03 }}>{countText(value, clamp01((t - 4) / 30))}</div>
          {el.sub && <div style={{ fontSize: 24 * Math.min(1.3, s), color: skin.sub }}>{el.sub}</div>}
        </div>
      );
    }
    case 'list':
      return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 14, padding: `${16 * s}px ${26 * s}px` }}>
          {label && <div style={{ fontSize: 30 * Math.max(0.8, w / 900), fontWeight: 800, color: skin.sub, letterSpacing: 2, textTransform: 'uppercase' }}>{label}</div>}
          {items.map((it, i) => {
            const k = clamp01((t - 6 - i * 10) / 8);
            const mark = it.ok === false ? '✕' : it.ok ? '✓' : String(i + 1);
            const mc = it.ok === false ? '#ff4a3d' : it.ok ? '#16a34a' : color;
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 18, opacity: k, transform: `translateX(${(1 - k) * -30}px)` }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: `${mc}22`, color: mc, fontWeight: 900, fontSize: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{mark}</div>
                <div style={{ fontSize: 42 * Math.max(0.8, w / 900), fontWeight: 700, color: it.ok === false ? skin.sub : skin.ink, textDecoration: it.ok === false ? 'line-through' : undefined }}>{it.text}</div>
              </div>
            );
          })}
        </div>
      );
    case 'bars': {
      const max = Math.max(1, ...items.map((it) => it.value ?? 0));
      return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 16, padding: `${16 * s}px ${26 * s}px` }}>
          {label && <div style={{ fontSize: 30 * Math.max(0.8, w / 920), fontWeight: 800, color: skin.sub, letterSpacing: 2, textTransform: 'uppercase' }}>{label}</div>}
          {items.map((it, i) => {
            const k = easeOut(clamp01((t - 6 - i * 8) / 22));
            const frac = (it.value ?? 0) / max;
            return (
              <div key={i}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 34 * Math.max(0.8, w / 920), fontWeight: 700, color: skin.ink }}>
                  <span>{it.text}</span>
                  <span style={{ color: skin.sub }}>{it.value != null ? countText(String(it.value), k) : ''}</span>
                </div>
                <div style={{ height: 26, borderRadius: 13, background: `${skin.sub}22`, marginTop: 6 }}>
                  <div style={{ height: 26, borderRadius: 13, width: `${frac * k * 100}%`, background: i === 0 ? skin.accent : color }} />
                </div>
              </div>
            );
          })}
        </div>
      );
    }
    case 'ring': {
      const pct = Math.min(100, Math.max(0, parseFloat((el.value ?? '0').replace(/[^\d.]/g, '')) || 0));
      const k = easeOut(clamp01((t - 4) / 36));
      const R = Math.min(w, h - 60) * 0.4;
      const C = 2 * Math.PI * R;
      return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <svg width={R * 2 + 30} height={R * 2 + 30}>
            <circle cx={R + 15} cy={R + 15} r={R} fill="none" stroke={`${skin.sub}33`} strokeWidth={22} />
            <circle cx={R + 15} cy={R + 15} r={R} fill="none" stroke={color} strokeWidth={22} strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - (pct / 100) * k)} transform={`rotate(-90 ${R + 15} ${R + 15})`} />
            <text x={R + 15} y={R + 15 + R * 0.16} textAnchor="middle" fontFamily={skin.font} fontWeight={900} fontSize={R * 0.48} fill={skin.ink}>
              {Math.round(pct * k)}%
            </text>
          </svg>
          {label && <div style={{ fontSize: 36 * Math.max(0.8, w / 420), fontWeight: 800, color: skin.ink, marginTop: 8, textAlign: 'center' }}>{label}</div>}
        </div>
      );
    }
    case 'queue': {
      const n = items.length || Math.min(12, Math.max(4, parseInt(el.value ?? '8', 10) || 8));
      const tok = Math.min(90, (w - 160) / 8);
      return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: `0 ${22 * s}px`, overflow: 'hidden' }}>
          {label && <div style={{ fontSize: 32 * Math.max(0.8, w / 980), fontWeight: 800, color: skin.sub, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>{label}</div>}
          <div style={{ position: 'relative', height: tok + 10 }}>
            {Array.from({ length: n }, (_, i) => {
              // Tokens move towards the gate on the right and wrap round: a line that never ends.
              const x = ((i * (tok + 14) + t * 3.2) % (n * (tok + 14))) - tok;
              const it = items[i];
              return (
                <div key={i} style={{ position: 'absolute', left: x, top: 0, width: tok, height: tok, borderRadius: tok * 0.3, background: i % 5 === 0 ? skin.accent : `${color}cc`, color: '#fff', fontSize: tok * 0.3, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  {it ? it.text.slice(0, 4) : ''}
                </div>
              );
            })}
            <div style={{ position: 'absolute', right: 0, top: -8, width: 12, height: tok + 26, borderRadius: 6, background: skin.ink }} />
          </div>
        </div>
      );
    }
    case 'stamp': {
      const k = clamp01(t / 6);
      return (
        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `rotate(-6deg) scale(${1.6 - 0.6 * k})`, opacity: k }}>
          <div style={{ border: `${10 * s}px solid ${color}`, borderRadius: 18 * s, color, fontSize: Math.min(h * 0.5, w / Math.max(4, label.length * 0.62)), fontWeight: 900, letterSpacing: 4, padding: `${4 * s}px ${26 * s}px`, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{label}</div>
        </div>
      );
    }
    case 'logo':
      return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          {el.logo ? <Logo src={logoUrl(logoBase, el.logo, label)} style={{ width: w * 0.5, height: w * 0.5, objectFit: 'contain' }} /> : Icon && <Icon size={w * 0.45} color={color} />}
          {label && <div style={{ fontSize: 34 * Math.max(0.8, w / 300), fontWeight: 800, color: skin.ink, textAlign: 'center' }}>{label}</div>}
        </div>
      );
    case 'text':
    default:
      return (
        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 20px', fontSize: Math.min(h * 0.42, 74), fontWeight: 900, color: skin.ink, lineHeight: 1.1 }}>
          <span>
            <Rich text={label} skin={skin} />
            {el.sub && <div style={{ fontSize: 30, fontWeight: 600, color: skin.sub, marginTop: 10 }}>{el.sub}</div>}
          </span>
        </div>
      );
  }
}

/** Kinds drawn without a box around them. */
const BARE = new Set(['stamp', 'text']);

/** One scene as Claude designed it, drawn in a style. */
export const Composer: React.FC<{ visual: SceneVisual; beat: TimedBeat; frame: number; area: Area; skin: Skin; logoBase?: string }> = ({ visual, beat, frame, area, skin, logoBase }) => {
  const placed = placeElements(visual, area, beat);
  const byId = new Map(placed.map((p) => [p.el.id, p]));
  const links = (visual.links ?? []).flatMap((l, i) => {
    const a = byId.get(l.from);
    const b = byId.get(l.to);
    if (!a || !b || a === b) return [];
    const start = l.on ? appearFrame(beat, { on: l.on }, 0) : Math.max(a.appear, b.appear) + 6;
    return [{ l, a, b, start, i }];
  });
  return (
    <>
      <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        {links.map(({ l, a, b, start, i }) => {
          const k = clamp01((frame - start) / 14);
          if (k <= 0) return null;
          const pa = edge(a, b);
          const pb = edge(b, a);
          return <skin.Link key={`${l.from}-${l.to}-${i}`} a={pa} b={pb} k={k} frame={frame} label={l.label} dashed={l.dashed} color={skin.tone(b.el.tone)} seed={i + 1} />;
        })}
      </svg>
      {placed.map((p) => {
        const t = frame - p.appear;
        if (t < 0) return null;
        const k = clamp01(t / 12);
        const color = p.el.tone ? skin.tone(p.el.tone) : p.el.focus ? skin.accent : skin.tone(undefined);
        const panel = BARE.has(p.el.kind) ? { style: {} as React.CSSProperties } : skin.panel({ w: p.w, h: p.h, k, color, focus: !!p.el.focus, seed: p.i + Math.round(rnd(p.i) * 10), frame, round: p.el.kind === 'phone' ? 48 : undefined });
        return (
          <div key={p.el.id + p.i} style={{ position: 'absolute', left: p.x - p.w / 2, top: p.y - p.h / 2, width: p.w, height: p.h, fontFamily: skin.font, ...skin.enter(k, p.i) }}>
            <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...panel.style }}>
              <Body p={p} skin={skin} t={t} frame={frame} logoBase={logoBase} />
            </div>
            {panel.overlay}
          </div>
        );
      })}
    </>
  );
};
