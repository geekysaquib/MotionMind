import React from 'react';
import { spring } from 'remotion';
import { Camera, Vec3, cameraTransform, clamp01, easeInOutCubic, lerp, project, pts, shade, toScreen } from './iso';
import { EXTRA_TOP, extraItems, type ExtraKind } from './props3d';
import { MORE_TOP, moreItems, type MoreKind } from './props3d-more';
import { TECH_TOP, techItems, type TechKind } from './props3d-tech';
import { declutter, pillWidth, type LabelBox } from './declutter';
import { GLYPH_TOP, glyphItems, hasGlyph, logoItems } from './glyph';
import { bareDomain, logoUrl } from './terms';
import { C, Pill, box, rand, shadow, tree, windowsOnHouse, type Item } from './World';
import type { IsoScene, PropKind, PropShape, ScenePropSpec, TimedBeat, Tone, WorldTheme } from './script';

// ---------- layout: one persistent world for the whole reel ----------

export interface PlacedProp {
  id: string;
  kind: PropKind;
  pos: Vec3;
  /** How it looks: label, icon and, for custom objects, shape and colour (from the first scene that uses it). */
  spec: ScenePropSpec;
  /** Frame at which the prop first appears (the start of the first scene that uses it). */
  appearsAt: number;
}

/** Half the width (x) and depth (y) an object takes on the ground, in world units, so neighbours can be kept apart. */
const FOOT: Partial<Record<string, [number, number]>> = {
  train: [2.9, 0.9], plane: [2.5, 2.2], ship: [2.1, 1.3], bus: [1.6, 0.8], truck: [1.5, 0.8], car: [1.1, 0.7], bank: [1.5, 1.2], factory: [1.4, 1.0], school: [1.5, 1.0], hospital: [1.2, 0.9],
  solar: [1.4, 0.9], chart: [1.4, 0.9], router: [1.1, 0.7], laptop: [1.0, 0.7], money: [0.9, 0.6], document: [0.7, 0.9], cart: [1.1, 0.7], book: [1.0, 0.8], camera: [0.9, 0.6], envelope: [1.0, 0.7],
  tower: [0.6, 0.6], windmill: [0.7, 0.7], phone: [0.5, 0.4], person: [0.4, 0.4], rocket: [0.9, 0.9], gear: [1.2, 1.2], flame: [0.9, 0.5], atm: [0.9, 0.6], speaker: [0.7, 0.6], tree: [1.0, 0.8],
};

/** Big vehicles are drawn a little smaller, so a scene with several of them does not need a huge camera pull-back. */
export const KIND_SCALE: Partial<Record<string, number>> = { train: 0.78, plane: 0.78, ship: 0.82, bus: 0.88, truck: 0.88 };

/** Ground footprint (half-extents) of a placed object, as drawn. */
export function footprint(kind: string, spec?: ScenePropSpec): [number, number] {
  const sc = KIND_SCALE[kind] ?? 1;
  const f = rawFootprint(kind, spec);
  return [f[0] * sc, f[1] * sc];
}

function rawFootprint(kind: string, spec?: ScenePropSpec): [number, number] {
  if (kind === 'custom') {
    if (hasGlyph(spec?.glyph) || spec?.logo) return [1.2, 0.7];
    return ({ block: [1.0, 1.0], tall: [0.7, 0.7], wide: [1.5, 1.0], flat: [1.4, 1.4], round: [1.0, 1.0] } as Record<string, [number, number]>)[spec?.shape ?? 'block'] ?? [1.0, 1.0];
  }
  return FOOT[kind] ?? [1.0, 0.9];
}

const GAP = 1.5;
/** Objects that appear in the same scene sit a little closer, so the camera does not have to pull back so far. */
const GAP_TOGETHER = 0.8;
const GRID = 0.8;

/**
 * Gives every distinct prop a fixed spot, so the camera can glide from one part of the world to the next.
 * Each new prop goes on the closest free spot to the props it shares its first scene with (a little further along the
 * story's direction), where its real footprint, plus a gap, does not touch any prop already placed.
 */
export function layoutProps(timed: TimedBeat[], locked?: Record<string, { x: number; y: number }>): Map<string, PlacedProp> {
  const placed = new Map<string, PlacedProp>();
  const feet = new Map<string, [number, number]>();
  let last: Vec3 | null = null;
  for (const b of timed) {
    const specs = b.scene?.props ?? [];
    for (const sp of specs) {
      const have = placed.get(sp.id);
      // A later scene can add the icon, shape or colour the first one left out.
      if (have) have.spec = { ...have.spec, icon: have.spec.icon ?? sp.icon, glyph: have.spec.glyph ?? sp.glyph, logo: have.spec.logo ?? sp.logo, shape: have.spec.shape ?? sp.shape, tone: have.spec.tone ?? sp.tone };
    }
    const known = specs.map((sp) => placed.get(sp.id)).filter((q): q is PlacedProp => Boolean(q));
    const anchor: { x: number; y: number } = known.length
      ? { x: known.reduce((n, q) => n + q.pos.x, 0) / known.length, y: known.reduce((n, q) => n + q.pos.y, 0) / known.length }
      : { x: last ? last.x + 6 : 0, y: 0 };
    const together = new Set(specs.map((sp) => sp.id));
    for (const sp of specs) {
      if (placed.has(sp.id)) continue;
      const f = footprint(sp.kind, sp);
      const fixed = locked?.[sp.id];
      if (fixed && Number.isFinite(fixed.x) && Number.isFinite(fixed.y)) {
        // A locked object keeps its spot; the others are arranged around it.
        const pos: Vec3 = { x: fixed.x, y: fixed.y, z: 0 };
        feet.set(sp.id, f);
        placed.set(sp.id, { id: sp.id, kind: sp.kind, spec: sp, pos, appearsAt: b.start });
        last = pos;
        continue;
      }
      let best: { x: number; y: number } = { x: anchor.x, y: anchor.y };
      let bestCost = Infinity;
      for (let cx = anchor.x - 16; cx <= anchor.x + 16; cx += GRID) {
        for (let cy = -6; cy <= 6; cy += GRID) {
          let free = true;
          for (const [id, q] of placed) {
            const g = feet.get(id)!;
            const gap = together.has(id) ? GAP_TOGETHER : GAP;
            if (Math.abs(q.pos.x - cx) < g[0] + f[0] + gap && Math.abs(q.pos.y - cy) < g[1] + f[1] + gap) {
              free = false;
              break;
            }
          }
          if (!free) continue;
          const dx = cx - anchor.x;
          const dy = cy - anchor.y;
          const cost = dx * dx * 0.8 + dy * dy * 1.2 + (dx < 0 && placed.size > 0 ? 3 : 0) + (cx < 0 ? 4 : 0);
          if (cost < bestCost - 1e-9) {
            bestCost = cost;
            best = { x: cx, y: cy };
          }
        }
      }
      const pos: Vec3 = { x: best.x, y: best.y, z: 0 };
      feet.set(sp.id, f);
      placed.set(sp.id, { id: sp.id, kind: sp.kind, spec: sp, pos, appearsAt: b.start });
      last = pos;
    }
  }
  return placed;
}

