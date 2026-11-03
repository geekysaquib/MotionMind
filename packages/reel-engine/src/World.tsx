import React from 'react';
import { Camera, Vec3, cameraTransform, pts, shade, toScreen, clamp01, lerp } from './iso';

// ---------- palette (Style Profile: "Pastel Isometric") ----------
export const C = {
  bg: '#F6F2E9',
  water: '#BFE0F2',
  waterDeep: '#9CCBE6',
  ground: '#F2EEE2',
  grass: '#DDEBCB',
  ballast: '#DCD4C4',
  sleeper: '#B9AA90',
  rail: '#7E8694',
  trainBody: '#F7F7F4',
  trainStripe: '#4C7CF0',
  trainNose: '#EF6A5B',
  window: '#2F3A4D',
  tower: '#C9CED8',
  towerHead: '#FFFFFF',
  red: '#E5484D',
  teal: '#14B8A6',
  purple: '#8B5CF6',
  blue: '#3B82F6',
  amber: '#F59E0B',
  ink: '#1F2430',
  outline: 'rgba(31,36,48,0.18)',
  houses: ['#FBD679', '#F7A08A', '#C4B5FD', '#A7E3C8', '#A9CFF5', '#FBC4A6'],
};

// ---------- world layout ----------
export const TOWERS = [
  { x: 6, id: '40468' },
  { x: 18, id: '40471' },
  { x: 30, id: '40474' },
  { x: 42, id: '40477' },
  { x: 54, id: '40480' },
].map((t) => ({ ...t, pos: { x: t.x, y: -3.4, z: 0 } }));

export const TOWER_TOP = 6.2;
const CAR_LEN = 2.2;
const CAR_GAP = 0.14;
const CARS = 4;
const TRAIN_SPEED = 0.8; // units per second
const TRAIN_START = 12;

export function trainHeadX(sec: number): number {
  return TRAIN_START + sec * TRAIN_SPEED;
}

/** The rider's phone sits in the second car. */
export function phonePos(sec: number): Vec3 {
  return { x: trainHeadX(sec) - (CAR_LEN + CAR_GAP) * 1.5, y: 0, z: 1.55 };
}

export function nearestTower(sec: number) {
  const p = phonePos(sec);
  return TOWERS.reduce((best, t) => (Math.abs(t.x - p.x) < Math.abs(best.x - p.x) ? t : best));
}

// Deterministic pseudo-random so every render is identical.
function rand(seed: number): number {
  const s = Math.sin(seed * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

const HOUSES = Array.from({ length: 26 }, (_, i) => {
  const side = i % 2 === 0 ? 1 : -1;
  const x = 1 + i * 2.5 + rand(i) * 1.2;
  const y = side > 0 ? 4.6 + rand(i + 50) * 3.5 : -6.2 - rand(i + 90) * 2.6;
  return {
    x,
    y,
    w: 1.4 + rand(i + 7) * 1.2,
    d: 1.4 + rand(i + 11) * 1.0,
    h: side > 0 ? 0.8 + rand(i + 3) * 1.1 : 1.2 + rand(i + 3) * 3.4,
    color: C.houses[i % C.houses.length],
  };
}).filter((h) => !TOWERS.some((t) => Math.abs(t.x - h.x) < 1.8 && h.y < 0));

const TREES = Array.from({ length: 40 }, (_, i) => ({
  x: rand(i + 300) * 62,
  y: rand(i + 400) > 0.5 ? 2.2 + rand(i + 500) * 1.4 : -1.8 - rand(i + 600) * 1.1,
  s: 0.6 + rand(i + 700) * 0.5,
})).filter((t) => !TOWERS.some((tw) => Math.abs(tw.x - t.x) < 1.2 && t.y < 0));

// ---------- primitives ----------
interface Item {
  depth: number;
  el: React.ReactNode;
}

function box(
  key: string,
  x: number,
  y: number,
  z: number,
  w: number,
  d: number,
  h: number,
  color: string,
  extra?: React.ReactNode,
  opacity = 1,
): Item {
  const top = [
    { x, y, z: z + h },
    { x: x + w, y, z: z + h },
    { x: x + w, y: y + d, z: z + h },
    { x, y: y + d, z: z + h },
  ];
  const left = [
    { x, y: y + d, z },
    { x: x + w, y: y + d, z },
    { x: x + w, y: y + d, z: z + h },
    { x, y: y + d, z: z + h },
  ];
  const right = [
    { x: x + w, y, z },
    { x: x + w, y: y + d, z },
    { x: x + w, y: y + d, z: z + h },
    { x: x + w, y, z: z + h },
  ];
  const stroke = { stroke: C.outline, strokeWidth: 1.2, vectorEffect: 'non-scaling-stroke' as const, strokeLinejoin: 'round' as const };
  return {
    depth: x + w / 2 + y + d / 2 + z * 0.05,
    el: (
      <g key={key} opacity={opacity}>
        <polygon points={pts(left)} fill={shade(color, -0.1)} {...stroke} />
        <polygon points={pts(right)} fill={shade(color, -0.22)} {...stroke} />
        <polygon points={pts(top)} fill={shade(color, 0.12)} {...stroke} />
        {extra}
      </g>
    ),
  };
}

function shadow(key: string, x: number, y: number, w: number, d: number): Item {
  const p = [
    { x: x + 0.15, y: y + 0.15, z: 0.01 },
    { x: x + w + 0.5, y: y + 0.15, z: 0.01 },
    { x: x + w + 0.5, y: y + d + 0.5, z: 0.01 },
    { x: x + 0.15, y: y + d + 0.5, z: 0.01 },
  ];
  return { depth: -1000, el: <polygon key={key} points={pts(p)} fill="rgba(60,70,60,0.10)" /> };
}

function windowsOnHouse(x: number, y: number, w: number, d: number, h: number) {
  const out: React.ReactNode[] = [];
  const rows = Math.max(1, Math.floor((h - 0.4) / 0.7));
  const cols = Math.max(1, Math.floor(w / 0.55));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const wx = x + 0.25 + c * 0.55;
      const wz = 0.35 + r * 0.7;
      const quad = [
        { x: wx, y: y + d + 0.001, z: wz },
        { x: wx + 0.28, y: y + d + 0.001, z: wz },
        { x: wx + 0.28, y: y + d + 0.001, z: wz + 0.34 },
        { x: wx, y: y + d + 0.001, z: wz + 0.34 },
      ];
      out.push(<polygon key={`w${r}-${c}`} points={pts(quad)} fill="rgba(255,255,255,0.75)" />);
    }
  }
  return <g>{out}</g>;
}

