import { Vec3, pts, shade } from './iso';
import { C, box, shadow, tree, windowsOnHouse, type Item } from './World';

// More 3D objects for the iso world. Each is built from lit boxes, balls and flat shapes drawn on a face,
// in the same style as the original models, so a scene can show what the narration is really about.

export const EXTRA_KINDS = [
  'qr', 'speaker', 'lock', 'database', 'router', 'battery', 'heart', 'gear', 'truck', 'plane', 'train', 'tree',
  'hospital', 'school', 'cart', 'camera', 'bulb', 'globe', 'envelope', 'clock', 'rocket', 'syringe', 'chart', 'atm',
] as const;
export type ExtraKind = (typeof EXTRA_KINDS)[number];

/** Height of each model: where its icon, label and links attach. */
export const EXTRA_TOP: Record<ExtraKind, number> = {
  qr: 2.3, speaker: 1.9, lock: 2.7, database: 2.3, router: 2.3, battery: 2.5, heart: 3.1, gear: 1.2, truck: 2.2, plane: 3.2, train: 2.2, tree: 3.4,
  hospital: 3.4, school: 3.6, cart: 2.0, camera: 1.6, bulb: 3.6, globe: 3.3, envelope: 0.9, clock: 3.4, rocket: 5.2, syringe: 3.6, chart: 3.0, atm: 3.2,
};

export function hex(h: string, amount: number): string {
  const m = shade(h, amount).match(/\d+/g) ?? ['0', '0', '0'];
  return `#${m.map((v) => Number(v).toString(16).padStart(2, '0')).join('')}`;
}

const OUT = { stroke: C.outline, strokeWidth: 1, vectorEffect: 'non-scaling-stroke' as const, strokeLinejoin: 'round' as const };

export function poly(key: string, points: Vec3[], fill: string, depth: number, opacity = 1): Item {
  return { depth, el: <polygon key={key} points={pts(points)} fill={fill} opacity={opacity} {...OUT} /> };
}

/** A rectangle drawn on the face that points at the camera (y = plane), from x0..x1 and z0..z1. */
export const face = (x0: number, x1: number, z0: number, z1: number, y: number): Vec3[] => [
  { x: x0, y, z: z0 }, { x: x1, y, z: z0 }, { x: x1, y, z: z1 }, { x: x0, y, z: z1 },
];

export const sx = (p: Vec3): [number, number] => [(p.x - p.y) * Math.cos(Math.PI / 6), (p.x + p.y) * 0.5 - p.z];

/** A shaded ball: the body, a darker rim and a highlight, so it reads as round. */
export function ball(key: string, p: Vec3, r: number, fill: string, depth: number): Item {
  const [cx, cy] = sx(p);
  return {
    depth,
    el: (
      <g key={key}>
        <circle cx={cx} cy={cy} r={r} fill={hex(fill, -0.18)} {...OUT} />
        <circle cx={cx - r * 0.08} cy={cy - r * 0.1} r={r * 0.88} fill={fill} />
        <circle cx={cx - r * 0.34} cy={cy - r * 0.38} r={r * 0.3} fill="#fff" opacity={0.45} />
      </g>
    ),
  };
}

const over = (it: Item, depth: number): Item => ({ ...it, depth });

