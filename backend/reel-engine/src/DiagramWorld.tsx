import React from 'react';
import { interpolate, spring } from 'remotion';
import { ICONS } from './iconData';
import { bareDomain, logoUrl } from './terms';
import type { DiagramStyle, PropKind, ReelLook, ScenePropSpec, TimedBeat, Tone } from './script';

// The flat "diagram" world: the same scene (objects, links, effect, focus) drawn as cards joined by arrows, the way
// the system-design, interview and tech-explainer reels draw it, instead of as a 3D town. Each style has its own
// cards, arrows and labels: neon (glowing outlined nodes), minimal (quiet tiles, thin lines), paper (hard black
// outlines, offset shadows, marker arrows) and sticker (tilted dark cards, dashed curved arrows).

export type Region = { l: number; r: number; t: number; b: number };
export const DEFAULT_REGION: Region = { l: 90, r: 990, t: 600, b: 1480 };

interface Pal {
  bg: string;
  grid?: string;
  card: string;
  stroke: string;
  strokeW: number;
  ink: string;
  sub: string;
  accent: string;
  hot: string;
  radius: number;
  hardShadow?: string;
  glow: boolean;
  tilt: boolean;
  arrowW: number;
  dashed: boolean;
  curved: boolean;
  pill: 'outline' | 'solid' | 'sticker';
}

const PALETTES: Record<DiagramStyle, (accent: string) => Pal> = {
  neon: (accent) => ({ bg: '#0A1020', grid: 'rgba(52,211,153,0.07)', card: '#0E1830', stroke: accent, strokeW: 3, ink: '#EAF2FF', sub: '#7C8DB5', accent, hot: '#F97316', radius: 24, glow: true, tilt: false, arrowW: 5, dashed: false, curved: false, pill: 'outline' }),
  minimal: (accent) => ({ bg: '#0A1030', grid: 'rgba(96,130,255,0.06)', card: 'rgba(255,255,255,0.045)', stroke: 'rgba(120,150,255,0.42)', strokeW: 2, ink: '#F2F5FF', sub: '#8794B8', accent, hot: '#EF4444', radius: 28, glow: false, tilt: false, arrowW: 3, dashed: false, curved: false, pill: 'solid' }),
  paper: (accent) => ({ bg: '#F3EFE9', card: '#FFFFFF', stroke: '#1F2430', strokeW: 5, ink: '#1F2430', sub: '#6B7280', accent, hot: accent, radius: 22, hardShadow: '#1F2430', glow: false, tilt: false, arrowW: 9, dashed: false, curved: true, pill: 'sticker' }),
  sticker: (accent) => ({ bg: '#12172E', card: '#1B2140', stroke: accent, strokeW: 3, ink: '#F4F6FB', sub: '#9AA3C7', accent, hot: '#FF5D5D', radius: 30, glow: false, tilt: true, arrowW: 6, dashed: true, curved: true, pill: 'sticker' }),
};

/** The Lucide icon that stands for each 3D model, for the flat world. */
const GLYPH_FOR: Partial<Record<PropKind, string>> = {
  server: 'server', datacenter: 'server', database: 'database', phone: 'smartphone', laptop: 'laptop', tower: 'radio-tower', cloud: 'cloud', bank: 'landmark', shop: 'store', building: 'building-2', house: 'house', factory: 'factory', person: 'user', document: 'file-text', money: 'banknote', chip: 'cpu', car: 'car', satellite: 'satellite', qr: 'qr-code', speaker: 'volume-2', lock: 'lock', router: 'router', battery: 'battery-full', heart: 'heart', gear: 'settings', truck: 'truck', plane: 'plane', train: 'train-front', tree: 'tree-pine', hospital: 'hospital', school: 'school', cart: 'shopping-cart', camera: 'camera', bulb: 'lightbulb', globe: 'globe', envelope: 'mail', clock: 'clock', rocket: 'rocket', syringe: 'syringe', chart: 'chart-column', atm: 'credit-card', brain: 'brain', virus: 'bug', dna: 'dna', flask: 'flask-conical', microscope: 'microscope', sun: 'sun', flame: 'flame', solar: 'sun', windmill: 'wind', bus: 'bus', ship: 'ship', shield: 'shield', book: 'book-open', bell: 'bell', key: 'key-round', receipt: 'receipt', pin: 'map-pin', terminal: 'terminal', loadbalancer: 'split', cache: 'zap', queue: 'list', toggle: 'toggle-right', gauge: 'gauge', cable: 'unplug', chat: 'message-square',
};