function tree(key: string, x: number, y: number, s: number): Item {
  const base = [
    { x: x - 0.45 * s, y, z: 0.2 },
    { x, y: y + 0.45 * s, z: 0.2 },
    { x: x + 0.45 * s, y, z: 0.2 },
  ];
  const tip = { x, y, z: 1.9 * s };
  return {
    depth: x + y + 0.2,
    el: (
      <g key={key}>
        <polygon points={pts([base[0], base[1], tip])} fill="#8FCB8F" stroke={C.outline} strokeWidth={1} vectorEffect="non-scaling-stroke" />
        <polygon points={pts([base[1], base[2], tip])} fill="#74B57A" stroke={C.outline} strokeWidth={1} vectorEffect="non-scaling-stroke" />
      </g>
    ),
  };
}

function towerItems(t: (typeof TOWERS)[number], active: boolean, frame: number): Item[] {
  const { x, y } = t.pos;
  const mast = box(`mast${t.id}`, x - 0.12, y - 0.12, 0.3, 0.24, 0.24, TOWER_TOP - 0.3, C.tower);
  const base = box(`tb${t.id}`, x - 0.45, y - 0.45, 0, 0.9, 0.9, 0.3, '#D5D9E0');
  const heads = [-0.32, 0.18].map((dx, i) =>
    box(`th${t.id}${i}`, x + dx, y + 0.18, TOWER_TOP - 1.1, 0.14, 0.18, 0.75, C.towerHead),
  );
  const blink = (Math.floor(frame / 15) % 2 === 0 ? 1 : 0.35) * (active ? 1 : 0.7);
  const [lx, ly] = [x, y].length ? [x, y] : [0, 0];
  const light: Item = {
    depth: mast.depth + 0.01,
    el: (
      <circle
        key={`tl${t.id}`}
        cx={(lx - ly) * Math.cos(Math.PI / 6)}
        cy={(lx + ly) * 0.5 - TOWER_TOP - 0.12}
        r={0.13}
        fill={C.red}
        opacity={blink}
      />
    ),
  };
  return [base, mast, ...heads.map((h) => ({ ...h, depth: mast.depth + 0.005 })), light];
}

