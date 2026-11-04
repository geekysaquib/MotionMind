import { Vec3, pts } from './iso';
import { C, box, shadow, type Item } from './World';
import { ball, face, hex, poly, sx } from './props3d';

// A second batch of hand-built models, for science, health, energy, transport and security topics.

export const MORE_KINDS = ['brain', 'virus', 'dna', 'flask', 'microscope', 'sun', 'flame', 'solar', 'windmill', 'bus', 'ship', 'shield', 'book', 'bell'] as const;
export type MoreKind = (typeof MORE_KINDS)[number];

export const MORE_TOP: Record<MoreKind, number> = {
  brain: 3.0, virus: 3.4, dna: 4.2, flask: 3.2, microscope: 3.6, sun: 4.4, flame: 3.4, solar: 2.4, windmill: 7.0, bus: 2.4, ship: 3.4, shield: 3.4, book: 1.9, bell: 3.2,
};

const over = (it: Item, depth: number): Item => ({ ...it, depth });

export function moreItems(kind: string, p: { id: string; pos: Vec3 }, accent: string, frame: number): Item[] | null {
  if (!(MORE_KINDS as readonly string[]).includes(kind)) return null;
  const { x, y } = p.pos;
  const k = p.id;
  const d = x + y;
  const out: Item[] = [shadow(`sh${k}`, x - 1.2, y - 1.2, 2.4, 2.4)];
  const wob = Math.sin(frame / 14);

  switch (kind as MoreKind) {
    case 'brain': {
      out.push(box(`np${k}`, x - 0.7, y - 0.5, 0, 1.4, 1.0, 0.3, '#D5D9E0'));
      const pink = '#F4A6C0';
      out.push(ball(`nl${k}`, { x: x - 0.45, y, z: 1.7 }, 0.95, pink, d + 0.5));
      out.push(ball(`nr${k}`, { x: x + 0.45, y, z: 1.7 }, 0.95, hex(pink, 0.08), d + 0.55));
      for (const [ox, oz, r] of [[-0.8, 2.1, 0.3], [-0.2, 2.4, 0.3], [0.5, 2.35, 0.3], [0.9, 1.9, 0.28], [-0.7, 1.4, 0.26], [0.2, 1.2, 0.26]] as const)
        out.push(ball(`nb${k}${ox}`, { x: x + ox, y: y + 0.55, z: oz }, r, hex(pink, -0.08), d + 0.8));
      const g = 0.5 + 0.5 * Math.abs(Math.sin(frame / 10));
      out.push({ depth: d + 1, el: <circle key={`ns${k}`} cx={sx({ x: x + 0.1, y: y + 0.6, z: 1.8 })[0]} cy={sx({ x: x + 0.1, y: y + 0.6, z: 1.8 })[1]} r={0.1 + g * 0.18} fill="#FDE68A" opacity={0.9} /> });
      break;
    }
    case 'virus': {
      const c = sx({ x, y, z: 1.7 });
      const spin = frame / 60;
      const spikes = Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2 + spin;
        return { a, x2: c[0] + Math.cos(a) * 1.45, y2: c[1] + Math.sin(a) * 1.45 * 0.9, x1: c[0] + Math.cos(a) * 0.95, y1: c[1] + Math.sin(a) * 0.95 * 0.9 };
      });
      out.push(box(`vp${k}`, x - 0.6, y - 0.5, 0, 1.2, 1.0, 0.3, '#D5D9E0'));
      out.push({
        depth: d + 0.6,
        el: (
          <g key={`vv${k}`}>
            {spikes.map((s, i) => (
              <g key={i}>
                <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke="#2E8B57" strokeWidth={0.14} strokeLinecap="round" />
                <circle cx={s.x2} cy={s.y2} r={0.2} fill="#E5484D" stroke={C.outline} strokeWidth={0.04} />
              </g>
            ))}
          </g>
        ),
      });
      out.push(ball(`vb${k}`, { x, y, z: 1.7 }, 1.0, '#6DBE7A', d + 0.9));
      for (const [ox, oz] of [[-0.3, 0.2], [0.35, -0.3], [0.1, 0.55]] as const) out.push(ball(`vd${k}${ox}`, { x: x + ox, y: y + 0.4, z: 1.7 + oz }, 0.14, '#3E8F4E', d + 1));
      break;
    }
    case 'dna': {
      out.push(box(`dp${k}`, x - 0.8, y - 0.5, 0, 1.6, 1.0, 0.25, '#D5D9E0'));
      const N = 18;
      const ph = frame / 18;
      const A: [number, number][] = [];
      const B: [number, number][] = [];
      for (let i = 0; i <= N; i++) {
        const z = 0.5 + i * 0.2;
        const o = Math.sin(i * 0.65 + ph) * 0.65;
        A.push(sx({ x: x + o, y, z }));
        B.push(sx({ x: x - o, y, z }));
      }
      out.push({
        depth: d + 0.7,
        el: (
          <g key={`dd${k}`} fill="none" strokeLinecap="round">
            {A.map((a, i) => (i % 2 === 0 && i > 0 ? <line key={`r${i}`} x1={a[0]} y1={a[1]} x2={B[i]![0]} y2={B[i]![1]} stroke="#C9CED8" strokeWidth={0.1} /> : null))}
            <polyline points={A.map((a) => a.join(',')).join(' ')} stroke={accent} strokeWidth={0.2} />
            <polyline points={B.map((a) => a.join(',')).join(' ')} stroke="#EF6A5B" strokeWidth={0.2} />
          </g>
        ),
      });
      break;
    }
    case 'flask': {
      out.push(box(`fp${k}`, x - 0.9, y - 0.5, 0, 1.8, 1.0, 0.2, '#D5D9E0'));
      const yy = y + 0.1;
      const glass = (dy: number, fill: string, o: number, key: string) =>
        poly(key, [{ x: x - 0.25, y: yy + dy, z: 2.9 }, { x: x + 0.25, y: yy + dy, z: 2.9 }, { x: x + 0.25, y: yy + dy, z: 2.0 }, { x: x + 0.95, y: yy + dy, z: 0.35 }, { x: x - 0.95, y: yy + dy, z: 0.35 }, { x: x - 0.25, y: yy + dy, z: 2.0 }], fill, d + 0.4 + dy, o);
      out.push(glass(-0.2, '#9FB4C9', 0.6, `fb${k}`));
      out.push(glass(0.2, '#EAF4FF', 0.7, `ff${k}`));
      out.push(poly(`fl${k}`, [{ x: x - 0.8, y: yy + 0.21, z: 0.4 }, { x: x + 0.8, y: yy + 0.21, z: 0.4 }, { x: x + 0.52, y: yy + 0.21, z: 1.2 }, { x: x - 0.52, y: yy + 0.21, z: 1.2 }], accent, d + 0.9, 0.9));
      for (let i = 0; i < 3; i++) {
        const t = ((frame / 40 + i / 3) % 1);
        out.push(ball(`fq${k}${i}`, { x: x + (i - 1) * 0.3, y: yy + 0.25, z: 0.9 + t * 1.5 }, 0.09, '#FFFFFF', d + 1));
      }
      break;
    }
    case 'microscope': {
      out.push(box(`mb${k}`, x - 0.9, y - 0.6, 0, 1.8, 1.2, 0.3, '#2F3A4D'));
      out.push(over(box(`mp${k}`, x + 0.35, y - 0.15, 0.3, 0.3, 0.3, 2.3, '#EEF1F6'), d + 0.3));
      out.push(over(box(`mh${k}`, x - 0.45, y - 0.2, 2.35, 1.2, 0.4, 0.45, '#EEF1F6'), d + 0.5));
      out.push(over(box(`mt${k}`, x - 0.45, y - 0.15, 1.1, 0.4, 0.3, 1.3, '#8892A6'), d + 0.55));
      out.push(over(box(`me${k}`, x - 0.35, y - 0.12, 3.0, 0.2, 0.24, 0.5, '#2F3A4D'), d + 0.6));
      out.push(over(box(`ms${k}`, x - 0.85, y - 0.4, 0.8, 1.3, 0.8, 0.12, '#C9CED8'), d + 0.5));
      out.push(ball(`ml${k}`, { x: x - 0.28, y: y + 0.2, z: 1.0 }, 0.12, accent, d + 0.9));
      break;
    }
    case 'sun': {
      const c = sx({ x, y, z: 2.2 });
      const rot = frame / 80;
      out.push(box(`sp${k}`, x - 0.5, y - 0.4, 0, 1.0, 0.8, 0.5, '#D5D9E0'));
      out.push({
        depth: d + 0.4,
        el: (
          <g key={`sr${k}`}>
            <circle cx={c[0]} cy={c[1]} r={1.9 + wob * 0.1} fill="#FDE68A" opacity={0.3} />
            {Array.from({ length: 12 }, (_, i) => {
              const a = (i / 12) * Math.PI * 2 + rot;
              const l = i % 2 ? 1.5 : 1.8;
              return <line key={i} x1={c[0] + Math.cos(a) * 1.15} y1={c[1] + Math.sin(a) * 1.15} x2={c[0] + Math.cos(a) * l} y2={c[1] + Math.sin(a) * l} stroke="#FBBF24" strokeWidth={0.18} strokeLinecap="round" />;
            })}
          </g>
        ),
      });
      out.push(ball(`sb${k}`, { x, y, z: 2.2 }, 1.0, '#FCD34D', d + 0.8));
      break;
    }
    case 'flame': {
      out.push(over(box(`gl${k}`, x - 0.8, y - 0.2, 0, 1.6, 0.35, 0.3, '#8B5E3C'), d));
      out.push(over(box(`gm${k}`, x - 0.6, y + 0.1, 0.05, 1.3, 0.35, 0.3, '#A97C50'), d + 0.1));
      const f = (h: number, w: number, c: string, o: number, key: string, z0: number) =>
        poly(key, [
          { x: x - w, y: y + 0.2, z: z0 }, { x: x - w * 1.1, y: y + 0.2, z: z0 + h * 0.4 }, { x: x - w * 0.3 + wob * 0.12, y: y + 0.2, z: z0 + h * 0.75 },
          { x: x + wob * 0.2, y: y + 0.2, z: z0 + h }, { x: x + w * 0.5 + wob * 0.1, y: y + 0.2, z: z0 + h * 0.6 }, { x: x + w * 1.1, y: y + 0.2, z: z0 + h * 0.35 }, { x: x + w, y: y + 0.2, z: z0 },
        ], c, d + o);
      out.push(f(2.9 + wob * 0.15, 0.85, '#EF6A5B', 0.6, `fo${k}`, 0.3));
      out.push(f(2.0 + wob * 0.1, 0.55, '#FBA94C', 0.7, `fm${k}`, 0.3));
      out.push(f(1.1, 0.3, '#FDE68A', 0.8, `fi${k}`, 0.3));
      break;
    }
    case 'solar': {
      out.push(box(`lp${k}`, x - 0.1, y - 0.1, 0, 0.2, 0.2, 0.8, '#8892A6'));
      out.push(box(`lb${k}`, x - 0.6, y - 0.5, 0, 1.2, 1.0, 0.18, '#D5D9E0'));
      const P = [{ x: x - 1.3, y: y + 0.55, z: 0.7 }, { x: x + 1.3, y: y + 0.55, z: 0.7 }, { x: x + 1.3, y: y - 0.55, z: 2.0 }, { x: x - 1.3, y: y - 0.55, z: 2.0 }];
      out.push(poly(`lf${k}`, P, hex('#2563EB', -0.05), d + 0.7));
      const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
      const lines: Vec3[][] = [];
      for (let i = 1; i < 4; i++) lines.push([lerp3(P[0]!, P[1]!, i / 4), lerp3(P[3]!, P[2]!, i / 4)]);
      lines.push([lerp3(P[0]!, P[3]!, 0.5), lerp3(P[1]!, P[2]!, 0.5)]);
      out.push({ depth: d + 0.8, el: <g key={`lg${k}`}>{lines.map((l, i) => <polyline key={i} points={pts(l)} stroke="#BFDBFE" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />)}</g> });
      break;
    }
    case 'windmill': {
      out.push(box(`wb${k}`, x - 0.5, y - 0.5, 0, 1.0, 1.0, 0.25, '#D5D9E0'));
      out.push(box(`wt${k}`, x - 0.25, y - 0.25, 0.25, 0.5, 0.5, 5.2, '#EEF1F6'));
      out.push(over(box(`wn${k}`, x - 0.35, y - 0.4, 5.45, 0.7, 0.8, 0.5, '#EEF1F6'), d + 0.5));
      const hub = { x, y: y + 0.5, z: 5.7 };
      const rot = frame / 14;
      out.push(
        over(
          {
            depth: 0,
            el: (
              <g key={`wr${k}`}>
                {[0, 1, 2].map((i) => {
                  const a = rot + (i * Math.PI * 2) / 3;
                  const tip = { x: hub.x + Math.sin(a) * 2.5, y: hub.y, z: hub.z + Math.cos(a) * 2.5 };
                  const mid = { x: hub.x + Math.sin(a) * 1.2 + Math.cos(a) * 0.32, y: hub.y, z: hub.z + Math.cos(a) * 1.2 - Math.sin(a) * 0.32 };
                  const l = { x: hub.x + Math.cos(a) * 0.2, y: hub.y, z: hub.z - Math.sin(a) * 0.2 };
                  const r = { x: hub.x - Math.cos(a) * 0.2, y: hub.y, z: hub.z + Math.sin(a) * 0.2 };
                  return <polygon key={i} points={pts([l, mid, tip, r])} fill="#FFFFFF" stroke={C.outline} strokeWidth={1} vectorEffect="non-scaling-stroke" />;
                })}
              </g>
            ),
          },
          d + 0.9,
        ),
      );
      out.push(ball(`wh${k}`, hub, 0.2, accent, d + 1));
      break;
    }
    case 'bus': {
      out.push(box(`ub${k}`, x - 1.5, y - 0.6, 0.3, 3.0, 1.2, 1.7, accent));
      out.push(poly(`uw${k}`, face(x - 1.4, x + 1.4, 1.2, 1.75, y + 0.61), '#2F3A4D', d + 0.6));
      for (let i = 0; i < 5; i++) out.push(poly(`ud${k}${i}`, face(x - 1.35 + i * 0.57, x - 1.15 + i * 0.57, 1.22, 1.73, y + 0.612), '#E5EDF7', d + 0.62));
      out.push(poly(`us${k}`, face(x - 1.5, x + 1.5, 0.75, 0.9, y + 0.61), '#FFFFFF', d + 0.6));
      for (const dx of [-0.95, 0.95]) out.push(ball(`uw${k}${dx}`, { x: x + dx, y: y + 0.62, z: 0.32 }, 0.3, '#2F3A4D', d + 0.8));
      break;
    }
    case 'ship': {
      const bob = Math.sin(frame / 18) * 0.12;
      out.push(poly(`sw${k}`, [{ x: x - 2, y: y - 1.2, z: 0.05 }, { x: x + 2, y: y - 1.2, z: 0.05 }, { x: x + 2, y: y + 1.2, z: 0.05 }, { x: x - 2, y: y + 1.2, z: 0.05 }], '#7CC4E8', d - 0.2, 0.55));
      out.push(over(box(`sh2${k}`, x - 1.6, y - 0.6, 0.2 + bob, 3.2, 1.2, 0.8, '#2F3A4D'), d + 0.2));
      out.push(over(box(`sc${k}`, x - 0.9, y - 0.45, 1.0 + bob, 1.6, 0.9, 0.8, '#F7F7F4'), d + 0.4));
      out.push(poly(`sp${k}`, face(x - 0.8, x + 0.6, 1.4 + bob, 1.65 + bob, y + 0.46), '#2F3A4D', d + 0.8));
      out.push(over(box(`sf${k}`, x + 0.2, y - 0.25, 1.8 + bob, 0.5, 0.5, 0.8, accent), d + 0.6));
      for (let i = 0; i < 3; i++) out.push(over(box(`sx${k}${i}`, x - 1.3 + i * 0.5, y - 0.2, 1.0 + bob, 0.4, 0.4, 0.4, [C.red, C.teal, C.amber][i]!), d + 0.3));
      break;
    }
    case 'shield': {
      out.push(box(`hp${k}`, x - 0.7, y - 0.5, 0, 1.4, 1.0, 0.25, '#D5D9E0'));
      const body = (dy: number) => [
        { x: x - 1.0, y: y + dy, z: 3.0 }, { x, y: y + dy, z: 3.4 }, { x: x + 1.0, y: y + dy, z: 3.0 },
        { x: x + 0.95, y: y + dy, z: 1.7 }, { x, y: y + dy, z: 0.5 }, { x: x - 0.95, y: y + dy, z: 1.7 },
      ];
      out.push(poly(`hb${k}`, body(-0.25), hex(accent, -0.35), d + 0.4));
      out.push(poly(`hf${k}`, body(0.05), accent, d + 0.6));
      out.push({ depth: d + 0.9, el: <polyline key={`hc${k}`} points={pts([{ x: x - 0.45, y: y + 0.07, z: 1.9 }, { x: x - 0.1, y: y + 0.07, z: 1.5 }, { x: x + 0.5, y: y + 0.07, z: 2.4 }])} fill="none" stroke="#fff" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" /> });
      break;
    }
    case 'book': {
      const cols = [accent, '#F7F7F4', C.amber];
      cols.forEach((c, i) => {
        out.push(over(box(`kb${k}${i}`, x - 0.95 + (i === 1 ? 0.12 : 0), y - 0.65, i * 0.45, 1.9, 1.3, 0.4, c), d + i * 0.05));
        out.push(poly(`ks${k}${i}`, face(x - 0.85, x + 0.85, i * 0.45 + 0.1, i * 0.45 + 0.3, y + 0.651), '#FFFFFF', d + i * 0.05 + 0.02, 0.5));
      });
      out.push(poly(`kr${k}`, [{ x: x + 0.5, y: y - 0.3, z: 1.35 }, { x: x + 0.7, y: y - 0.3, z: 1.35 }, { x: x + 0.7, y: y - 0.3, z: 1.8 }, { x: x + 0.6, y: y - 0.3, z: 1.7 }, { x: x + 0.5, y: y - 0.3, z: 1.8 }], C.red, d + 0.5));
      break;
    }
    case 'bell': {
      out.push(box(`bp${k}`, x - 0.7, y - 0.5, 0, 1.4, 1.0, 0.25, '#D5D9E0'));
      const sw = Math.sin(frame / 7) * 0.12;
      const sy = y + 0.1;
      const body = (dy: number) => [
        { x: x - 0.15 + sw, y: sy + dy, z: 3.0 }, { x: x + 0.15 + sw, y: sy + dy, z: 3.0 }, { x: x + 0.55 + sw, y: sy + dy, z: 2.5 },
        { x: x + 0.85 + sw, y: sy + dy, z: 1.2 }, { x: x + 1.05 + sw, y: sy + dy, z: 0.95 }, { x: x - 1.05 + sw, y: sy + dy, z: 0.95 },
        { x: x - 0.85 + sw, y: sy + dy, z: 1.2 }, { x: x - 0.55 + sw, y: sy + dy, z: 2.5 },
      ];
      out.push(poly(`bb${k}`, body(-0.2), hex(C.amber, -0.3), d + 0.4));
      out.push(poly(`bf${k}`, body(0.1), '#FBBF24', d + 0.6));
      out.push(ball(`bc${k}`, { x: x + sw * 0.4, y: sy + 0.1, z: 0.75 }, 0.2, '#8B5E3C', d + 0.7));
      out.push(poly(`bh${k}`, face(x - 0.35, x + 0.35, 1.2, 1.35, sy + 0.12), hex('#FBBF24', 0.4), d + 0.7));
      break;
    }
  }
  return out;
}