/** Builds the model for a kind. Returns null for kinds that are not in this library. */
export function extraItems(kind: string, p: { id: string; pos: Vec3 }, accent: string, frame: number): Item[] | null {
  if (!(EXTRA_KINDS as readonly string[]).includes(kind)) return null;
  const { x, y } = p.pos;
  const k = p.id;
  const d = x + y;
  const out: Item[] = [shadow(`sh${k}`, x - 1.2, y - 1.2, 2.4, 2.4)];
  const pulse = Math.sin(frame / 6);

  switch (kind as ExtraKind) {
    case 'qr': {
      out.push(box(`qb${k}`, x - 0.7, y - 0.5, 0, 1.4, 1.0, 0.25, '#D5D9E0'));
      out.push(box(`qp${k}`, x - 0.95, y - 0.09, 0.25, 1.9, 0.18, 1.95, '#FFFFFF'));
      // 7x7 code on the front face: three finder squares plus a pattern.
      const n = 7;
      const cell = 1.5 / n;
      const x0 = x - 0.75;
      const z0 = 0.5;
      const on = (i: number, j: number) => {
        const f = (a: number, b: number) => (i >= a && i < a + 3 && j >= b && j < b + 3);
        if (f(0, 0) || f(4, 0) || f(0, 4)) return !(((i % 4 === 1) && j % 4 === 1) === false && false);
        return (i * 3 + j * 5 + i * j) % 3 !== 0;
      };
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++) {
          const finder = [[0, 0], [4, 0], [0, 4]].some(([a, b]) => i >= a! && i < a! + 3 && j >= b! && j < b! + 3);
          const hole = [[0, 0], [4, 0], [0, 4]].some(([a, b]) => i === a! + 1 && j === b! + 1);
          if (finder ? hole : !on(i, j)) continue;
          out.push(poly(`qc${k}${i}${j}`, face(x0 + i * cell, x0 + (i + 1) * cell, z0 + j * cell, z0 + (j + 1) * cell, y + 0.1), '#1F2430', d + 0.6));
        }
      break;
    }
    case 'speaker': {
      out.push(box(`sp${k}`, x - 0.65, y - 0.5, 0, 1.3, 1.0, 1.7, '#2F3A4D'));
      out.push(poly(`sg${k}`, face(x - 0.5, x + 0.5, 0.2, 1.5, y + 0.51), '#3C475C', d + 0.5));
      out.push(ball(`sw1${k}`, { x, y: y + 0.55, z: 0.55 }, 0.34, '#C9CED8', d + 0.7));
      out.push(ball(`sw2${k}`, { x, y: y + 0.55, z: 1.14 }, 0.2, '#C9CED8', d + 0.7));
      for (let i = 0; i < 3; i++) {
        const a = (frame / 12 + i * 0.7) % 2;
        out.push({ depth: d + 2, el: <circle key={`sv${k}${i}`} cx={sx({ x: x + 0.9, y: y + 0.6, z: 1.1 })[0]} cy={sx({ x: x + 0.9, y: y + 0.6, z: 1.1 })[1]} r={0.25 + a * 0.55} fill="none" stroke={accent} strokeWidth={3} vectorEffect="non-scaling-stroke" opacity={Math.max(0, 1 - a / 2)} /> });
      }
      break;
    }
    case 'lock': {
      out.push(box(`lb${k}`, x - 0.8, y - 0.5, 0, 1.6, 1.0, 1.3, accent));
      out.push(box(`ll${k}`, x - 0.55, y - 0.2, 1.3, 0.2, 0.2, 0.9, '#C9CED8'));
      out.push(box(`lr${k}`, x + 0.35, y - 0.2, 1.3, 0.2, 0.2, 0.9, '#C9CED8'));
      out.push(over(box(`lt${k}`, x - 0.55, y - 0.2, 2.1, 1.1, 0.2, 0.2, '#C9CED8'), d + 0.4));
      out.push(ball(`lk${k}`, { x, y: y + 0.52, z: 0.75 }, 0.2, '#1F2430', d + 0.8));
      out.push(poly(`lh${k}`, face(x - 0.05, x + 0.05, 0.3, 0.7, y + 0.51), '#1F2430', d + 0.8));
      break;
    }
    case 'database': {
      for (let i = 0; i < 3; i++) {
        out.push(over(box(`db${k}${i}`, x - 0.85, y - 0.85, i * 0.75, 1.7, 1.7, 0.6, i === 1 ? hex(accent, 0.15) : '#5B6477'), d + i * 0.02));
        out.push(poly(`dl${k}${i}`, face(x - 0.6, x - 0.2, i * 0.75 + 0.22, i * 0.75 + 0.34, y + 0.86), (Math.floor(frame / 9) + i) % 2 ? '#9AE6B4' : accent, d + i * 0.02 + 0.6));
      }
      break;
    }
    case 'router': {
      out.push(box(`rb${k}`, x - 1, y - 0.6, 0, 2, 1.2, 0.4, '#EEF1F6'));
      for (const dx of [-0.7, 0.6]) out.push(over(box(`ra${k}${dx}`, x + dx, y - 0.1, 0.4, 0.14, 0.14, 1.5, '#2F3A4D'), d + 0.3));
      for (let i = 0; i < 4; i++) out.push(poly(`rl${k}${i}`, face(x - 0.7 + i * 0.3, x - 0.5 + i * 0.3, 0.12, 0.26, y + 0.61), (Math.floor(frame / 7) + i) % 3 ? '#4ADE80' : accent, d + 0.7));
      for (let i = 0; i < 3; i++) {
        const a = ((frame / 15 + i / 3) % 1);
        const c = sx({ x, y, z: 1.9 });
        out.push({ depth: d + 3, el: <circle key={`rw${k}${i}`} cx={c[0]} cy={c[1]} r={0.3 + a * 1.2} fill="none" stroke={accent} strokeWidth={3} vectorEffect="non-scaling-stroke" opacity={1 - a} /> });
      }
      break;
    }
    case 'battery': {
      out.push(box(`bt${k}`, x - 0.55, y - 0.55, 0, 1.1, 1.1, 2.1, '#2F3A4D'));
      out.push(box(`bc${k}`, x - 0.25, y - 0.25, 2.1, 0.5, 0.5, 0.25, '#C9CED8'));
      const fill = 0.45 + 0.35 * (0.5 + 0.5 * Math.sin(frame / 25));
      out.push(poly(`bf${k}`, face(x - 0.38, x + 0.38, 0.2, 0.2 + 1.7 * fill, y + 0.56), '#4ADE80', d + 0.7));
      break;
    }
    case 'heart': {
      out.push(box(`hp${k}`, x - 0.7, y - 0.5, 0, 1.4, 1.0, 0.3, '#D5D9E0'));
      const s = 0.085 * (1 + 0.07 * pulse);
      const pts2 = Array.from({ length: 40 }, (_, i) => {
        const t = (i / 40) * Math.PI * 2;
        return [16 * Math.sin(t) ** 3, 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)] as const;
      });
      for (const [i, off] of [[0, -0.3], [1, 0]] as const) {
        out.push(poly(`ht${k}${i}`, pts2.map(([a, b]) => ({ x: x + a * s, y: y + off, z: 1.7 + b * s })), i ? C.red : hex(C.red, -0.3), d + 0.4 + i * 0.2));
      }
      out.push(ball(`hs${k}`, { x: x - 0.4, y: y + 0.01, z: 2.3 }, 0.16, '#fff', d + 0.9));
      break;
    }
    case 'gear': {
      const teeth = 10;
      const ring = (r: number, z: number, ph: number) =>
        Array.from({ length: teeth * 4 }, (_, i) => {
          const a = (i / (teeth * 4)) * Math.PI * 2 + ph;
          const rr = Math.floor(i / 2) % 2 === 0 ? r : r * 0.78;
          return { x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr, z };
        });
      const ph = frame / 40;
      for (let z = 0.15; z < 0.55; z += 0.1) out.push(poly(`gs${k}${z.toFixed(2)}`, ring(1.2, z, ph), hex(accent, -0.25), d + z));
      out.push(poly(`gt${k}`, ring(1.2, 0.6, ph), accent, d + 0.7));
      out.push(poly(`gh${k}`, Array.from({ length: 16 }, (_, i) => ({ x: x + Math.cos((i / 16) * 6.283) * 0.4, y: y + Math.sin((i / 16) * 6.283) * 0.4, z: 0.62 })), '#EEF1F6', d + 0.8));
      break;
    }
    case 'truck': {
      out.push(box(`tc${k}`, x - 1.4, y - 0.6, 0.35, 1.8, 1.2, 1.5, '#EEF1F6'));
      out.push(poly(`tcs${k}`, face(x - 1.2, x + 0.2, 0.9, 1.4, y + 0.61), hex(accent, 0.3), d + 0.6));
      out.push(box(`tk${k}`, x + 0.45, y - 0.55, 0.35, 0.95, 1.1, 0.95, accent));
      out.push(poly(`tw${k}`, face(x + 0.6, x + 1.3, 0.85, 1.15, y + 0.56), '#2F3A4D', d + 0.7));
      for (const dx of [-0.9, -0.1, 0.9]) out.push(ball(`tw${k}${dx}`, { x: x + dx, y: y + 0.62, z: 0.3 }, 0.3, '#2F3A4D', d + 0.8));
      break;
    }
    case 'plane': {
      const bob = Math.sin(frame / 18) * 0.2;
      out.push(over(box(`pb${k}`, x - 1.4, y - 0.22, 1.9 + bob, 2.8, 0.44, 0.44, '#EEF1F6'), d + 2));
      out.push(over(box(`pw${k}`, x - 0.3, y - 1.3, 1.95 + bob, 0.7, 2.6, 0.07, accent), d + 2.05));
      out.push(over(box(`pt${k}`, x - 1.4, y - 0.5, 1.95 + bob, 0.45, 1.0, 0.07, accent), d + 2.1));
      out.push(over(box(`pf${k}`, x - 1.4, y - 0.05, 2.1 + bob, 0.45, 0.1, 0.7, accent), d + 2.15));
      out.push(ball(`pn${k}`, { x: x + 1.4, y, z: 2.12 + bob }, 0.26, '#EEF1F6', d + 2.2));
      break;
    }
    case 'train': {
      out.push(box(`rt${k}`, x - 1.6, y - 0.55, 0.3, 3.2, 1.1, 1.3, '#F7F7F4'));
      out.push(poly(`rs${k}`, face(x - 1.6, x + 1.6, 0.55, 0.8, y + 0.56), accent, d + 0.6));
      for (let i = 0; i < 4; i++) out.push(poly(`rw${k}${i}`, face(x - 1.35 + i * 0.75, x - 0.85 + i * 0.75, 1.0, 1.35, y + 0.56), '#2F3A4D', d + 0.7));
      out.push(box(`rn${k}`, x + 1.1, y - 0.55, 0.3, 0.5, 1.1, 0.8, C.trainNose));
      for (const dx of [-1.1, -0.4, 0.4, 1.1]) out.push(ball(`rb${k}${dx}`, { x: x + dx, y: y + 0.6, z: 0.28 }, 0.22, '#2F3A4D', d + 0.8));
      break;
    }
    case 'tree': {
      out.push(over(tree(`tt${k}`, x, y, 1.6), d + 0.1));
      out.push(over(tree(`tu${k}`, x + 0.5, y + 0.6, 1.1), d + 0.7));
      out.push(box(`tn${k}`, x - 0.12, y - 0.12, 0, 0.24, 0.24, 0.5, '#A97C50'));
      break;
    }
    case 'hospital': {
      out.push(box(`hb${k}`, x - 1.1, y - 0.8, 0, 2.2, 1.6, 2.6, '#FFFFFF', windowsOnHouse(x - 1.1, y - 0.8, 2.2, 1.6, 1.6)));
      out.push(over(box(`hr${k}`, x - 1.2, y - 0.9, 2.6, 2.4, 1.8, 0.25, '#D5D9E0'), d + 0.3));
      out.push(poly(`hv${k}`, face(x - 0.12, x + 0.12, 2.9, 3.4, y + 0.82), C.red, d + 0.9));
      out.push(poly(`hh${k}`, face(x - 0.37, x + 0.37, 3.03, 3.27, y + 0.82), C.red, d + 0.9));
      break;
    }
    case 'school': {
      out.push(box(`sb${k}`, x - 1.4, y - 0.8, 0, 2.8, 1.6, 1.6, '#FBD679', windowsOnHouse(x - 1.4, y - 0.8, 2.8, 1.6, 1.1)));
      out.push(over(box(`sr${k}`, x - 1.5, y - 0.9, 1.6, 3.0, 1.8, 0.22, hex(accent, -0.1)), d + 0.3));
      out.push(over(box(`st${k}`, x - 0.35, y - 0.35, 1.8, 0.7, 0.7, 1.2, '#F5E3B0'), d + 0.5));
      out.push(poly(`sf${k}`, [{ x, y, z: 3.0 }, { x, y, z: 3.9 }, { x: x + 0.6, y, z: 3.65 }, { x: x + 0.6, y, z: 3.4 }, { x, y, z: 3.3 }], accent, d + 0.9));
      out.push(poly(`sd${k}`, face(x - 0.3, x + 0.3, 0, 0.8, y + 0.81), '#8B5E3C', d + 0.8));
      break;
    }
    case 'cart': {
      out.push(box(`cb${k}`, x - 0.9, y - 0.6, 0.55, 1.8, 1.2, 0.9, '#C9CED8'));
      out.push(poly(`cg${k}`, face(x - 0.8, x + 0.8, 0.75, 1.3, y + 0.61), accent, d + 0.6, 0.55));
      out.push(over(box(`ch${k}`, x - 1.1, y - 0.6, 1.4, 0.25, 1.2, 0.12, '#2F3A4D'), d + 0.4));
      for (const dx of [-0.6, 0.6]) out.push(ball(`cw${k}${dx}`, { x: x + dx, y: y + 0.62, z: 0.3 }, 0.25, '#2F3A4D', d + 0.8));
      break;
    }
    case 'camera': {
      out.push(box(`kb${k}`, x - 0.85, y - 0.5, 0, 1.7, 1.0, 1.1, '#2F3A4D'));
      out.push(over(box(`kt${k}`, x - 0.3, y - 0.3, 1.1, 0.8, 0.6, 0.28, '#3C475C'), d + 0.3));
      out.push(ball(`kl${k}`, { x, y: y + 0.55, z: 0.6 }, 0.42, '#C9CED8', d + 0.8));
      out.push(ball(`kg${k}`, { x, y: y + 0.6, z: 0.6 }, 0.26, hex(accent, -0.2), d + 0.85));
      out.push(poly(`kf${k}`, face(x + 0.5, x + 0.75, 0.75, 0.95, y + 0.51), frame % 40 < 4 ? '#FFFFFF' : accent, d + 0.8));
      break;
    }
    case 'bulb': {
      const glow = 0.8 + 0.2 * pulse;
      const c = sx({ x, y, z: 2.4 });
      out.push({ depth: d + 0.2, el: <circle key={`bg${k}`} cx={c[0]} cy={c[1]} r={1.6 * glow} fill="#FDE68A" opacity={0.35} /> });
      out.push(box(`bb${k}`, x - 0.3, y - 0.3, 0, 0.6, 0.6, 0.7, '#8892A6'));
      out.push(ball(`bl${k}`, { x, y, z: 2.4 }, 0.85, '#FCD34D', d + 0.5));
      out.push(over(box(`bn${k}`, x - 0.25, y - 0.25, 0.7, 0.5, 0.5, 0.35, '#C9CED8'), d + 0.3));
      break;
    }
    case 'globe': {
      out.push(box(`gb${k}`, x - 0.6, y - 0.6, 0, 1.2, 1.2, 0.3, '#2F3A4D'));
      out.push(ball(`gg${k}`, { x, y, z: 1.85 }, 1.25, '#3B82F6', d + 0.5));
      const spin = (frame / 90) % 1;
      for (const [ox, oz, r] of [[-0.5, 0.35, 0.34], [0.35, -0.3, 0.42], [0.05, 0.75, 0.22]] as const) {
        const ax = ((ox + spin * 2.6 + 1.3) % 2.6) - 1.3;
        if (Math.abs(ax) < 1.0) out.push(ball(`gc${k}${ox}`, { x: x + ax * 0.7, y: y - ax * 0.7 + 0.0, z: 1.85 + oz }, r * (1 - Math.abs(ax) * 0.3), '#4ADE80', d + 0.8));
      }
      break;
    }
    case 'envelope': {
      out.push(box(`eb${k}`, x - 1, y - 0.65, 0.05, 2, 1.3, 0.5, '#FFFFFF'));
      out.push(poly(`ef${k}`, [{ x: x - 1, y: y - 0.65, z: 0.56 }, { x: x + 1, y: y - 0.65, z: 0.56 }, { x, y, z: 0.56 }], hex(accent, 0.35), d + 0.4));
      out.push(ball(`es${k}`, { x, y, z: 0.65 }, 0.2, accent, d + 0.6));
      break;
    }
    case 'clock': {
      out.push(box(`cb${k}`, x - 0.7, y - 0.4, 0, 1.4, 0.8, 0.4, '#C9CED8'));
      out.push(box(`cs${k}`, x - 0.2, y - 0.2, 0.4, 0.4, 0.4, 1.2, '#8892A6'));
      const cz = 2.35;
      out.push(ball(`cf${k}`, { x, y: y + 0.3, z: cz }, 1.15, '#FFFFFF', d + 0.6));
      const hand = (len: number, ang: number) => `${sx({ x, y: y + 0.32, z: cz })[0]},${sx({ x, y: y + 0.32, z: cz })[1]} ${sx({ x: x + Math.sin(ang) * len, y: y + 0.32, z: cz + Math.cos(ang) * len })[0]},${sx({ x: x + Math.sin(ang) * len, y: y + 0.32, z: cz + Math.cos(ang) * len })[1]}`;
      out.push({ depth: d + 0.9, el: <polyline key={`cm${k}`} points={hand(0.75, frame / 12)} stroke="#1F2430" strokeWidth={5} strokeLinecap="round" vectorEffect="non-scaling-stroke" /> });
      out.push({ depth: d + 0.91, el: <polyline key={`ch${k}`} points={hand(0.5, frame / 144)} stroke={accent} strokeWidth={6} strokeLinecap="round" vectorEffect="non-scaling-stroke" /> });
      break;
    }
    case 'rocket': {
      const lift = Math.sin(frame / 14) * 0.2;
      const fl = 0.5 + 0.5 * Math.abs(Math.sin(frame / 3));
      out.push(box(`xp${k}`, x - 0.8, y - 0.8, 0, 1.6, 1.6, 0.25, '#D5D9E0'));
      out.push(over(box(`xb${k}`, x - 0.4, y - 0.4, 1.3 + lift, 0.8, 0.8, 2.4, '#F7F7F4'), d + 0.3));
      out.push(poly(`xn${k}`, [{ x: x - 0.4, y: y + 0.4, z: 3.7 + lift }, { x: x + 0.4, y: y + 0.4, z: 3.7 + lift }, { x, y: y + 0.4, z: 4.6 + lift }], C.red, d + 0.9));
      out.push(poly(`xw${k}`, face(x - 0.2, x + 0.2, 2.7 + lift, 3.1 + lift, y + 0.41), '#2F3A4D', d + 0.9));
      for (const dx of [-0.65, 0.45]) out.push(over(box(`xf${k}${dx}`, x + dx, y - 0.1, 1.3 + lift, 0.2, 0.2, 0.9, accent), d + 0.35));
      out.push(poly(`xl${k}`, [{ x: x - 0.3, y: y + 0.2, z: 1.3 + lift }, { x: x + 0.3, y: y + 0.2, z: 1.3 + lift }, { x, y: y + 0.2, z: 1.3 + lift - fl * 1.3 }], '#FBBF24', d + 0.2));
      break;
    }
    case 'syringe': {
      out.push(box(`yb${k}`, x - 0.6, y - 0.5, 0, 1.2, 1.0, 0.25, '#D5D9E0'));
      out.push(over(box(`yn${k}`, x - 0.04, y - 0.04, 0.25, 0.08, 0.08, 0.6, '#C9CED8'), d + 0.2));
      out.push(over(box(`yt${k}`, x - 0.28, y - 0.28, 0.85, 0.56, 0.56, 1.7, '#EAF2FB'), d + 0.3));
      out.push(poly(`yl${k}`, face(x - 0.2, x + 0.2, 0.95, 0.95 + 1.0, y + 0.29), accent, d + 0.6, 0.85));
      out.push(over(box(`yp${k}`, x - 0.08, y - 0.08, 2.55, 0.16, 0.16, 0.7, '#8892A6'), d + 0.35));
      out.push(over(box(`yh${k}`, x - 0.4, y - 0.2, 3.25, 0.8, 0.4, 0.14, '#8892A6'), d + 0.4));
      break;
    }
    case 'chart': {
      out.push(box(`ab${k}`, x - 1.3, y - 0.8, 0, 2.6, 1.6, 0.2, '#EEF1F6'));
      const grow = Math.min(1, frame / 40);
      [0.8, 1.4, 1.1, 2.0].forEach((h, i) => out.push(over(box(`ar${k}${i}`, x - 1.05 + i * 0.6, y - 0.4, 0.2, 0.45, 0.8, h * (0.4 + 0.6 * grow), i === 3 ? accent : hex(accent, 0.35)), d + 0.3 + i * 0.05)));
      break;
    }
    case 'atm': {
      out.push(box(`mb${k}`, x - 0.8, y - 0.55, 0, 1.6, 1.1, 3.0, '#5B6477'));
      out.push(poly(`ms${k}`, face(x - 0.55, x + 0.55, 1.9, 2.7, y + 0.56), hex(accent, 0.25), d + 0.6));
      out.push(poly(`mk${k}`, face(x - 0.5, x + 0.5, 1.15, 1.7, y + 0.56), '#3C475C', d + 0.6));
      out.push(poly(`mc${k}`, face(x - 0.4, x + 0.4, 0.5, 0.68, y + 0.56), frame % 30 < 15 ? '#4ADE80' : '#1F2430', d + 0.6));
      break;
    }
  }
  return out;
}