function trainItems(sec: number): Item[] {
  const head = trainHeadX(sec);
  const items: Item[] = [];
  for (let i = 0; i < CARS; i++) {
    const x = head - (i + 1) * CAR_LEN - i * CAR_GAP;
    const y = -0.6;
    const d = 1.2;
    const z = 0.22;
    const h = 1.3;
    const stripe = [
      { x: x + 0.02, y: y + d + 0.002, z: z + 0.18 },
      { x: x + CAR_LEN - 0.02, y: y + d + 0.002, z: z + 0.18 },
      { x: x + CAR_LEN - 0.02, y: y + d + 0.002, z: z + 0.32 },
      { x: x + 0.02, y: y + d + 0.002, z: z + 0.32 },
    ];
    const wins: React.ReactNode[] = [];
    for (let k = 0; k < 4; k++) {
      const wx = x + 0.22 + k * 0.5;
      wins.push(
        <polygon
          key={k}
          points={pts([
            { x: wx, y: y + d + 0.002, z: z + 0.5 },
            { x: wx + 0.32, y: y + d + 0.002, z: z + 0.5 },
            { x: wx + 0.32, y: y + d + 0.002, z: z + 0.88 },
            { x: wx, y: y + d + 0.002, z: z + 0.88 },
          ])}
          fill={C.window}
          opacity={0.85}
        />,
      );
    }
    const extra = (
      <g>
        <polygon points={pts(stripe)} fill={i === 0 ? C.trainNose : C.trainStripe} />
        {wins}
      </g>
    );
    items.push(box(`car${i}`, x, y, z, CAR_LEN, d, h, C.trainBody, extra));
  }
  return items;
}

// ---------- static ground ----------
function Ground() {
  const water = [
    { x: -60, y: -40, z: -1.2 },
    { x: 130, y: -40, z: -1.2 },
    { x: 130, y: 40, z: -1.2 },
    { x: -60, y: 40, z: -1.2 },
  ];
  const slab = { x: -8, y: -11, w: 80, d: 22 };
  const top = [
    { x: slab.x, y: slab.y, z: 0 },
    { x: slab.x + slab.w, y: slab.y, z: 0 },
    { x: slab.x + slab.w, y: slab.y + slab.d, z: 0 },
    { x: slab.x, y: slab.y + slab.d, z: 0 },
  ];
  const front = [
    { x: slab.x, y: slab.y + slab.d, z: -1 },
    { x: slab.x + slab.w, y: slab.y + slab.d, z: -1 },
    { x: slab.x + slab.w, y: slab.y + slab.d, z: 0 },
    { x: slab.x, y: slab.y + slab.d, z: 0 },
  ];
  const grassStrips = [
    { y0: 1.4, y1: 3.8 },
    { y0: -2.6, y1: -1.3 },
  ];
  const ballast = [
    { x: slab.x, y: -0.9, z: 0.01 },
    { x: slab.x + slab.w, y: -0.9, z: 0.01 },
    { x: slab.x + slab.w, y: 0.9, z: 0.01 },
    { x: slab.x, y: 0.9, z: 0.01 },
  ];
  const sleepers: React.ReactNode[] = [];
  for (let sx = slab.x; sx < slab.x + slab.w; sx += 0.7) {
    sleepers.push(
      <polygon
        key={sx}
        points={pts([
          { x: sx, y: -0.6, z: 0.02 },
          { x: sx + 0.25, y: -0.6, z: 0.02 },
          { x: sx + 0.25, y: 0.6, z: 0.02 },
          { x: sx, y: 0.6, z: 0.02 },
        ])}
        fill={C.sleeper}
      />,
    );
  }
  const rail = (yy: number) => (
    <polyline
      points={pts([
        { x: slab.x, y: yy, z: 0.08 },
        { x: slab.x + slab.w, y: yy, z: 0.08 },
      ])}
      stroke={C.rail}
      strokeWidth={2.2}
      vectorEffect="non-scaling-stroke"
    />
  );
  return (
    <g>
      <polygon points={pts(water)} fill={C.water} />
      <polygon points={pts(front)} fill={C.waterDeep} />
      <polygon points={pts(top)} fill={C.ground} stroke={C.outline} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
      {grassStrips.map((g, i) => (
        <polygon
          key={i}
          points={pts([
            { x: slab.x, y: g.y0, z: 0.005 },
            { x: slab.x + slab.w, y: g.y0, z: 0.005 },
            { x: slab.x + slab.w, y: g.y1, z: 0.005 },
            { x: slab.x, y: g.y1, z: 0.005 },
          ])}
          fill={C.grass}
        />
      ))}
      <polygon points={pts(ballast)} fill={C.ballast} />
      {sleepers}
      {rail(-0.35)}
      {rail(0.35)}
    </g>
  );
}

