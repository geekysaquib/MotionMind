import React from 'react';
import { spring } from 'remotion';
import { Camera, Vec3, cameraTransform, clamp01, easeInOutCubic, lerp, pts, shade, toScreen } from './iso';
import { C, Pill, box, rand, shadow, tree, windowsOnHouse, type Item } from './World';
import type { IsoScene, PropKind, TimedBeat, Tone } from './script';

// ---------- layout: one persistent world for the whole reel ----------

export interface PlacedProp {
  id: string;
  kind: PropKind;
  pos: Vec3;
  /** Frame at which the prop first appears (the start of the first scene that uses it). */
  appearsAt: number;
}

const SPACING = 6.5;

/**
 * Gives every distinct prop a fixed spot along a gentle zig-zag, in the order the scenes first use them,
 * so the camera can glide from one part of the world to the next like in the train reel.
 */
export function layoutProps(timed: TimedBeat[]): Map<string, PlacedProp> {
  const placed = new Map<string, PlacedProp>();
  for (const b of timed) {
    for (const p of b.scene?.props ?? []) {
      if (placed.has(p.id)) continue;
      const i = placed.size;
      placed.set(p.id, { id: p.id, kind: p.kind, pos: { x: i * SPACING, y: i % 2 === 0 ? -2.2 : 2.2, z: 0 }, appearsAt: b.start });
    }
  }
  return placed;
}