const KIND_NAME: Partial<Record<PropKind, string>> = { server: 'SERVER', datacenter: 'DATA CENTER', database: 'DATABASE', phone: 'DEVICE', laptop: 'DEVICE', cloud: 'CLOUD', bank: 'BANK', loadbalancer: 'LOAD BALANCER', cache: 'CACHE', queue: 'QUEUE', router: 'NETWORK', lock: 'SECURITY', shield: 'SECURITY', cable: 'LINK', terminal: 'CODE', key: 'SECRET', person: 'PERSON', atm: 'ATM', document: 'RECORD', receipt: 'RECEIPT', chat: 'MESSAGES', gauge: 'LOAD', clock: 'TIMER', money: 'PAYMENT' };

const TONES: Record<Tone, string> = { red: '#EF4444', teal: '#14B8A6', purple: '#8B5CF6', blue: '#3B82F6', amber: '#F59E0B' };

function Glyph({ name, size, color, w = 1.8 }: { name: string; size: number; color: string; w?: number }) {
  const shapes = ICONS[name] ?? ICONS.box ?? [];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
      {shapes.map(([tag, a], i) => {
        switch (tag) {
          case 'path':
            return <path key={i} d={String(a.d)} />;
          case 'circle':
            return <circle key={i} cx={a.cx} cy={a.cy} r={a.r} />;
          case 'ellipse':
            return <ellipse key={i} cx={a.cx} cy={a.cy} rx={a.rx} ry={a.ry} />;
          case 'rect':
            return <rect key={i} x={a.x} y={a.y} width={a.width} height={a.height} rx={a.rx} ry={a.ry} />;
          case 'line':
            return <line key={i} x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2} />;
          case 'polyline':
            return <polyline key={i} points={String(a.points)} />;
          case 'polygon':
            return <polygon key={i} points={String(a.points)} />;
          default:
            return null;
        }
      })}
    </svg>
  );
}