/** The part of the 1080x1920 frame that is clear of the title card (top) and the captions (bottom). */
const SAFE = { left: 110, right: 970, top: 600, bottom: 1480 };
const CAM_CY = (SAFE.top + SAFE.bottom) / 2;
const COS30 = Math.cos(Math.PI / 6);

/**
 * Frames a scene so ALL of its objects (with their icons and labels) fit inside the safe area:
 * the zoom comes from the real projected bounds, not a guess from distances.
 */
function sceneCameraKey(scene: IsoScene | undefined, placed: Map<string, PlacedProp>, fallback: { x: number; y: number; zoom: number }, safe = SAFE, zoomMax = 80) {
  const ps = (scene?.props ?? []).map((p) => placed.get(p.id)).filter((p): p is PlacedProp => Boolean(p));
  if (!ps.length) return fallback;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of ps) {
    // Room for the icon and label above the object, and for the arcs and their labels when the scene has links.
    const top = propTop(p) + (p.spec.icon && !hasGlyph(p.spec.glyph) && !p.spec.logo ? 3.0 : 1.9) + (scene?.links?.length ? 1.6 : 0);
    const [fx, fy] = footprint(p.kind, p.spec);
    for (const [dx, dy, z] of [[-fx, -fy, 0], [fx, fy, 0], [-fx, fy, 0], [fx, -fy, 0], [0, 0, top]] as const) {
      const [px, py] = project({ x: p.pos.x + dx, y: p.pos.y + dy, z });
      minX = Math.min(minX, px);
      maxX = Math.max(maxX, px);
      minY = Math.min(minY, py);
      maxY = Math.max(maxY, py);
    }
  }
  const w = Math.max(1, maxX - minX);
  const h = Math.max(1, maxY - minY);
  const zoom = Math.max(26, Math.min(zoomMax, (safe.right - safe.left) / w, (safe.bottom - safe.top) / h));
  // Invert project() at z = 1.2 to find the world point that sits at the middle of the bounds.
  const sum = 2 * ((minY + maxY) / 2 + 1.2); // x + y
  const diff = (minX + maxX) / 2 / COS30; // x - y
  return { x: (sum + diff) / 2, y: (sum - diff) / 2, zoom };
}