function sceneCameraKey(scene: IsoScene | undefined, placed: Map<string, PlacedProp>, fallback: { x: number; y: number; zoom: number }) {
  const ps = (scene?.props ?? []).map((p) => placed.get(p.id)).filter((p): p is PlacedProp => Boolean(p));
  if (!ps.length) return fallback;
  const xs = ps.map((p) => p.pos.x);
  const ys = ps.map((p) => p.pos.y);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  // Screen spread of the props (isometric x-y), so a lone prop is a close-up and a chain is a wide shot.
  const spread = Math.max(4, Math.max(...xs) - Math.min(...xs) + Math.abs(Math.max(...ys) - Math.min(...ys)) + 4);
  return { x: cx, y: cy, zoom: Math.max(34, Math.min(95, 1250 / spread)) };
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
  const drift = 1 + 0.04 * clamp01((f - beat.start) / beat.frames);
  const endPull = frame >= storyFrames ? 1 - 0.1 * clamp01((frame - storyFrames) / 60) : 1;
  return {
    target: { x: lerp(prev.x, cur.x, t), y: lerp(prev.y, cur.y, t), z: 1.2 },
    zoom: lerp(prev.zoom, cur.zoom, t) * drift * endPull,
    cx: 540,
    cy: 1160,
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
export const PROP_TOP: Record<PropKind, number> = {
  phone: 2.1, laptop: 1.5, tower: 6.0, server: 2.4, cloud: 4.4, bank: 3.2, shop: 2.4, building: 4.6, house: 2.6, factory: 3.6,
  person: 2.1, document: 0.6, money: 1.0, chip: 0.7, car: 1.4, satellite: 6.6,
};

function propItems(p: PlacedProp, accent: string, frame: number): Item[] {
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
}

export const IsoWorld: React.FC<IsoWorldProps> = ({ frame, fps, cam, beat, placed }) => {
  const accent = TONE[beat.card.tone] ?? C.teal;
  const scene = beat.scene;
  const inScene = new Set((scene?.props ?? []).map((p) => p.id));
  const focusId = scene?.focus ?? scene?.props[0]?.id;
  const local = frame - beat.start;
  const props = [...placed.values()];
  const maxX = Math.max(30, ...props.map((p) => p.pos.x)) + 12;

  const items: Item[] = [];
  // Background town: houses and trees away from the props, so the world never looks empty.
  for (const d of DECOR) {
    if (d.x > maxX) continue;
    if (props.some((p) => Math.abs(p.pos.x - d.x) < 3 && Math.abs(p.pos.y - d.y) < 3.2)) continue;
    if (d.i % 3 === 0) items.push(tree(`dt${d.i}`, d.x, d.y, 0.7 + rand(d.i) * 0.4));
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
    const its = propItems({ ...p, pos: { ...p.pos, z: 0 } }, inScene.has(p.id) ? accent : '#B8BCC6', frame);
    items.push(
      ...its.map((it, j) => ({
        depth: it.depth + 0.0001 * j,
        el: (
          <g key={`${p.id}-${j}`} transform={`translate(0 ${-lift})`} opacity={clamp01(drop * 1.6) * (inScene.has(p.id) || !scene ? 1 : 0.55)}>
            {it.el}
          </g>
        ),
      })),
    );
  }
  items.sort((a, b) => a.depth - b.depth);

  // Ground slab with a soft road along the path.
  const slab = { x: -10, y: -10, w: maxX + 14, d: 20 };
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
    return p ? toScreen({ ...p.pos, z: PROP_TOP[p.kind] + 0.3 }, cam) : null;
  };

  return (
    <>
      <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <linearGradient id="isofade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={C.bg} stopOpacity="1" />
            <stop offset="0.3" stopColor={C.bg} stopOpacity="0" />
            <stop offset="0.86" stopColor={C.bg} stopOpacity="0" />
            <stop offset="1" stopColor={C.bg} stopOpacity="0.9" />
          </linearGradient>
        </defs>
        <rect width={1080} height={1920} fill={C.water} />
        <g transform={cameraTransform(cam)}>
          <polygon points={pts(front)} fill={C.waterDeep} />
          <polygon points={pts(ground)} fill={C.ground} stroke={C.outline} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
          <polygon points={pts(road)} fill={C.ballast} />
          {/* Pulse: a glowing pad under the focus prop */}
          {scene?.effect === 'pulse' && focusId && placed.get(focusId) && (() => {
            const f = placed.get(focusId)!.pos;
            const g = 1.6 + Math.sin(frame / 8) * 0.25;
            return <polygon points={pts([{ x: f.x - g, y: f.y - g, z: 0.02 }, { x: f.x + g, y: f.y - g, z: 0.02 }, { x: f.x + g, y: f.y + g, z: 0.02 }, { x: f.x - g, y: f.y + g, z: 0.02 }])} fill={accent} opacity={0.25} />;
          })()}
          {items.map((it) => it.el)}
        </g>
        <rect width={1080} height={1920} fill="url(#isofade)" />
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
          const A = { ...a.pos, z: PROP_TOP[a.kind] * 0.7 };
          const B = { ...b.pos, z: PROP_TOP[b.kind] * 0.7 };
          const N = 24;
          const pt = (t: number) => toScreen({ x: lerp(A.x, B.x, t), y: lerp(A.y, B.y, t), z: lerp(A.z, B.z, t) + Math.sin(Math.PI * t) * 2.2 }, cam);
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
      {/* Labels: constant size, above the scene's props */}
      {(scene?.props ?? []).map((sp, i) => {
        const at = top(sp.id);
        if (!at || !sp.label) return null;
        const s = spring({ frame: local - 10 - i * 6, fps, config: { damping: 14 } });
        return <Pill key={`lb${sp.id}`} x={at[0]} y={at[1] - 8} text={sp.label} tone={sp.id === focusId ? accent : '#B8BCC6'} scale={s} />;
      })}
      {(scene?.links ?? []).map((l, i) => {
        if (!l.label) return null;
        const a = placed.get(l.from);
        const b = placed.get(l.to);
        if (!a || !b) return null;
        const mid = toScreen({ x: (a.pos.x + b.pos.x) / 2, y: (a.pos.y + b.pos.y) / 2, z: (PROP_TOP[a.kind] + PROP_TOP[b.kind]) * 0.35 + 2.4 }, cam);
        const s = spring({ frame: local - 22 - i * 10, fps, config: { damping: 14 } });
        return <Pill key={`ll${i}`} x={mid[0]} y={mid[1]} text={l.label} tone={accent} scale={s * 0.9} />;
      })}
    </>
  );
};
