import { Vec3 } from './iso';
import { C, box, shadow, type Item } from './World';
import { ball, face, hex, poly, sx } from './props3d';

// A third batch of hand-built models, for software, backend, security and system-design topics:
// the things reels about apps keep drawing (keys, receipts, queues, caches, data centres, switches).

export const TECH_KINDS = ['key', 'receipt', 'pin', 'terminal', 'loadbalancer', 'cache', 'queue', 'datacenter', 'toggle', 'gauge', 'cable', 'chat'] as const;
export type TechKind = (typeof TECH_KINDS)[number];

export const TECH_TOP: Record<TechKind, number> = {
  key: 3.0, receipt: 3.2, pin: 3.4, terminal: 2.6, loadbalancer: 2.0, cache: 2.6, queue: 1.6, datacenter: 4.6, toggle: 1.8, gauge: 2.8, cable: 2.0, chat: 3.2,
};

const BASE = '#D5D9E0';
const INK = '#1F2430';

export function techItems(kind: string, p: { id: string; pos: Vec3 }, accent: string, frame: number): Item[] | null {
  if (!(TECH_KINDS as readonly string[]).includes(kind)) return null;
  const { x, y } = p.pos;
  const k = p.id;
  const d = x + y;
  const out: Item[] = [shadow(`sh${k}`, x - 1.2, y - 1.2, 2.4, 2.4)];
  const bob = Math.sin(frame / 18) * 0.12;

  switch (kind as TechKind) {
    case 'key': {
      out.push(box(`kp${k}`, x - 0.6, y - 0.5, 0, 1.2, 1.0, 0.25, BASE));
      const gold = '#F5B83D';
      const z = 1.6 + bob;
      // Ring head, shaft and two teeth, standing on its base.
      out.push(ball(`kh${k}`, { x, y, z: z + 0.9 }, 0.62, gold, d + 0.5));
      out.push(ball(`kc${k}`, { x, y: y + 0.15, z: z + 0.9 }, 0.25, '#FFF3CF', d + 0.9));
      out.push(poly(`ks${k}`, face(x - 0.12, x + 0.12, 0.35 + bob, z + 0.4, y + 0.05), hex(gold, -0.1), d + 0.6));
      out.push(poly(`kt1${k}`, face(x + 0.12, x + 0.4, 0.5 + bob, 0.78 + bob, y + 0.05), hex(gold, -0.1), d + 0.65));
      out.push(poly(`kt2${k}`, face(x + 0.12, x + 0.34, 0.95 + bob, 1.2 + bob, y + 0.05), hex(gold, -0.1), d + 0.65));
      break;
    }
    case 'receipt': {
      out.push(box(`rp${k}`, x - 0.7, y - 0.4, 0, 1.4, 0.8, 0.2, BASE));
      out.push(box(`rb${k}`, x - 0.65, y - 0.06, 0.2, 1.3, 0.12, 2.8, '#FFFFFF'));
      const fy = y + 0.07;
      for (let i = 0; i < 4; i++) out.push(poly(`rl${k}${i}`, face(x - 0.45, x + 0.15 + (i % 2) * 0.2, 2.4 - i * 0.32, 2.5 - i * 0.32, fy), '#B8BFCC', d + 0.7));
      out.push(poly(`rt${k}`, face(x - 0.45, x + 0.4, 1.0, 1.2, fy), accent, d + 0.75));
      // Torn zig-zag bottom edge.
      for (let i = 0; i < 5; i++) out.push(poly(`rz${k}${i}`, [{ x: x - 0.65 + i * 0.26, y: fy, z: 0.2 }, { x: x - 0.52 + i * 0.26, y: fy, z: 0.02 }, { x: x - 0.39 + i * 0.26, y: fy, z: 0.2 }], '#FFFFFF', d + 0.72));
      break;
    }
    case 'pin': {
      const pulse = (frame % 50) / 50;
      out.push({ depth: d - 0.2, el: <ellipse key={`pr${k}`} cx={sx({ x, y, z: 0.05 })[0]} cy={sx({ x, y, z: 0.05 })[1]} rx={0.6 + pulse * 1.0} ry={0.3 + pulse * 0.5} fill="none" stroke={accent} strokeWidth={0.1} opacity={1 - pulse} /> });
      const z = 0.4 + Math.abs(Math.sin(frame / 16)) * 0.25;
      const c = sx({ x, y, z: z + 2.0 });
      out.push({
        depth: d + 0.6,
        el: (
          <g key={`pp${k}`}>
            <path d={`M ${c[0]} ${c[1] + 1.9} C ${c[0] - 1.5} ${c[1] + 0.3}, ${c[0] - 1.05} ${c[1] - 1.1}, ${c[0]} ${c[1] - 1.1} C ${c[0] + 1.05} ${c[1] - 1.1}, ${c[0] + 1.5} ${c[1] + 0.3}, ${c[0]} ${c[1] + 1.9} Z`} fill="#EF4444" stroke={C.outline} strokeWidth={0.05} />
            <circle cx={c[0]} cy={c[1] - 0.1} r={0.45} fill="#FFFFFF" />
          </g>
        ),
      });
      break;
    }
    case 'terminal': {
      out.push(box(`tb${k}`, x - 1.1, y - 0.15, 0.2, 2.2, 0.3, 1.9, '#0F1424'));
      out.push(box(`tp${k}`, x - 0.5, y - 0.3, 0, 1.0, 0.6, 0.2, BASE));
      const fy = y + 0.17;
      out.push(poly(`tt${k}`, face(x - 1.1, x + 1.1, 1.65, 2.1, fy), '#2A3350', d + 0.8));
      for (const [i, w, col] of [[0, 1.1, '#5EEAD4'], [1, 0.7, '#A9B1C6'], [2, 1.3, '#A9B1C6']] as const) out.push(poly(`tl${k}${i}`, face(x - 0.9, x - 0.9 + w, 1.3 - i * 0.3, 1.42 - i * 0.3, fy), col, d + 0.85));
      if (Math.floor(frame / 15) % 2 === 0) out.push(poly(`tc${k}`, face(x - 0.9, x - 0.7, 0.35, 0.55, fy), '#5EEAD4', d + 0.9));
      break;
    }
    case 'loadbalancer': {
      out.push(box(`lb${k}`, x - 1.0, y - 0.6, 0, 2.0, 1.2, 0.9, '#3B4660'));
      out.push(box(`lt${k}`, x - 1.0, y - 0.6, 0.9, 2.0, 1.2, 0.12, accent));
      // Three arrows fan out from the middle: the load is shared.
      const fy = y + 0.62;
      for (const [i, dx] of [[0, -0.55], [1, 0], [2, 0.55]] as const) {
        const on = Math.floor(frame / 12) % 3 === i;
        out.push(poly(`la${k}${i}`, [{ x: x + dx - 0.18, y: fy, z: 0.25 }, { x: x + dx + 0.18, y: fy, z: 0.25 }, { x: x + dx, y: fy, z: 0.7 }], on ? '#FFFFFF' : hex('#3B4660', 0.5), d + 0.9));
      }
      break;
    }
    case 'cache': {
      out.push(box(`cb${k}`, x - 0.9, y - 0.7, 0, 1.8, 1.4, 1.4, '#1F2937'));
      out.push(box(`ct${k}`, x - 0.9, y - 0.7, 1.4, 1.8, 1.4, 0.12, '#A3E635'));
      const fy = y + 0.72;
      const glow = 0.7 + 0.3 * Math.sin(frame / 6);
      out.push(poly(`cz${k}`, [{ x: x + 0.15, y: fy, z: 1.25 }, { x: x - 0.4, y: fy, z: 0.6 }, { x: x - 0.02, y: fy, z: 0.6 }, { x: x - 0.2, y: fy, z: 0.12 }, { x: x + 0.4, y: fy, z: 0.82 }, { x: x + 0.02, y: fy, z: 0.82 }], '#A3E635', d + 0.9, glow));
      break;
    }
    case 'queue': {
      out.push(box(`qb${k}`, x - 1.4, y - 0.5, 0, 2.8, 1.0, 0.3, '#3B4660'));
      const cols = [accent, '#F59E0B', '#8B5CF6', '#14B8A6'];
      for (let i = 0; i < 4; i++) {
        const t = ((frame / 90 + i / 4) % 1) * 2.4 - 1.2;
        out.push(box(`qi${k}${i}`, x + t - 0.2, y - 0.3, 0.3, 0.45, 0.6, 0.45, cols[i]!));
      }
      break;
    }
    case 'datacenter': {
      out.push(box(`db${k}`, x - 1.3, y - 1.0, 0, 2.6, 2.0, 3.0, '#E6E9F0'));
      out.push(box(`dr${k}`, x - 1.3, y - 1.0, 3.0, 2.6, 2.0, 0.2, '#2F3A52'));
      const fy = y + 1.02;
      for (const [i, px] of [[0, -0.9], [1, -0.1], [2, 0.7]] as const) {
        out.push(poly(`dw${k}${i}`, face(x + px - 0.3, x + px + 0.3, 0.5, 2.7, fy), '#2F3A52', d + 0.8));
        for (let r = 0; r < 5; r++) {
          const lit = (Math.floor(frame / 9) + i * 2 + r) % 4 !== 0;
          out.push(poly(`dl${k}${i}${r}`, face(x + px - 0.2, x + px + 0.1, 0.7 + r * 0.4, 0.82 + r * 0.4, fy + 0.01), lit ? '#4ADE80' : '#64748B', d + 0.9));
        }
      }
      break;
    }
    case 'toggle': {
      const on = Math.floor(frame / 45) % 2 === 0;
      out.push(box(`gb${k}`, x - 1.0, y - 0.5, 0, 2.0, 1.0, 0.9, on ? '#22C55E' : '#94A3B8'));
      const kx = on ? x + 0.45 : x - 0.45;
      out.push(box(`gk${k}`, kx - 0.4, y - 0.4, 0.9, 0.8, 0.8, 0.2, '#FFFFFF'));
      break;
    }
    case 'gauge': {
      out.push(box(`ga${k}`, x - 0.8, y - 0.5, 0, 1.6, 1.0, 0.25, BASE));
      const c = sx({ x, y, z: 1.6 });
      const ang = -Math.PI * 0.85 + (0.5 + 0.5 * Math.sin(frame / 30)) * Math.PI * 0.7;
      out.push({
        depth: d + 0.7,
        el: (
          <g key={`gg${k}`}>
            <circle cx={c[0]} cy={c[1]} r={1.15} fill="#FFFFFF" stroke={INK} strokeWidth={0.08} />
            <path d={`M ${c[0] - 0.95} ${c[1] + 0.3} A 0.98 0.98 0 0 1 ${c[0] + 0.95} ${c[1] + 0.3}`} fill="none" stroke="#E5E7EB" strokeWidth={0.2} />
            <path d={`M ${c[0] + 0.1} ${c[1] - 0.95} A 0.98 0.98 0 0 1 ${c[0] + 0.95} ${c[1] + 0.3}`} fill="none" stroke="#EF4444" strokeWidth={0.2} />
            <line x1={c[0]} y1={c[1]} x2={c[0] + Math.cos(ang) * 0.85} y2={c[1] + Math.sin(ang) * 0.85} stroke={INK} strokeWidth={0.12} strokeLinecap="round" />
            <circle cx={c[0]} cy={c[1]} r={0.16} fill={INK} />
          </g>
        ),
      });
      break;
    }
    case 'cable': {
      out.push(box(`ca${k}`, x - 1.5, y - 0.2, 0, 1.2, 0.4, 0.4, '#475569'));
      out.push(box(`cb${k}`, x + 0.3, y - 0.2, 0, 1.2, 0.4, 0.4, '#475569'));
      const c = sx({ x: x - 0.1, y, z: 0.5 });
      const f = 0.5 + 0.5 * Math.abs(Math.sin(frame / 5));
      out.push({
        depth: d + 0.8,
        el: (
          <g key={`cs${k}`} opacity={0.55 + 0.45 * f}>
            {Array.from({ length: 8 }, (_, i) => {
              const a = (i / 8) * Math.PI * 2;
              return <line key={i} x1={c[0] + Math.cos(a) * 0.15} y1={c[1] + Math.sin(a) * 0.15} x2={c[0] + Math.cos(a) * (0.5 + f * 0.4)} y2={c[1] + Math.sin(a) * (0.5 + f * 0.4)} stroke="#FBBF24" strokeWidth={0.14} strokeLinecap="round" />;
            })}
            <circle cx={c[0]} cy={c[1]} r={0.22} fill="#FFFFFF" />
          </g>
        ),
      });
      break;
    }
    case 'chat': {
      out.push(box(`hp${k}`, x - 0.8, y - 0.5, 0, 1.6, 1.0, 0.2, BASE));
      const fy = y + 0.1;
      const b1 = [{ x: x - 1.0, y: fy, z: 1.3 }, { x: x + 0.7, y: fy, z: 1.3 }, { x: x + 0.7, y: fy, z: 2.3 }, { x: x - 1.0, y: fy, z: 2.3 }];
      out.push(poly(`h1${k}`, b1, '#FFFFFF', d + 0.5));
      out.push(poly(`h1t${k}`, [{ x: x - 0.8, y: fy, z: 1.3 }, { x: x - 0.55, y: fy, z: 1.3 }, { x: x - 0.8, y: fy, z: 0.9 }], '#FFFFFF', d + 0.5));
      out.push(poly(`h1l${k}`, face(x - 0.8, x + 0.4, 1.75, 1.9, fy + 0.01), '#B8BFCC', d + 0.6));
      const b2 = [{ x: x - 0.4, y: fy + 0.05, z: 2.55 }, { x: x + 1.1, y: fy + 0.05, z: 2.55 }, { x: x + 1.1, y: fy + 0.05, z: 3.25 }, { x: x - 0.4, y: fy + 0.05, z: 3.25 }];
      out.push(poly(`h2${k}`, b2, accent, d + 0.7));
      for (let i = 0; i < 3; i++) out.push({ ...ball(`hd${k}${i}`, { x: x + 0.05 + i * 0.3, y: fy + 0.1, z: 2.9 }, 0.1, '#FFFFFF', d + 0.8), opacity: (Math.floor(frame / 10) % 3) >= i ? 1 : 0.35 } as Item);
      break;
    }
  }
  return out;
}