/** A rectangle of the frame, in pixels. */
export interface Region {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** A camera that fits all of one scene's objects, with their labels, inside `region` (used for covers). */
export function frameScene(scene: IsoScene | undefined, placed: Map<string, PlacedProp>, region: Region, zoomMax = 110): Camera {
  const k = sceneCameraKey(scene, placed, { x: 0, y: 0, zoom: 50 }, region, zoomMax);
  return { target: { x: k.x, y: k.y, z: 1.2 }, zoom: k.zoom, cx: (region.left + region.right) / 2, cy: (region.top + region.bottom) / 2 };
}

/** The colour the world fades into at its edges for a theme (so text panels can match it). */
export function themeFade(theme: WorldTheme | undefined): string {
  return (THEMES[theme ?? 'city'] ?? THEMES.city).fade;
}

/** Camera for the iso world: holds on each scene's props and eases to the next scene's. */
export function isoCamera(timed: TimedBeat[], placed: Map<string, PlacedProp>, storyFrames: number, frame: number): Camera {
  const f = Math.min(frame, storyFrames - 1);
  const i = Math.max(0, timed.findIndex((b) => f >= b.start && f < b.start + b.frames));
  const keys: { x: number; y: number; zoom: number }[] = [];
  let last = { x: 0, y: 0, zoom: 50 };
  for (const b of timed) {
    last = sceneCameraKey(b.scene, placed, last);
    keys.push(last);
  }
  const beat = timed[i]!;
  const cur = keys[i]!;
  const prev = i > 0 ? keys[i - 1]! : cur;
  const t = easeInOutCubic(clamp01((f - beat.start) / 36));
  const drift = 1 + 0.03 * clamp01((f - beat.start) / beat.frames);
  const endPull = frame >= storyFrames ? 1 - 0.1 * clamp01((frame - storyFrames) / 60) : 1;
  return {
    target: { x: lerp(prev.x, cur.x, t), y: lerp(prev.y, cur.y, t), z: 1.2 },
    zoom: lerp(prev.zoom, cur.zoom, t) * drift * endPull,
    cx: 540,
    cy: CAM_CY,
  };
}

// ---------- prop models (world units; ~2 units across) ----------

const TONE: Record<Tone, string> = { red: C.red, teal: C.teal, purple: C.purple, blue: C.blue, amber: C.amber };

/** Like shade(), but returns hex: box() shades its colour again and only understands hex. */
function hexShade(hex: string, amount: number): string {
  const m = shade(hex, amount).match(/\d+/g) ?? ['0', '0', '0'];
  return `#${m.map((v) => Number(v).toString(16).padStart(2, '0')).join('')}`;
}

function flat(key: string, points: Vec3[], fill: string, depth: number, extra?: Partial<React.SVGProps<SVGPolygonElement>>): Item {
  return { depth, el: <polygon key={key} points={pts(points)} fill={fill} stroke={C.outline} strokeWidth={1} vectorEffect="non-scaling-stroke" {...extra} /> };
}

/** A disc lying flat or a ball, drawn as a projected ellipse/circle at a world point. */
function dot(key: string, p: Vec3, r: number, fill: string, depth: number): Item {
  const [x, y] = [(p.x - p.y) * Math.cos(Math.PI / 6), (p.x + p.y) * 0.5 - p.z];
  return { depth, el: <circle key={key} cx={x} cy={y} r={r} fill={fill} stroke={C.outline} strokeWidth={1} vectorEffect="non-scaling-stroke" /> };
}

/** The top of each kind, where labels and links attach. */
export const PROP_TOP: Partial<Record<PropKind, number>> = {
  phone: 2.1, laptop: 1.5, tower: 6.0, server: 2.4, cloud: 4.4, bank: 3.2, shop: 2.4, building: 4.6, house: 2.6, factory: 3.6,
  person: 2.1, document: 0.6, money: 1.0, chip: 0.7, car: 1.4, satellite: 6.6, custom: 2.4,
};

const SHAPE_TOP: Record<PropShape, number> = { block: 2.2, tall: 4.2, wide: 1.5, flat: 0.5, round: 2.7 };

/** Height of a prop: where its icon, label and links attach. */
export function propTop(p: PlacedProp): number {
  return rawTop(p) * (KIND_SCALE[p.kind] ?? 1);
}

function rawTop(p: PlacedProp): number {
  if (p.kind === 'custom' && (hasGlyph(p.spec.glyph) || p.spec.logo)) return GLYPH_TOP;
  if (p.kind === 'custom') return SHAPE_TOP[p.spec.shape ?? 'block'] ?? SHAPE_TOP.block;
  return PROP_TOP[p.kind as keyof typeof PROP_TOP] ?? EXTRA_TOP[p.kind as ExtraKind] ?? MORE_TOP[p.kind as MoreKind] ?? TECH_TOP[p.kind as TechKind] ?? SHAPE_TOP.block;
}

/**
 * How a link between two objects bends to get around the other objects near its straight line: sideways (dx, dy in
 * world units, at the middle of the arc, away from the blocker) and extra height. Zero when nothing is in the way.
 */
export function arcFor(a: PlacedProp, b: PlacedProp, all: PlacedProp[]): { dx: number; dy: number; lift: number } {
  const vx = b.pos.x - a.pos.x;
  const vy = b.pos.y - a.pos.y;
  const len = Math.hypot(vx, vy) || 1;
  let worst = 0;
  let side = 0;
  let lift = 0;
  for (const o of all) {
    if (o.id === a.id || o.id === b.id) continue;
    const t = ((o.pos.x - a.pos.x) * vx + (o.pos.y - a.pos.y) * vy) / (len * len);
    if (t < 0.12 || t > 0.88) continue;
    const cross = ((o.pos.x - a.pos.x) * vy - (o.pos.y - a.pos.y) * vx) / len; // signed distance from the line
    const f = footprint(o.kind, o.spec);
    const reach = Math.max(f[0], f[1]) + 0.6;
    if (Math.abs(cross) >= reach) continue;
    const need = Math.min(2.2, reach - Math.abs(cross) + 0.6);
    if (need > worst) {
      worst = need;
      side = cross >= 0 ? -1 : 1;
      lift = Math.max(0, propTop(o) - 1.5);
    }
  }
  if (!worst) return { dx: 0, dy: 0, lift: 0 };
  // Perpendicular to the link, pointing away from the blocker.
  return { dx: (-vy / len) * worst * side * -1, dy: (vx / len) * worst * side * -1, lift: Math.min(1.2, lift) };
}

/** Any object the named kinds can't draw: a body in the object's colour and shape; its emoji floats above it. */
function customItems(p: PlacedProp, accent: string, frame = 0, logoBase?: string): Item[] {
  if (p.spec.logo) {
    const name = (p.spec.label ?? bareDomain(p.spec.logo)).replace(/[^A-Za-z0-9]/g, '');
    return logoItems({ id: p.id, pos: p.pos, url: logoUrl(logoBase, p.spec.logo, p.spec.label), initials: name.slice(0, 4).toUpperCase(), tone: p.spec.tone ? (TONE[p.spec.tone] ?? accent) : accent }, frame);
  }
  if (hasGlyph(p.spec.glyph)) return glyphItems({ id: p.id, pos: p.pos, glyph: p.spec.glyph, tone: p.spec.tone ? (TONE[p.spec.tone] ?? accent) : accent }, frame);
  const { x, y } = p.pos;
  const k = p.id;
  const col = hexShade(p.spec.tone ? (TONE[p.spec.tone] ?? accent) : accent, 0.1);
  const out: Item[] = [shadow(`sh${k}`, x - 1.3, y - 1.3, 2.6, 2.6)];
  switch (p.spec.shape ?? 'block') {
    case 'tall':
      out.push(box(`cu${k}`, x - 0.6, y - 0.6, 0, 1.2, 1.2, 3.7, col, windowsOnHouse(x - 0.6, y - 0.6, 1.2, 1.2, 3.7)));
      out.push({ ...box(`cc${k}`, x - 0.78, y - 0.78, 3.7, 1.56, 1.56, 0.35, hexShade(col, -0.2)), depth: x + y + 0.3 });
      break;
    case 'wide':
      out.push(box(`cu${k}`, x - 1.4, y - 0.9, 0, 2.8, 1.8, 1.1, col, windowsOnHouse(x - 1.4, y - 0.9, 2.8, 1.8, 0.8)));
      out.push({ ...box(`cc${k}`, x - 1.5, y - 1.0, 1.1, 3.0, 2.0, 0.2, hexShade(col, -0.2)), depth: x + y + 0.3 });
      break;
    case 'flat':
      out.push(box(`cu${k}`, x - 1.4, y - 1.4, 0, 2.8, 2.8, 0.25, col));
      out.push({ ...box(`ci${k}`, x - 0.9, y - 0.9, 0.25, 1.8, 1.8, 0.12, hexShade(col, 0.35)), depth: x + y + 0.2 });
      break;
    case 'round':
      out.push(box(`cb${k}`, x - 0.6, y - 0.6, 0, 1.2, 1.2, 0.25, '#D5D9E0'));
      out.push(dot(`cu${k}`, { x, y, z: 1.55 }, 1.2, shade(col, 0), x + y + 0.5));
      out.push(dot(`ch${k}`, { x: x - 0.25, y: y - 0.25, z: 1.95 }, 0.45, shade(col, 0.45), x + y + 0.6));
      break;
    default:
      out.push(box(`cu${k}`, x - 0.85, y - 0.85, 0, 1.7, 1.7, 1.8, col, windowsOnHouse(x - 0.85, y - 0.85, 1.7, 1.7, 1.5)));
      out.push({ ...box(`cc${k}`, x - 1.0, y - 1.0, 1.8, 2.0, 2.0, 0.3, hexShade(col, -0.2)), depth: x + y + 0.3 });
  }
  return out;
}

function propItems(p: PlacedProp, accent: string, frame: number, logoBase?: string): Item[] {
  const { x, y } = p.pos;
  const k = p.id;
  const out: Item[] = [shadow(`sh${k}`, x - 1.1, y - 1.1, 2.2, 2.2)];
  switch (p.kind) {
    case 'phone': {
      const screen = [
        { x: x - 0.32, y: y + 0.16, z: 0.35 },
        { x: x + 0.32, y: y + 0.16, z: 0.35 },
        { x: x + 0.32, y: y + 0.16, z: 1.85 },
        { x: x - 0.32, y: y + 0.16, z: 1.85 },
      ];
      out.push(box(`ph${k}`, x - 0.42, y - 0.14, 0.2, 0.84, 0.3, 1.8, C.window, <polygon points={pts(screen)} fill={shade(accent, 0.35)} />));
      break;
    }
    case 'laptop': {
      out.push(box(`lb${k}`, x - 0.9, y - 0.5, 0.1, 1.8, 1.1, 0.12, '#D9DCE3'));
      const scr = [
        { x: x - 0.8, y: y - 0.5, z: 0.25 },
        { x: x + 0.8, y: y - 0.5, z: 0.25 },
        { x: x + 0.8, y: y - 0.5, z: 1.35 },
        { x: x - 0.8, y: y - 0.5, z: 1.35 },
      ];
      out.push(box(`ls${k}`, x - 0.9, y - 0.62, 0.2, 1.8, 0.1, 1.25, '#4A5366', <polygon points={pts(scr.map((q) => ({ ...q, y: q.y + 0.13 })))} fill={shade(accent, 0.4)} />));
      break;
    }
    case 'tower': {
      out.push(box(`tb${k}`, x - 0.45, y - 0.45, 0, 0.9, 0.9, 0.3, '#D5D9E0'));
      out.push(box(`tm${k}`, x - 0.12, y - 0.12, 0.3, 0.24, 0.24, 5.4, C.tower));
      [-0.32, 0.18].forEach((dx, i) => out.push({ ...box(`th${k}${i}`, x + dx, y + 0.18, 4.6, 0.14, 0.18, 0.75, C.towerHead), depth: x + y + 0.6 }));
      const blink = Math.floor(frame / 15) % 2 === 0 ? 1 : 0.35;
      out.push({ ...dot(`tl${k}`, { x, y, z: 5.85 }, 0.13, C.red, x + y + 0.7), el: <g key={`tlg${k}`} opacity={blink}>{dot(`tl${k}`, { x, y, z: 5.85 }, 0.13, C.red, 0).el}</g> });
      break;
    }
    case 'server': {
      for (let i = 0; i < 3; i++) {
        const z = 0.1 + i * 0.75;
        const led = [0, 1, 2].map((j) => (
          <polygon
            key={j}
            points={pts([
              { x: x - 0.5 + j * 0.22, y: y + 0.501, z: z + 0.25 },
              { x: x - 0.38 + j * 0.22, y: y + 0.501, z: z + 0.25 },
              { x: x - 0.38 + j * 0.22, y: y + 0.501, z: z + 0.38 },
              { x: x - 0.5 + j * 0.22, y: y + 0.501, z: z + 0.38 },
            ])}
            fill={(Math.floor(frame / 8) + i + j) % 3 === 0 ? accent : '#9AE6B4'}
          />
        ));
        out.push({ ...box(`sv${k}${i}`, x - 0.65, y - 0.5, z, 1.3, 1.0, 0.65, '#5B6477', <g>{led}</g>), depth: x + y + i * 0.01 });
      }
      break;
    }
    case 'cloud': {
      const z = 3.6;
      [
        [-0.6, 0, 0.6],
        [0.1, 0.1, 0.75],
        [0.75, 0, 0.55],
        [0.05, -0.4, 0.55],
      ].forEach(([dx, dz, r], i) => out.push(dot(`cl${k}${i}`, { x: x + dx!, y, z: z + dz! }, r!, i === 1 ? '#FFFFFF' : '#EEF4FB', x + y + 2 + i * 0.01)));
      break;
    }
    case 'bank': {
      out.push(box(`bb${k}`, x - 1.3, y - 1, 0, 2.6, 2, 0.3, '#E8E1D3'));
      for (const dx of [-1.05, -0.4, 0.25, 0.9]) out.push(box(`bc${k}${dx}`, x + dx, y + 0.65, 0.3, 0.22, 0.22, 1.9, '#F4F1EA'));
      out.push(box(`bw${k}`, x - 1.2, y - 0.9, 0.3, 2.4, 1.4, 1.9, '#DCD5C6'));
      out.push({ ...box(`br${k}`, x - 1.35, y - 1.05, 2.2, 2.7, 2.1, 0.25, '#CFC6B4'), depth: x + y + 0.3 });
      out.push(flat(`bp${k}`, [{ x: x - 1.35, y: y + 1.05, z: 2.45 }, { x: x + 1.35, y: y + 1.05, z: 2.45 }, { x, y: y + 1.05, z: 3.15 }], shade(accent, 0.2), x + y + 0.4));
      break;
    }
    case 'shop': {
      out.push(box(`sb${k}`, x - 1, y - 0.8, 0, 2, 1.6, 1.6, '#FBE7C6', windowsOnHouse(x - 1, y - 0.8, 2, 1.6, 1.2)));
      out.push({ ...box(`sa${k}`, x - 1.1, y + 0.6, 1.5, 2.2, 0.5, 0.12, accent), depth: x + y + 0.5 });
      out.push({ ...box(`sr${k}`, x - 1.05, y - 0.85, 1.6, 2.1, 1.7, 0.2, hexShade(accent, -0.1)), depth: x + y + 0.3 });
      break;
    }
    case 'building':
      out.push(box(`bd${k}`, x - 0.9, y - 0.9, 0, 1.8, 1.8, 4.4, '#A9CFF5', windowsOnHouse(x - 0.9, y - 0.9, 1.8, 1.8, 4.4)));
      break;
    case 'house': {
      out.push(box(`hb${k}`, x - 0.9, y - 0.8, 0, 1.8, 1.6, 1.4, '#FBD679', windowsOnHouse(x - 0.9, y - 0.8, 1.8, 1.6, 1.4)));
      out.push(flat(`hr${k}`, [{ x: x - 0.95, y: y + 0.85, z: 1.4 }, { x: x + 0.95, y: y + 0.85, z: 1.4 }, { x: x + 0.95, y, z: 2.4 }, { x: x - 0.95, y, z: 2.4 }], shade(accent, -0.05), x + y + 0.6));
      break;
    }
    case 'factory': {
      out.push(box(`fb${k}`, x - 1.2, y - 0.9, 0, 2.4, 1.8, 1.4, '#D5D9E0', windowsOnHouse(x - 1.2, y - 0.9, 2.4, 1.8, 1.4)));
      out.push({ ...box(`fc${k}`, x + 0.4, y - 0.6, 1.4, 0.4, 0.4, 2.0, '#B8BCC6'), depth: x + y + 0.3 });
      const puff = (frame % 60) / 60;
      out.push({ ...dot(`fs${k}`, { x: x + 0.6, y: y - 0.4, z: 3.6 + puff * 0.8 }, 0.3 + puff * 0.2, 'rgba(255,255,255,0.8)', x + y + 3) });
      break;
    }
    case 'person': {
      out.push(box(`pb${k}`, x - 0.28, y - 0.2, 0.05, 0.56, 0.4, 1.1, accent));
      out.push(dot(`ph${k}`, { x: x + 0.02, y: y + 0.02, z: 1.55 }, 0.3, '#F2C9A8', x + y + 0.5));
      break;
    }
    case 'document': {
      const top = 0.18;
      const lines = [0, 1, 2, 3].map((i) => (
        <polyline key={i} points={pts([{ x: x - 0.45, y: y - 0.55 + i * 0.3, z: top + 0.001 }, { x: x + 0.45 - (i === 3 ? 0.35 : 0), y: y - 0.55 + i * 0.3, z: top + 0.001 }])} stroke={shade(accent, -0.1)} strokeWidth={2} vectorEffect="non-scaling-stroke" />
      ));
      out.push(box(`dc${k}`, x - 0.65, y - 0.85, 0.08, 1.3, 1.7, 0.1, '#FFFFFF', <g>{lines}</g>));
      break;
    }
    case 'money': {
      for (let i = 0; i < 3; i++) out.push({ ...box(`mn${k}${i}`, x - 0.8, y - 0.45, 0.05 + i * 0.22, 1.6, 0.9, 0.18, '#8FD19E'), depth: x + y + i * 0.01 });
      out.push(dot(`mc${k}`, { x: x + 0.9, y: y + 0.6, z: 0.35 }, 0.32, '#FBD679', x + y + 0.8));
      break;
    }
    case 'chip': {
      out.push(box(`cp${k}`, x - 0.7, y - 0.7, 0.08, 1.4, 1.4, 0.22, '#2F3A4D'));
      out.push({ ...box(`cc${k}`, x - 0.35, y - 0.35, 0.3, 0.7, 0.7, 0.06, accent), depth: x + y + 0.2 });
      for (let i = 0; i < 4; i++) out.push({ ...box(`cpn${k}${i}`, x - 0.55 + i * 0.35, y + 0.7, 0.08, 0.12, 0.25, 0.06, '#C9CED8'), depth: x + y + 0.3 });
      break;
    }
    case 'car': {
      out.push(box(`cb${k}`, x - 1, y - 0.5, 0.25, 2, 1, 0.5, accent));
      out.push({ ...box(`ck${k}`, x - 0.5, y - 0.45, 0.75, 1, 0.9, 0.45, hexShade(accent, 0.25)), depth: x + y + 0.2 });
      for (const dx of [-0.6, 0.6]) out.push({ ...dot(`cw${k}${dx}`, { x: x + dx, y: y + 0.5, z: 0.22 }, 0.22, '#2F3A4D', x + y + 0.6) });
      break;
    }
    case 'satellite': {
      const bob = Math.sin(frame / 20) * 0.15;
      out.push({ ...box(`st${k}`, x - 0.3, y - 0.3, 5.6 + bob, 0.6, 0.6, 0.6, '#E5E7EB'), depth: x + y + 3 });
      for (const dx of [-1.5, 0.4]) out.push({ ...box(`sp${k}${dx}`, x + dx, y - 0.1, 5.8 + bob, 1.1, 0.2, 0.05, C.blue), depth: x + y + 3.1 });
      break;
    }
    default:
      return extraItems(p.kind, p, accent, frame) ?? moreItems(p.kind, p, accent, frame) ?? techItems(p.kind, p, accent, frame) ?? customItems(p, accent, frame, logoBase);
  }
  return out;
}

// ---------- the world ----------

const DECOR = Array.from({ length: 70 }, (_, i) => ({ x: -8 + rand(i + 900) * 120, y: (rand(i + 950) > 0.5 ? 1 : -1) * (5 + rand(i + 990) * 4), i }));

export interface IsoWorldProps {
  frame: number;
  fps: number;
  cam: Camera;
  beat: TimedBeat;
  placed: Map<string, PlacedProp>;
  /** The look of the ground and scenery. Defaults to the town. */
  theme?: WorldTheme;
  /** Where company logos are served from (see `logoUrl`). */
  logoBase?: string;
  /** Fade the top and bottom of the picture into the sky colour (the reel does, to make room for the card and captions). Default true. */
  fade?: boolean;
}

const EMOJI_FONT = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';

type Look = { ground: string; water: string; waterDeep: string; road: string | null; fade: string; scenery: 'town' | 'meadow' | 'rocks' | 'none'; grid?: string };

const THEMES: Record<WorldTheme, Look> = {
  city: { ground: C.ground, water: C.water, waterDeep: C.waterDeep, road: C.ballast, fade: C.bg, scenery: 'town' },
  nature: { ground: '#E4F0D2', water: '#BFE0F2', waterDeep: '#9CCBE6', road: '#D9E6C3', fade: '#F1F7E8', scenery: 'meadow' },
  lab: { ground: '#EEF0F8', water: '#DCE1F2', waterDeep: '#BCC5E3', road: null, fade: '#F4F6FC', scenery: 'none', grid: 'rgba(59,130,246,0.14)' },
  plain: { ground: '#F3EFE6', water: '#E8EBF2', waterDeep: '#CFD5E2', road: null, fade: '#F6F4EE', scenery: 'none' },
  night: { ground: '#2B3350', water: '#151A30', waterDeep: '#0D1124', road: '#3A4466', fade: '#10142A', scenery: 'town', grid: 'rgba(129,140,248,0.16)' },
  sunset: { ground: '#FBE4D3', water: '#F8C2B2', waterDeep: '#EE9C8C', road: '#F2C9B5', fade: '#FFEFE6', scenery: 'town' },
  ocean: { ground: '#DDF1F7', water: '#7CC4E8', waterDeep: '#4FA3D1', road: null, fade: '#E3F4FC', scenery: 'none' },
  desert: { ground: '#F3DFB5', water: '#F4E6C6', waterDeep: '#E2C791', road: '#E8CE9B', fade: '#FBF1DA', scenery: 'rocks' },
};

export const IsoWorld: React.FC<IsoWorldProps> = ({ frame, fps, cam, beat, placed, theme = 'city', fade = true, logoBase }) => {
  const look = THEMES[theme] ?? THEMES.city;
  const accent = TONE[beat.card.tone] ?? C.teal;
  const scene = beat.scene;
  const inScene = new Set((scene?.props ?? []).map((p) => p.id));
  const focusId = scene?.focus ?? scene?.props[0]?.id;
  const local = frame - beat.start;
  const props = [...placed.values()];
  const maxX = Math.max(30, ...props.map((p) => p.pos.x)) + 12;

  const items: Item[] = [];
  // Scenery away from the props, so the world never looks empty: a town, a meadow, or nothing at all.
  for (const d of look.scenery === 'none' ? [] : DECOR) {
    if (d.x > maxX) continue;
    if (props.some((p) => Math.abs(p.pos.x - d.x) < 3.4 && Math.abs(p.pos.y - d.y) < 3.6)) continue;
    if (look.scenery === 'rocks') {
      items.push(dot(`rk${d.i}`, { x: d.x, y: d.y, z: 0.35 }, 0.45 + rand(d.i) * 0.45, d.i % 3 ? '#D9B77C' : '#C49A5B', d.x + d.y + 0.3));
    } else if (look.scenery === 'meadow') {
      if (d.i % 4 === 0) items.push(dot(`rk${d.i}`, { x: d.x, y: d.y, z: 0.3 }, 0.38 + rand(d.i) * 0.2, '#C9CED8', d.x + d.y + 0.3));
      else items.push(tree(`dt${d.i}`, d.x, d.y, 0.8 + rand(d.i) * 0.7));
    } else if (d.i % 3 === 0) items.push(tree(`dt${d.i}`, d.x, d.y, 0.7 + rand(d.i) * 0.4));
    else {
      const h = 0.8 + rand(d.i + 5) * 1.6;
      items.push(shadow(`ds${d.i}`, d.x, d.y, 1.4, 1.3));
      items.push(box(`dh${d.i}`, d.x, d.y, 0, 1.4, 1.3, h, C.houses[d.i % C.houses.length]!, windowsOnHouse(d.x, d.y, 1.4, 1.3, h)));
    }
  }
  // Props drop in the first time a scene uses them.
  for (const p of props) {
    if (frame < p.appearsAt) continue;
    const drop = spring({ frame: frame - p.appearsAt - 4, fps, config: { damping: 13, mass: 0.7 } });
    const lift = (1 - drop) * 3;
    const its = propItems({ ...p, pos: { ...p.pos, z: 0 } }, inScene.has(p.id) ? accent : '#B8BCC6', frame, logoBase);
    const sc = KIND_SCALE[p.kind] ?? 1;
    const [bx, by] = project({ ...p.pos, z: 0 });
    const scaleAbout = sc === 1 ? '' : ` translate(${bx} ${by}) scale(${sc}) translate(${-bx} ${-by})`;
    items.push(
      ...its.map((it, j) => ({
        depth: it.depth + 0.0001 * j,
        el: (
          <g key={`${p.id}-${j}`} transform={`translate(0 ${-lift})${scaleAbout}`} opacity={clamp01(drop * 1.6) * (inScene.has(p.id) || !scene ? 1 : 0.55)}>
            {it.el}
          </g>
        ),
      })),
    );
  }
  items.sort((a, b) => a.depth - b.depth);

  // Ground slab with a soft road along the path.
  // The ground always reaches past every object (with its footprint and a margin), so nothing hangs over the edge,
  // however many objects a scene has or wherever the user dragged them.
  const reach = props.map((p) => ({ p, f: footprint(p.kind, p.spec) }));
  const x0 = Math.min(-10, ...reach.map(({ p, f }) => p.pos.x - f[0] - 6));
  const x1 = Math.max(maxX + 4, ...reach.map(({ p, f }) => p.pos.x + f[0] + 6));
  const y0 = Math.min(-10, ...reach.map(({ p, f }) => p.pos.y - f[1] - 6));
  const y1 = Math.max(10, ...reach.map(({ p, f }) => p.pos.y + f[1] + 6));
  const slab = { x: x0, y: y0, w: x1 - x0, d: y1 - y0 };
  const ground = [
    { x: slab.x, y: slab.y, z: 0 },
    { x: slab.x + slab.w, y: slab.y, z: 0 },
    { x: slab.x + slab.w, y: slab.y + slab.d, z: 0 },
    { x: slab.x, y: slab.y + slab.d, z: 0 },
  ];
  const front = ground.slice(2).concat([{ ...ground[3]!, z: -1 }, { ...ground[2]!, z: -1 }]).reverse();
  const road = [
    { x: slab.x, y: -0.8, z: 0.01 },
    { x: slab.x + slab.w, y: -0.8, z: 0.01 },
    { x: slab.x + slab.w, y: 0.8, z: 0.01 },
    { x: slab.x, y: 0.8, z: 0.01 },
  ];

  const top = (id: string): [number, number] | null => {
    const p = placed.get(id);
    return p ? toScreen({ ...p.pos, z: propTop(p) + 0.3 }, cam) : null;
  };

  // Where every label goes, with overlaps resolved (prop labels first, then the labels on links).
  const props0 = [...placed.values()];
  const lay = (() => {
    const props = (scene?.props ?? []).map((sp) => {
      const pp = placed.get(sp.id);
      if (!pp) return null;
      const icon = hasGlyph(pp.spec.glyph) || pp.spec.logo ? undefined : pp.spec.icon;
      const at = toScreen({ ...pp.pos, z: propTop(pp) + (icon ? 1.2 : 0.3) }, cam);
      const cx = Math.max(150, Math.min(930, at[0]));
      return { id: sp.id, icon, at, cx, y: at[1] - (icon ? 58 : 8), dy: 0, w: pillWidth(sp.label ?? '') };
    });
    const links: { index: number; x: number; y: number; dy: number; w: number }[] = [];
    (scene?.links ?? []).forEach((l, index) => {
      if (!l.label) return;
      const a = placed.get(l.from);
      const b = placed.get(l.to);
      if (!a || !b) return;
      const n = scene?.links?.length ?? 1;
      const t = n > 1 ? [0.5, 0.3, 0.7, 0.4][index % 4]! : 0.5;
      const arc = arcFor(a, b, props0.filter((q) => inScene.has(q.id)));
      const w = Math.sin(Math.PI * t);
      const mid = toScreen({ x: lerp(a.pos.x, b.pos.x, t) + arc.dx * w, y: lerp(a.pos.y, b.pos.y, t) + arc.dy * w, z: lerp(propTop(a) * 0.7, propTop(b) * 0.7, t) + w * (2.2 + arc.lift) + 0.9 }, cam);
      links.push({ index, x: mid[0], y: mid[1], dy: 0, w: pillWidth(l.label) });
    });
    const boxes: LabelBox[] = [
      ...props.flatMap((e) => (e && scene!.props.find((p) => p.id === e.id)?.label ? [{ id: `p${e.id}`, x: e.cx, y: e.y, w: e.w }] : [])),
      ...links.map((e) => ({ id: `l${e.index}`, x: e.x, y: e.y, w: e.w })),
    ];
    const shift = declutter(boxes);
    props.forEach((e) => e && (e.dy = shift.get(`p${e.id}`) ?? 0));
    links.forEach((e) => (e.dy = shift.get(`l${e.index}`) ?? 0));
    return { props: props as ({ id: string; icon: string | undefined; at: [number, number]; cx: number; y: number; dy: number; w: number } | null)[], links };
  })();

  return (
    <>
      <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <linearGradient id="isofade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={look.fade} stopOpacity="1" />
            <stop offset="0.3" stopColor={look.fade} stopOpacity="0" />
            <stop offset="0.86" stopColor={look.fade} stopOpacity="0" />
            <stop offset="1" stopColor={look.fade} stopOpacity="0.9" />
          </linearGradient>
        </defs>
        <rect width={1080} height={1920} fill={look.water} />
        <g transform={cameraTransform(cam)}>
          <polygon points={pts(front)} fill={look.waterDeep} />
          <polygon points={pts(ground)} fill={look.ground} stroke={C.outline} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
          {look.road && <polygon points={pts(road)} fill={look.road} />}
          {look.grid &&
            Array.from({ length: Math.ceil(slab.w / 3) + 1 }, (_, g) => (
              <polyline key={`gx${g}`} points={pts([{ x: slab.x + g * 3, y: slab.y, z: 0.02 }, { x: slab.x + g * 3, y: slab.y + slab.d, z: 0.02 }])} fill="none" stroke={look.grid} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
            ))}
          {look.grid &&
            Array.from({ length: 7 }, (_, g) => (
              <polyline key={`gy${g}`} points={pts([{ x: slab.x, y: slab.y + g * 3.4, z: 0.02 }, { x: slab.x + slab.w, y: slab.y + g * 3.4, z: 0.02 }])} fill="none" stroke={look.grid} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
            ))}
          {/* Pulse: a glowing pad under the focus prop */}
          {scene?.effect === 'pulse' && focusId && placed.get(focusId) && (() => {
            const f = placed.get(focusId)!.pos;
            const g = 1.6 + Math.sin(frame / 8) * 0.25;
            return <polygon points={pts([{ x: f.x - g, y: f.y - g, z: 0.02 }, { x: f.x + g, y: f.y - g, z: 0.02 }, { x: f.x + g, y: f.y + g, z: 0.02 }, { x: f.x - g, y: f.y + g, z: 0.02 }])} fill={accent} opacity={0.25} />;
          })()}
          {items.map((it) => it.el)}
        </g>
        {fade && <rect width={1080} height={1920} fill="url(#isofade)" />}
        {/* Signal rings from the focus prop */}
        {scene?.effect === 'rings' && focusId && (() => {
          const at = top(focusId);
          if (!at) return null;
          return (
            <g>
              {[0, 1, 2].map((i) => {
                const t = ((frame + i * 20) % 60) / 60;
                return <circle key={i} cx={at[0]} cy={at[1]} r={20 + t * cam.zoom * 2.4} fill="none" stroke={accent} strokeWidth={4} opacity={(1 - t) * clamp01(local / 10)} />;
              })}
            </g>
          );
        })()}
        {/* Links: an arc that draws on, with a packet travelling along it */}
        {(scene?.links ?? []).map((l, i) => {
          const a = placed.get(l.from);
          const b = placed.get(l.to);
          if (!a || !b) return null;
          const grow = spring({ frame: local - 12 - i * 10, fps, config: { damping: 200 } });
          const A = { ...a.pos, z: propTop(a) * 0.7 };
          const B = { ...b.pos, z: propTop(b) * 0.7 };
          const N = 24;
          const arc = arcFor(a, b, props.filter((q) => inScene.has(q.id)));
          const pt = (t: number) => toScreen({ x: lerp(A.x, B.x, t) + arc.dx * Math.sin(Math.PI * t), y: lerp(A.y, B.y, t) + arc.dy * Math.sin(Math.PI * t), z: lerp(A.z, B.z, t) + Math.sin(Math.PI * t) * (2.2 + arc.lift) }, cam);
          const path = Array.from({ length: Math.max(2, Math.round(N * grow)) }, (_, j) => pt((j / (N - 1)) * grow));
          const loop = 2 * fps;
          const pk = pt(((local + i * 13) % loop) / loop);
          return (
            <g key={`ln${i}`}>
              <polyline points={path.map(([x, y]) => `${x},${y}`).join(' ')} fill="none" stroke={accent} strokeWidth={6} strokeDasharray="14 10" strokeDashoffset={-frame * 2} strokeLinecap="round" />
              {grow > 0.98 && <circle cx={pk[0]} cy={pk[1]} r={11} fill={accent} stroke="#fff" strokeWidth={4} />}
            </g>
          );
        })}
      </svg>
      {/* Icons and labels: constant size, above the scene's props and kept inside the frame; labels never overlap */}
      {(scene?.props ?? []).map((sp, i) => {
        const e = lay.props[i];
        if (!e) return null;
        const pop = spring({ frame: local - 10 - i * 6, fps, config: { damping: 14 } });
        const bob = Math.sin((frame + i * 9) / 14) * 6;
        return (
          <React.Fragment key={`lb${sp.id}`}>
            {e.icon && (
              <div
                style={{
                  position: 'absolute',
                  left: e.cx,
                  top: e.at[1] + bob,
                  transform: `translate(-50%, -50%) scale(${pop})`,
                  fontSize: 92,
                  lineHeight: 1,
                  fontFamily: EMOJI_FONT,
                  filter: 'drop-shadow(0 8px 8px rgba(31,36,48,0.28))',
                }}
              >
                {e.icon}
              </div>
            )}
            {sp.label && <Pill x={e.cx} y={e.y - e.dy} text={sp.label} tone={sp.id === focusId ? accent : '#B8BCC6'} scale={pop} />}
          </React.Fragment>
        );
      })}
      {lay.links.map((e, i) => {
        const l = scene!.links![e.index]!;
        const s = spring({ frame: local - 22 - i * 10, fps, config: { damping: 14 } });
        return <Pill key={`ll${e.index}`} x={e.x} y={e.y - e.dy} text={l.label!} tone={accent} scale={s * 0.9} />;
      })}
    </>
  );
};