/** Hand-drawn flat art for the things reels about software draw most: a phone with an app, a code window, server racks, a database. */
function Art({ spec, size, pal, frame }: { spec: ScenePropSpec; size: number; pal: Pal; frame: number }) {
  const line = pal.ink;
  const s = size;
  const common = { width: s, height: s, viewBox: '0 0 100 100', fill: 'none', stroke: line, strokeWidth: 3.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (spec.kind) {
    case 'phone':
      return (
        <svg {...common}>
          <rect x="29" y="8" width="42" height="84" rx="9" fill={pal.card === '#FFFFFF' ? '#FFFFFF' : 'none'} />
          <rect x="35" y="16" width="30" height="9" rx="3" fill={pal.accent} stroke="none" />
          {[34, 46, 58, 70].map((y, i) => (
            <rect key={y} x="35" y={y} width={i % 2 ? 22 : 30} height="7" rx="3" stroke={pal.sub} strokeWidth="2.4" />
          ))}
          <rect x="43" y="82" width="14" height="3" rx="1.5" fill={line} stroke="none" />
        </svg>
      );
    case 'terminal':
    case 'laptop':
      return (
        <svg {...common}>
          <rect x="8" y="16" width="84" height="64" rx="8" />
          <path d="M8 32h84" />
          {[16, 25, 34].map((x, i) => (
            <circle key={x} cx={x} cy="24" r="2.4" fill={i === 0 ? pal.hot : i === 1 ? '#F59E0B' : pal.accent} stroke="none" />
          ))}
          <path d="M18 46h26M18 56h40M18 66h22" stroke={pal.sub} strokeWidth="2.6" />
          {Math.floor(frame / 15) % 2 === 0 && <rect x="62" y="63" width="8" height="5" fill={pal.accent} stroke="none" />}
        </svg>
      );
    case 'server':
    case 'datacenter':
    case 'loadbalancer':
      return (
        <svg {...common}>
          {[10, 38, 66].map((y, i) => (
            <g key={y}>
              <rect x="12" y={y} width="76" height="24" rx="6" />
              <circle cx="26" cy={y + 12} r="3" fill={(Math.floor(frame / 12) + i) % 3 === 0 ? pal.hot : pal.accent} stroke="none" />
              <path d={`M40 ${y + 12}h34`} stroke={pal.sub} strokeWidth="2.6" />
            </g>
          ))}
        </svg>
      );
    case 'database':
      return (
        <svg {...common}>
          <ellipse cx="50" cy="22" rx="30" ry="11" />
          <path d="M20 22v50c0 6 13 11 30 11s30-5 30-11V22" />
          <path d="M20 47c0 6 13 11 30 11s30-5 30-11" stroke={pal.accent} />
        </svg>
      );
    default:
      return null;
  }
}

const HAS_ART = new Set<PropKind>(['phone', 'terminal', 'laptop', 'server', 'datacenter', 'loadbalancer', 'database']);

interface NodeBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Where the cards go: one big, two stacked, three in a column, four in a grid. */
export function layoutNodes(n: number, R: Region): NodeBox[] {
  const W = R.r - R.l;
  const H = R.b - R.t;
  const cx = R.l + W / 2;
  if (n <= 1) return [{ x: cx - 330, y: R.t + H / 2 - 290, w: 660, h: 560 }];
  if (n === 2) {
    const h = Math.min(300, H * 0.32);
    return [
      { x: cx - 390, y: R.t + 20, w: 780, h },
      { x: cx - 390, y: R.b - 20 - h, w: 780, h },
    ];
  }
  if (n === 3) {
    // Tall gaps, so every arrow has room for its arrowhead and label.
    const h = Math.min(190, (H - 300) / 3);
    const gap = (H - 40 - h * 3) / 2;
    return [0, 1, 2].map((i) => ({ x: cx - 370, y: R.t + 20 + i * (h + gap), w: 740, h }));
  }
  const w = (W - 190) / 2;
  const h = Math.min(270, (H - 200) / 2);
  const top = R.t + (H - 2 * h - 170) / 2;
  return [0, 1, 2, 3].map((i) => ({ x: R.l + (i % 2) * (w + 190), y: top + Math.floor(i / 2) * (h + 170), w, h }));
}

/** Where the straight line between two cards' centres leaves one and enters the other. */
function clip(a: NodeBox, b: NodeBox, pad = 14): { x1: number; y1: number; x2: number; y2: number } {
  const ca = { x: a.x + a.w / 2, y: a.y + a.h / 2 };
  const cb = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  const dx = cb.x - ca.x;
  const dy = cb.y - ca.y;
  const edge = (r: NodeBox, c: { x: number; y: number }, sx: number, sy: number) => {
    const tx = sx === 0 ? Infinity : r.w / 2 / Math.abs(sx);
    const ty = sy === 0 ? Infinity : r.h / 2 / Math.abs(sy);
    const t = Math.min(tx, ty);
    return { x: c.x + sx * t, y: c.y + sy * t };
  };
  const len = Math.hypot(dx, dy) || 1;
  const p1 = edge(a, ca, dx, dy);
  const p2 = edge(b, cb, -dx, -dy);
  const ux = dx / len;
  const uy = dy / len;
  return { x1: p1.x + ux * pad, y1: p1.y + uy * pad, x2: p2.x - ux * pad, y2: p2.y - uy * pad };
}

export const DiagramWorld: React.FC<{ frame: number; fps: number; beat: TimedBeat; look?: ReelLook; region?: Region; logoBase?: string }> = ({ frame, fps, beat, look, region = DEFAULT_REGION, logoBase }) => {
  const style: DiagramStyle = look?.diagram ?? 'neon';
  const accent = look?.accent ?? TONES[beat.card.tone];
  const pal = PALETTES[style](accent);
  const scene = beat.scene;
  const props = (scene?.props ?? []).slice(0, 4);
  const local = frame - beat.start;
  const boxes = layoutNodes(props.length, region);
  const wide = props.length === 2 || props.length === 3;
  const byId = new Map(props.map((p, i) => [p.id, { p, box: boxes[i]!, i }]));
  const focusId = scene?.focus ?? props[0]?.id;
  const enter = (i: number) => spring({ frame: local - 4 - i * 7, fps, config: { damping: 16, mass: 0.7 } });

  const arrows = (scene?.links ?? []).flatMap((l, li) => {
    const a = byId.get(l.from);
    const b = byId.get(l.to);
    if (!a || !b || a === b) return [];
    const start = 4 + Math.max(a.i, b.i) * 7 + 10;
    return [{ l, li, a, b, start }];
  });

  return (
    <div style={{ position: 'absolute', inset: 0, background: pal.bg, overflow: 'hidden' }}>
      {pal.grid && (
        <svg width="1080" height="1920" style={{ position: 'absolute', inset: 0 }}>
          <defs>
            <pattern id="dg-grid" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M60 0H0V60" fill="none" stroke={pal.grid} strokeWidth="2" />
            </pattern>
          </defs>
          <rect width="1080" height="1920" fill="url(#dg-grid)" />
        </svg>
      )}

      {/* Signal rings behind the focus card. */}
      {scene?.effect === 'rings' && focusId && byId.get(focusId) && (
        <svg width="1080" height="1920" style={{ position: 'absolute', inset: 0 }}>
          {[0, 1, 2].map((k) => {
            const t = ((local / 70 + k / 3) % 1 + 1) % 1;
            const b = byId.get(focusId)!.box;
            return <circle key={k} cx={b.x + b.w / 2} cy={b.y + b.h / 2} r={Math.min(b.w, b.h) * 0.5 + t * 190} fill="none" stroke={pal.accent} strokeWidth={4} opacity={(1 - t) * 0.55} />;
          })}
        </svg>
      )}

      {/* Arrows under the cards, so a card always sits on top of the line that reaches it. */}
      <svg width="1080" height="1920" style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        {arrows.map(({ l, li, a, b, start }) => {
          const { x1, y1, x2, y2 } = clip(a.box, b.box, pal.hardShadow ? 18 : 12);
          const p = interpolate(local - start, [0, 16], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
          const len = Math.hypot(x2 - x1, y2 - y1);
          const bend = pal.curved ? (li % 2 ? -1 : 1) * Math.min(80, len * 0.2) : 0;
          const mx = (x1 + x2) / 2 + (-(y2 - y1) / (len || 1)) * bend;
          const my = (y1 + y2) / 2 + ((x2 - x1) / (len || 1)) * bend;
          const d = `M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`;
          const ang = Math.atan2(y2 - my, x2 - mx);
          const ah = pal.arrowW * 4.4;
          const tip = { x: x1 + (x2 - x1) * 1, y: y1 + (y2 - y1) * 1 };
          const head = [
            [tip.x, tip.y],
            [tip.x - Math.cos(ang - 0.45) * ah, tip.y - Math.sin(ang - 0.45) * ah],
            [tip.x - Math.cos(ang + 0.45) * ah, tip.y - Math.sin(ang + 0.45) * ah],
          ];
          const hot = l.label === 'check' || /cut|fail|error|stop|block/i.test(l.label ?? '') ? pal.hot : pal.accent;
          // A packet travels along the arrow, like the 3D scenes' travelling dot.
          const tt = ((local - start - 10) / 56) % 1;
          const bt = Math.max(0, tt);
          const px = (1 - bt) * (1 - bt) * x1 + 2 * (1 - bt) * bt * mx + bt * bt * x2;
          const py = (1 - bt) * (1 - bt) * y1 + 2 * (1 - bt) * bt * my + bt * bt * y2;
          const labelAt = { x: (x1 + 2 * mx + x2) / 4, y: (y1 + 2 * my + y2) / 4 };
          return (
            <g key={li} opacity={p > 0 ? 1 : 0}>
              <path d={d} fill="none" stroke={hot} strokeWidth={pal.arrowW} strokeLinecap="round" strokeDasharray={pal.dashed ? '4 16' : len} strokeDashoffset={pal.dashed ? -local * 0.8 : len * (1 - p)} opacity={pal.dashed ? p : 1} />
              {p > 0.95 && <polygon points={head.map((q) => q.join(',')).join(' ')} fill={hot} />}
              {p > 0.95 && tt > 0 && <circle cx={px} cy={py} r={pal.arrowW * 1.5} fill={pal.pill === 'sticker' && style === 'paper' ? pal.ink : '#FFFFFF'} stroke={hot} strokeWidth={3} />}
              {l.label && p > 0.6 && (
                <g transform={`translate(${labelAt.x} ${labelAt.y}) rotate(${pal.tilt ? -3 : 0})`}>
                  <rect x={-(l.label.length * 9.5 + 18)} y={-22} width={l.label.length * 19 + 36} height={44} rx={pal.pill === 'sticker' ? 8 : 24} fill={pal.pill === 'solid' ? hot : pal.pill === 'sticker' ? (style === 'paper' ? '#FFFFFF' : pal.card) : pal.bg} stroke={hot} strokeWidth={pal.pill === 'solid' ? 0 : 3} />
                  <text x={0} y={9} textAnchor="middle" fontFamily="JetBrains Mono" fontWeight={700} fontSize={22} letterSpacing={1} fill={pal.pill === 'solid' ? '#FFFFFF' : style === 'paper' ? pal.ink : hot}>
                    {l.label.toUpperCase()}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>

      {props.map((p, i) => {
        const b = boxes[i]!;
        const e = enter(i);
        const isFocus = p.id === focusId;
        const tone = p.tone ? TONES[p.tone] : pal.accent;
        const glyph = p.glyph && ICONS[p.glyph] ? p.glyph : GLYPH_FOR[p.kind] ?? 'box';
        const iconSize = wide ? 118 : props.length === 1 ? 250 : 130;
        const rot = pal.tilt ? (i % 2 ? 2.2 : -2.2) : 0;
        const pulse = isFocus ? 0.5 + 0.5 * Math.sin(local / 9) : 0;
        const art = HAS_ART.has(p.kind) ? <Art spec={p} size={iconSize} pal={pal} frame={frame} /> : null;
        return (
          <div
            key={p.id}
            style={{
              position: 'absolute',
              left: b.x,
              top: b.y,
              width: b.w,
              height: b.h,
              display: 'flex',
              flexDirection: wide ? 'row' : 'column',
              alignItems: 'center',
              justifyContent: wide ? 'flex-start' : 'center',
              gap: wide ? 32 : 18,
              padding: wide ? '0 36px' : '24px',
              boxSizing: 'border-box',
              background: pal.card,
              border: `${pal.strokeW}px solid ${isFocus && pal.glow ? pal.accent : pal.stroke}`,
              borderRadius: pal.radius,
              boxShadow: pal.hardShadow ? `10px 10px 0 ${pal.hardShadow}` : pal.glow ? `0 0 ${isFocus ? 34 + pulse * 26 : 16}px ${pal.accent}${isFocus ? '99' : '33'}` : isFocus ? `0 0 0 3px ${pal.accent}66` : 'none',
              opacity: interpolate(e, [0, 1], [0, 1]),
              transform: `translateY(${(1 - e) * 34}px) scale(${0.94 + 0.06 * e}) rotate(${rot}deg)`,
              fontFamily: 'Space Grotesk',
            }}
          >
            <div style={{ width: iconSize, height: iconSize, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: style === 'minimal' ? 24 : 18, background: style === 'minimal' ? `${tone}22` : style === 'sticker' ? `${tone}22` : 'transparent' }}>
              {p.logo ? (
                <img src={logoUrl(logoBase, p.logo, p.label)} width={iconSize * 0.8} height={iconSize * 0.8} style={{ objectFit: 'contain', borderRadius: 14 }} alt="" />
              ) : art ? (
                art
              ) : p.kind === 'custom' && !p.glyph && p.icon ? (
                <span style={{ fontSize: iconSize * 0.7 }}>{p.icon}</span>
              ) : (
                <Glyph name={glyph} size={iconSize * 0.78} color={style === 'paper' ? pal.ink : tone} w={style === 'paper' ? 2 : 1.7} />
              )}
            </div>
            <div style={{ minWidth: 0, textAlign: wide ? 'left' : 'center' }}>
              <div style={{ fontFamily: 'JetBrains Mono', fontWeight: 700, fontSize: 22, letterSpacing: 3, color: pal.sub }}>{(KIND_NAME[p.kind] ?? (p.logo ? bareDomain(p.logo) : p.kind)).toString().toUpperCase()}</div>
              <div style={{ fontWeight: 700, fontSize: props.length === 1 ? 64 : wide ? 54 : 44, lineHeight: 1.08, color: pal.ink, marginTop: 6, letterSpacing: -1, overflowWrap: 'anywhere' }}>{p.label ?? p.kind}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