function stationItems(): Item[] {
  const out: Item[] = [];
  for (const sx of [2, 40]) {
    out.push(box(`plat${sx}`, sx, 1.0, 0, 10, 1.6, 0.35, '#EDE6D6'));
    out.push(box(`roof${sx}`, sx + 1, 1.2, 1.9, 8, 1.2, 0.18, '#F7A08A'));
    for (const px of [1.3, 4.8, 8.4]) out.push(box(`pole${sx}${px}`, sx + px, 1.7, 0.35, 0.12, 0.12, 1.55, '#B8BCC6'));
  }
  return out;
}

// ---------- overlay labels (screen space, constant size) ----------
export function Pill({
  x,
  y,
  text,
  tone,
  scale = 1,
}: {
  x: number;
  y: number;
  text: string;
  tone: string;
  scale?: number;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: `translate(-50%, -100%) scale(${scale})`,
        transformOrigin: '50% 100%',
        background: '#fff',
        border: `3px solid ${tone}`,
        color: C.ink,
        borderRadius: 999,
        padding: '8px 18px',
        fontFamily: 'JetBrains Mono',
        fontWeight: 700,
        fontSize: 26,
        whiteSpace: 'nowrap',
        boxShadow: '0 6px 18px rgba(31,36,48,0.12)',
        opacity: Math.min(1, scale * 1.4),
      }}
    >
      {text}
    </div>
  );
}

export interface WorldProps {
  frame: number;
  fps: number;
  cam: Camera;
  /** 0..1 strength of each effect, computed by the beat timeline. */
  fx: { rings: number; towerIds: number; pins: number; gpsLog: number; stationGlow: number; errorBand: number };
  pinProgress: number;
}

export const World: React.FC<WorldProps> = ({ frame, fps, cam, fx, pinProgress }) => {
  const sec = frame / fps;
  const active = nearestTower(sec);
  const phone = phonePos(sec);

  const items: Item[] = [];
  for (const h of HOUSES) {
    items.push(shadow(`s${h.x}`, h.x, h.y, h.w, h.d));
    items.push(box(`h${h.x}`, h.x, h.y, 0, h.w, h.d, h.h, h.color, windowsOnHouse(h.x, h.y, h.w, h.d, h.h)));
  }
  TREES.forEach((t, i) => items.push(tree(`t${i}`, t.x, t.y, t.s)));
  TOWERS.forEach((t) => items.push(...towerItems(t, t.id === active.id, frame)));
  items.push(...stationItems());
  items.push(...trainItems(sec));
  items.sort((a, b) => a.depth - b.depth);

  // Error band along the track around the phone.
  const band = fx.errorBand;
  const bandHalf = 13 * band;

  const activeTop = toScreen({ ...active.pos, z: TOWER_TOP }, cam);
  const phoneScreen = toScreen(phone, cam);

  return (
    <>
      <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={C.bg} stopOpacity="1" />
            <stop offset="0.28" stopColor={C.bg} stopOpacity="0.0" />
            <stop offset="0.86" stopColor={C.bg} stopOpacity="0.0" />
            <stop offset="1" stopColor={C.bg} stopOpacity="0.9" />
          </linearGradient>
        </defs>
        <rect width={1080} height={1920} fill={C.bg} />
        <g transform={cameraTransform(cam)}>
          <Ground />
          {band > 0.01 && (
            <polygon
              points={pts([
                { x: phone.x - bandHalf, y: -1.6, z: 0.03 },
                { x: phone.x + bandHalf, y: -1.6, z: 0.03 },
                { x: phone.x + bandHalf, y: 1.6, z: 0.03 },
                { x: phone.x - bandHalf, y: 1.6, z: 0.03 },
              ])}
              fill={C.amber}
              opacity={0.28 * band}
              stroke={C.amber}
              strokeWidth={3}
              strokeDasharray="10 8"
              vectorEffect="non-scaling-stroke"
            />
          )}
          {fx.stationGlow > 0.01 && (
            <polygon
              points={pts([
                { x: 39.5, y: 0.6, z: 0.4 },
                { x: 50.5, y: 0.6, z: 0.4 },
                { x: 50.5, y: 3.0, z: 0.4 },
                { x: 39.5, y: 3.0, z: 0.4 },
              ])}
              fill={C.blue}
              opacity={0.18 * fx.stationGlow}
            />
          )}
          {items.map((it) => it.el)}
          {/* tower-to-pin guides for the map beats */}
          {fx.pins > 0.01 &&
            TOWERS.map((t, i) => {
              const p = clamp01(pinProgress * TOWERS.length - i);
              if (p <= 0) return null;
              const from = { ...t.pos, z: 0.05 };
              const to = { x: t.x, y: 0, z: 0.05 };
              return (
                <polyline
                  key={`g${t.id}`}
                  points={pts([from, { x: lerp(from.x, to.x, p), y: lerp(from.y, to.y, p), z: 0.05 }])}
                  stroke={C.purple}
                  strokeWidth={3}
                  strokeDasharray="8 7"
                  vectorEffect="non-scaling-stroke"
                  opacity={fx.pins}
                />
              );
            })}
        </g>
        <rect width={1080} height={1920} fill="url(#fade)" />
        {/* signal rings + link from active tower to the phone */}
        {fx.rings > 0.01 && (
          <g opacity={fx.rings}>
            {[0, 1, 2].map((k) => {
              const t = ((frame + k * 20) % 60) / 60;
              return (
                <circle
                  key={k}
                  cx={activeTop[0]}
                  cy={activeTop[1]}
                  r={20 + t * cam.zoom * 2.2}
                  fill="none"
                  stroke={C.teal}
                  strokeWidth={4}
                  opacity={1 - t}
                />
              );
            })}
            <line
              x1={activeTop[0]}
              y1={activeTop[1]}
              x2={phoneScreen[0]}
              y2={phoneScreen[1]}
              stroke={C.teal}
              strokeWidth={5}
              strokeDasharray="14 10"
              strokeDashoffset={-frame * 2}
              strokeLinecap="round"
            />
            <circle cx={phoneScreen[0]} cy={phoneScreen[1]} r={12} fill={C.teal} stroke="#fff" strokeWidth={4} />
          </g>
        )}
        {/* pins on the track */}
        {fx.pins > 0.01 &&
          TOWERS.map((t, i) => {
            const p = clamp01(pinProgress * TOWERS.length - i - 0.6);
            if (p <= 0) return null;
            const [sx, sy] = toScreen({ x: t.x, y: 0, z: 0.1 }, cam);
            const drop = (1 - p) * -60;
            return (
              <g key={`pin${t.id}`} transform={`translate(${sx} ${sy + drop})`} opacity={fx.pins * Math.min(1, p * 2)}>
                <path d="M0 0 C -14 -22 -22 -30 -22 -44 A 22 22 0 1 1 22 -44 C 22 -30 14 -22 0 0 Z" fill={C.purple} stroke="#fff" strokeWidth={4} />
                <circle cx={0} cy={-44} r={8} fill="#fff" />
              </g>
            );
          })}
      </svg>
      {/* constant-size labels */}
      {fx.towerIds > 0.01 &&
        TOWERS.map((t) => {
          const [sx, sy] = toScreen({ ...t.pos, z: TOWER_TOP + 0.6 }, cam);
          if (sx < -100 || sx > 1180) return null;
          const isActive = t.id === active.id;
          return (
            <Pill
              key={t.id}
              x={sx}
              y={sy}
              text={`ID ${t.id}`}
              tone={isActive ? C.teal : '#B8BCC6'}
              scale={fx.towerIds * (isActive ? 1.08 : 0.9)}
            />
          );
        })}
      {fx.rings > 0.01 && (
        <Pill x={phoneScreen[0]} y={phoneScreen[1] - 26} text="📱 Aap" tone={C.teal} scale={fx.rings} />
      )}
      {fx.gpsLog > 0.01 && (
        <Pill x={phoneScreen[0]} y={phoneScreen[1] - 26} text="🛰️ GPS + 📶 ID record" tone={C.purple} scale={fx.gpsLog} />
      )}
      {fx.stationGlow > 0.01 &&
        (() => {
          const [sx, sy] = toScreen({ x: 45, y: 1.8, z: 2.6 }, cam);
          return <Pill x={sx} y={sy} text="🚉 Agla station" tone={C.blue} scale={fx.stationGlow} />;
        })()}
      {band > 0.01 &&
        (() => {
          const [sx, sy] = toScreen({ x: phone.x + bandHalf * 0.55, y: 1.6, z: 0.1 }, cam);
          const [tx, ty] = toScreen({ x: phone.x, y: -0.6, z: 2.2 }, cam);
          return (
            <>
              <Pill x={sx} y={sy + 70} text="± kuch km" tone={C.amber} scale={band} />
              <Pill x={tx} y={ty} text="🚆 ~0.5 km" tone={C.blue} scale={band} />
            </>
          );
        })()}
    </>
  );
};
