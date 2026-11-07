import React from 'react';
import { AbsoluteFill, interpolate } from 'remotion';
import type { Tone } from '../script';
import { Composer, type Skin } from './composer';
import { captionScale, chunkAt, cleanWord, contentOf, countText, ctaFor, easeInOut, extrasOf, fade, isKey, parts, pop, ramp, rnd, stepName, Logo, fitSize, type SceneProps, type StyleKit } from './common';

// Live Map: a flat, light city map that stays on screen the whole reel, with cars driving and location pings.
// The camera glides to a new part of the city for every scene, and each scene adds one layer on top
// (notification cards, a route, live numbers, a heat grid). Made from the kit's Uber live heatmap reel.

const C = {
  bg: '#F7F7F5', block: '#E4E6EA', park: '#D3EAD6', water: '#CFE2F6', ink: '#0B0B0C', sub: '#5B6170',
  yellow: '#FFD60A', orange: '#FF8A00', red: '#FF2D3D', teal: '#00B37E', blue: '#276EF1', purple: '#7B5CFA', white: '#FFFFFF',
};
const TONE: Record<Tone, string> = { red: C.red, teal: C.teal, purple: C.purple, blue: C.blue, amber: C.orange };
const FONT = 'Inter, "Segoe UI", Arial, sans-serif';

// ---------- the city (map space: about 1080 x 1920) ----------
const STEP = 150;
const OFF = 15;
const STREETS = Array.from({ length: 14 }, (_, i) => OFF + i * STEP);
const blocks: { x: number; y: number; w: number; h: number; park: boolean }[] = [];
for (let i = -2; i < 9; i++)
  for (let j = -2; j < 15; j++) blocks.push({ x: OFF + i * STEP + 13, y: OFF + j * STEP + 13, w: STEP - 26, h: STEP - 26, park: rnd(i * 31 + j * 7) < 0.12 });
const RIVER = 'M -360 1390 C 200 1300, 330 1520, 560 1470 S 900 1330, 1460 1420 L 1460 1530 C 900 1440, 700 1600, 520 1590 S 180 1430, -360 1500 Z';

type Pt = { x: number; y: number };
const carPaths: Pt[][] = Array.from({ length: 20 }, (_, c) => {
  let ix = Math.floor(rnd(c + 1) * 8);
  let iy = 1 + Math.floor(rnd(c + 50) * 11);
  const pts: Pt[] = [{ x: STREETS[ix]!, y: STREETS[iy]! }];
  for (let k = 0; k < 60; k++) {
    const r = rnd(c * 100 + k);
    if (r < 0.25 && ix < 7) ix++;
    else if (r < 0.5 && ix > 0) ix--;
    else if (r < 0.75 && iy < 12) iy++;
    else if (iy > 1) iy--;
    else if (ix < 7) ix++;
    pts.push({ x: STREETS[ix]!, y: STREETS[iy]! });
  }
  return pts;
});
const carAt = (c: number, t: number) => {
  const path = carPaths[c]!;
  const speed = 70 + rnd(c + 9) * 40;
  const dist = (t * speed + rnd(c + 3) * 400) % (STEP * (path.length - 1));
  const seg = Math.floor(dist / STEP);
  const f = (dist - seg * STEP) / STEP;
  const a = path[seg]!;
  const b = path[seg + 1] ?? a;
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, angle: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI };
};

const R = 64;
const HW = Math.sqrt(3) * R;
const hexes: { x: number; y: number; seed: number }[] = [];
for (let row = -2; row < 28; row++) for (let col = -2; col < 11; col++) hexes.push({ x: col * HW + (row % 2 ? HW / 2 : 0) - 20, y: row * R * 1.5 + 40, seed: row * 13 + col });
const hexPath = (x: number, y: number, r = R - 3) =>
  Array.from({ length: 6 }, (_, k) => {
    const a = (Math.PI / 180) * (60 * k - 30);
    return `${k ? 'L' : 'M'}${(x + r * Math.cos(a)).toFixed(1)},${(y + r * Math.sin(a)).toFixed(1)}`;
  }).join(' ') + 'Z';
const heatColor = (v: number) => (v < 0.3 ? C.teal : v < 0.55 ? C.yellow : v < 0.78 ? C.orange : C.red);

/** Where the camera looks for scene i: a different part of the city each time, never too far from the last. */
const HOTSPOTS: Pt[] = [{ x: 690, y: 915 }, { x: 465, y: 615 }, { x: 765, y: 1215 }, { x: 315, y: 1065 }, { x: 615, y: 465 }, { x: 840, y: 765 }, { x: 390, y: 1290 }, { x: 540, y: 915 }];
const camFor = (i: number, lead: string) => {
  const h = HOTSPOTS[i % HOTSPOTS.length]!;
  return { x: h.x, y: h.y, z: lead === 'stats' ? 1.55 : lead === 'flow' ? 0.92 : i === 0 ? 1.35 : 1.1 };
};
const CENTER = { x: 540, y: 1000 };

const Car: React.FC<{ x: number; y: number; angle: number; color?: string; s?: number }> = ({ x, y, angle, color = C.ink, s = 1 }) => (
  <g transform={`translate(${x.toFixed(1)},${y.toFixed(1)}) rotate(${angle.toFixed(1)}) scale(${s})`}>
    <rect x={-17} y={-10} width={34} height={20} rx={6} fill={color} />
    <rect x={2} y={-7} width={8} height={14} rx={2} fill="#ffffff55" />
  </g>
);

const CityMap: React.FC<SceneProps & { leads: string[] }> = ({ frame, fps, timed, index, leads }) => {
  const beat = timed[index]!;
  const f = frame - beat.start;
  const prev = camFor(Math.max(0, index - 1), leads[Math.max(0, index - 1)]!);
  const cur = camFor(index, leads[index]!);
  const p = index === 0 ? 1 : easeInOut(Math.min(1, f / 26));
  const drift = 1 + interpolate(f, [0, beat.frames], [0, 0.05], { extrapolateRight: 'clamp' });
  const cam = { x: prev.x + (cur.x - prev.x) * p, y: prev.y + (cur.y - prev.y) * p, z: (prev.z + (cur.z - prev.z) * p) * drift };
  const t = frame / fps;
  const lead = leads[index];
  const heat = lead === 'stats' ? ramp(f, 6, 50) : 0;
  const pings = lead === 'flow' || lead === 'headline' || index % 2 === 1;
  const hot = HOTSPOTS[index % HOTSPOTS.length]!;
  return (
    <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
      <g transform={`translate(${CENTER.x},${CENTER.y}) scale(${cam.z.toFixed(4)}) translate(${-cam.x.toFixed(1)},${-cam.y.toFixed(1)})`}>
        <rect x={-900} y={-900} width={2900} height={3800} fill={C.bg} />
        {blocks.map((b, i) => <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} rx={14} fill={b.park ? C.park : C.block} />)}
        <path d={RIVER} fill={C.water} />
        <line x1={-400} y1={STREETS[6]} x2={1500} y2={STREETS[6]} stroke="#fff" strokeWidth={30} />
        <line x1={STREETS[4]} y1={-400} x2={STREETS[4]} y2={2300} stroke="#fff" strokeWidth={30} />
        {heat > 0 &&
          hexes.map((h, i) => {
            const d = Math.hypot(h.x - hot.x, h.y - hot.y);
            if (d > 520) return null;
            const on = fade(heat * 800 - d, 0, 140);
            if (on <= 0) return null;
            const v = Math.min(1, Math.exp(-(d * d) / (2 * 220 * 220)) + rnd(h.seed) * 0.28 - 0.05);
            const pulse = v > 0.78 ? 0.08 * Math.sin(t * 6 + i) : 0;
            return <path key={i} d={hexPath(h.x, h.y)} fill={heatColor(v)} fillOpacity={on * (0.18 + v * 0.5 + pulse)} stroke={C.ink} strokeOpacity={0.25 * on} strokeWidth={2.2} />;
          })}
        {/* a pulsing ring where the story is happening */}
        <circle cx={hot.x} cy={hot.y} r={120 + 16 * Math.sin(t * 4)} fill={C.purple} opacity={0.12 * fade(f, 0, 20)} />
        <circle cx={hot.x} cy={hot.y} r={18} fill={C.ink} opacity={fade(f, 0, 12)} />
        {carPaths.map((_, c) => {
          const pos = carAt(c, t);
          const ping = pings ? ((t * 1.1 + rnd(c + 77)) % 1.4) / 1.4 : -1;
          return (
            <g key={c}>
              {ping >= 0 && <circle cx={pos.x} cy={pos.y} r={14 + ping * 70} fill="none" stroke={C.blue} strokeWidth={5} opacity={1 - ping} />}
              <Car x={pos.x} y={pos.y} angle={pos.angle} s={1.2} />
            </g>
          );
        })}
      </g>
    </svg>
  );
};

const Card: React.FC<{ style?: React.CSSProperties; children: React.ReactNode }> = ({ style, children }) => (
  <div style={{ position: 'absolute', background: C.white, borderRadius: 34, boxShadow: '0 20px 50px #0B0B0C24', fontFamily: FONT, ...style }}>{children}</div>
);

const Marker: React.FC<{ text: string; size: number }> = ({ text, size }) => (
  <span style={{ fontSize: size, color: C.ink, fontWeight: 900, letterSpacing: -1.5, lineHeight: 1.08 }}>
    {parts(text).map((p, i) =>
      p.hi ? (
        <span key={i} style={{ background: `linear-gradient(transparent 52%, ${C.yellow} 52%, ${C.yellow} 92%, transparent 92%)`, padding: '0 6px' }}>{p.text}</span>
      ) : (
        <span key={i}>{p.text}</span>
      ),
    )}
  </span>
);

const Header: React.FC<SceneProps> = (props) => {
  const { frame, fps, beat, spec, zones } = props;
  const f = frame - beat.start;
  const k = pop(f, fps);
  const { terms, logos } = extrasOf(beat, spec);
  const long = beat.card.headline.length > 34;
  return (
    <div style={{ position: 'absolute', left: 60, right: 60, top: zones.head, fontFamily: FONT }}>
      {spec.steps.length > 0 && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 22 }}>
          {spec.steps.map((_, i) => <div key={i} style={{ flex: 1, height: 10, borderRadius: 5, background: i + 1 <= beat.chapter ? C.ink : '#0B0B0C22' }} />)}
        </div>
      )}
      <div style={{ background: C.white, borderRadius: 40, padding: '30px 40px 34px', boxShadow: '0 18px 50px #0B0B0C1f', transform: `translateY(${(1 - k) * -40}px) scale(${0.94 + k * 0.06})`, opacity: k }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
          <div style={{ background: C.ink, color: C.white, fontSize: 28, fontWeight: 800, letterSpacing: 3, padding: '8px 20px', borderRadius: 999, textTransform: 'uppercase' }}>{beat.card.eyebrow || stepName(spec, beat.chapter) || spec.title}</div>
          {logos.map((l) => (
            <Logo key={l.domain} src={l.url} style={{ width: 52, height: 52, borderRadius: 14, background: C.white, boxShadow: '0 2px 10px #0B0B0C22', objectFit: 'contain', padding: 6 }} />
          ))}
        </div>
        <Marker text={beat.card.headline} size={props.index === 0 ? (long ? 80 : 92) : long ? 70 : 82} />
      </div>
      {terms.map((t, i) => (
        <div key={t.short} style={{ display: 'inline-block', marginTop: 14, marginRight: 12, background: C.ink, color: C.white, fontSize: 28, fontWeight: 700, padding: '8px 18px', borderRadius: 999, opacity: fade(f, 20 + i * 8, 30 + i * 8) }}>
          <span style={{ color: C.yellow }}>{t.short}</span> = {t.full}
        </div>
      ))}
    </div>
  );
};

const Layer: React.FC<SceneProps> = (props) => {
  const { frame, fps, beat, zones } = props;
  const f = frame - beat.start;
  const c = contentOf(beat);
  const out = fade(f, beat.frames - 8, beat.frames, 1, 0);
  const mid = (zones.top + zones.bottom) / 2;
  let body: React.ReactNode = null;
  if (c.lead === 'chips') {
    body = c.chips.slice(0, 4).map((chip, i) => {
      const p = pop(f, fps, 14 + i * 16, 13);
      const left = i % 2 ? 420 : 60;
      const color = chip.strike ? C.red : chip.tone ? TONE[chip.tone] : C.ink;
      return (
        <Card key={i} style={{ left, top: zones.top + 220 + i * 118, width: 600, padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 18, transform: `translateX(${(1 - p) * (i % 2 ? 300 : -300)}px)`, opacity: p }}>
          <div style={{ width: 60, height: 60, borderRadius: 16, background: color, color: '#fff', fontWeight: 900, fontSize: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{chip.strike ? '✕' : chip.tone ? '●' : '…'}</div>
          <div style={{ fontSize: 36, fontWeight: 800, color: C.ink, textDecoration: chip.strike ? 'line-through' : undefined, textDecorationColor: C.red, textDecorationThickness: 4 }}>{chip.text}</div>
        </Card>
      );
    });
  } else if (c.lead === 'stats') {
    const n = c.stats.length;
    body = c.stats.map((s, i) => {
      const p = pop(f, fps, 16 + i * 18);
      const w = n === 1 ? 760 : n === 2 ? 460 : 960;
      const left = n === 1 ? 160 : n === 2 ? (i ? 560 : 60) : 60;
      const top = n === 3 ? zones.top + 300 + i * 175 : mid + 70;
      const color = s.tone ? TONE[s.tone] : C.blue;
      return (
        <Card key={i} style={{ left, top, width: w, padding: '22px 30px', transform: `translateY(${(1 - p) * 140}px)`, opacity: p, display: n === 3 ? 'flex' : 'block', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 30, fontWeight: 800, color: C.sub }}>{s.label}</div>
          <div style={{ fontSize: fitSize(s.value, n === 3 ? 76 : n === 1 ? 130 : 104, n === 3 ? 520 : w - 70), whiteSpace: 'nowrap', fontWeight: 900, color, lineHeight: 1.05, letterSpacing: -2 }}>{countText(s.value, ramp(f, 22 + i * 18, 40))}</div>
        </Card>
      );
    });
  } else if (c.lead === 'flow') {
    const items = c.flow;
    const pts = items.map((_, i) => ({ x: i % 2 ? 760 : 320, y: zones.top + 230 + (i * (zones.bottom - zones.top - 330)) / Math.max(1, items.length - 1) }));
    const draw = ramp(f, 10, 50 + items.length * 6, (x) => x);
    const total = pts.length - 1;
    const seg = Math.min(total - 1, Math.floor(draw * total));
    const segT = draw * total - seg;
    const carP = pts.length > 1 ? { x: pts[seg]!.x + (pts[seg + 1]!.x - pts[seg]!.x) * segT, y: pts[seg]!.y + (pts[seg + 1]!.y - pts[seg]!.y) * segT } : pts[0]!;
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ');
    body = (
      <>
        <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <path d={d} fill="none" stroke={C.ink} strokeWidth={14} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="3000" strokeDashoffset={3000 * (1 - draw)} opacity={0.85} />
          <path d={d} fill="none" stroke={C.yellow} strokeWidth={5} strokeDasharray="14 16" strokeDashoffset={-frame * 2} opacity={draw > 0.02 ? 1 : 0} />
          <Car x={carP.x} y={carP.y} angle={0} color={C.blue} s={1.8} />
        </svg>
        {items.map((it, i) => {
          const at = i / Math.max(1, total);
          const p = pop(f, fps, 10 + at * (50 + items.length * 6), 12);
          const pt = pts[i]!;
          return (
            <div key={i} style={{ position: 'absolute', left: pt.x - 230, top: pt.y - 108, width: 460, display: 'flex', flexDirection: 'column', alignItems: 'center', transform: `scale(${p})`, opacity: p }}>
              <div style={{ background: i === items.length - 1 ? C.ink : C.white, color: i === items.length - 1 ? C.yellow : C.ink, fontFamily: FONT, fontWeight: 900, fontSize: 36, padding: '12px 24px', borderRadius: 22, boxShadow: '0 12px 30px #0B0B0C2a', whiteSpace: 'nowrap', maxWidth: 460, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {i + 1}. {it}
              </div>
              <div style={{ width: 4, height: 34, background: C.ink }} />
              <div style={{ width: 30, height: 30, borderRadius: 99, background: C.white, border: `8px solid ${C.ink}` }} />
            </div>
          );
        })}
      </>
    );
  } else if (c.lead === 'note') {
    const p = pop(f, fps, 14);
    body = (
      <Card style={{ left: 70, right: 70, top: mid + 60, padding: '26px 30px', display: 'flex', gap: 22, alignItems: 'center', transform: `translateY(${(1 - p) * 140}px)`, opacity: p }}>
        <div style={{ width: 84, height: 84, borderRadius: 22, background: TONE[beat.card.tone] ?? C.blue, color: '#fff', fontSize: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>📍</div>
        <div style={{ fontSize: 40, fontWeight: 900, color: C.ink }}>{c.notes[0]}</div>
      </Card>
    );
  } else {
    const p = pop(f, fps, 10, 9);
    body = (
      <div style={{ position: 'absolute', left: 0, right: 0, top: mid - 40, display: 'flex', justifyContent: 'center' }}>
        <div style={{ transform: `scale(${p}) rotate(-4deg)`, background: C.yellow, color: C.ink, fontFamily: FONT, fontWeight: 900, fontSize: c.question ? 180 : 70, padding: c.question ? '0 60px' : '18px 40px', borderRadius: 40, boxShadow: '0 16px 40px #0B0B0C33' }}>{c.question ? '?' : '⚡ Live'}</div>
      </div>
    );
  }
  // A note under another picture rides along as a small chip.
  const extraNote = c.lead !== 'note' && c.notes[0];
  return (
    <AbsoluteFill style={{ opacity: out }}>
      {body}
      {extraNote && (
        <div style={{ position: 'absolute', left: 70, right: 70, top: zones.bottom - 30, display: 'flex', justifyContent: 'center', opacity: fade(f, 50, 62) }}>
          <div style={{ background: C.ink, color: C.white, fontFamily: FONT, fontWeight: 800, fontSize: 32, padding: '12px 26px', borderRadius: 999 }}>{extraNote}</div>
        </div>
      )}
    </AbsoluteFill>
  );
};

/** Live Map's look for the pieces Claude places in a scene: white rounded cards, black ink, yellow marker. */
const SKIN: Skin = {
  font: FONT,
  mono: '"JetBrains Mono", Consolas, monospace',
  ink: C.ink,
  sub: C.sub,
  accent: C.yellow,
  hiInk: C.ink,
  hiBg: C.yellow,
  tone: (t) => (t ? TONE[t] : C.ink),
  panel: ({ focus, round }) => ({ style: { background: C.white, borderRadius: round ?? 30, boxShadow: '0 18px 44px #0B0B0C24', border: focus ? `5px solid ${C.ink}` : undefined } }),
  enter: (k) => ({ opacity: k, transform: `translateY(${(1 - k) * 50}px) scale(${0.92 + 0.08 * k})` }),
  Link: ({ a, b, k, frame, label, dashed }) => {
    const e = { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
    const t = ((frame * 0.03) % 1) * (k >= 1 ? 1 : 0);
    const ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
    return (
      <g>
        <line x1={a.x} y1={a.y} x2={e.x} y2={e.y} stroke={C.ink} strokeWidth={12} strokeLinecap="round" strokeDasharray={dashed ? '4 22' : undefined} />
        {!dashed && <line x1={a.x} y1={a.y} x2={e.x} y2={e.y} stroke={C.yellow} strokeWidth={4} strokeDasharray="12 14" strokeDashoffset={-frame * 2} />}
        {k >= 1 && <polygon points="0,-16 26,0 0,16" fill={C.ink} transform={`translate(${b.x},${b.y}) rotate(${ang}) translate(-22,0)`} />}
        {k >= 1 && <circle cx={a.x + (b.x - a.x) * t} cy={a.y + (b.y - a.y) * t} r={13} fill={C.blue} stroke="#fff" strokeWidth={4} />}
        {label && k >= 1 && (
          <g transform={`translate(${(a.x + b.x) / 2},${(a.y + b.y) / 2})`}>
            <rect x={-label.length * 9 - 18} y={-24} width={label.length * 18 + 36} height={48} rx={24} fill={C.ink} />
            <text textAnchor="middle" y={10} fontFamily={FONT} fontWeight={800} fontSize={28} fill={C.yellow}>{label}</text>
          </g>
        )}
      </g>
    );
  },
};

/** Without the map: the same light ground, with a faint street grid. */
const PlainGround: React.FC = () => (
  <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
    <rect width={1080} height={1920} fill={C.bg} />
    {Array.from({ length: 12 }, (_, i) => <line key={`v${i}`} x1={i * 100 + 40} y1={0} x2={i * 100 + 40} y2={1920} stroke="#E4E6EA" strokeWidth={2} />)}
    {Array.from({ length: 20 }, (_, i) => <line key={`h${i}`} x1={0} y1={i * 100 + 20} x2={1080} y2={i * 100 + 20} stroke="#E4E6EA" strokeWidth={2} />)}
  </svg>
);

const Stage: React.FC<SceneProps> = (props) => {
  const leads = props.timed.map((b) => contentOf(b).lead);
  const v = props.beat.visual;
  return (
    <AbsoluteFill style={{ background: C.bg, fontFamily: FONT }}>
      {v && !v.map ? <PlainGround /> : <CityMap {...props} leads={leads} />}
      <AbsoluteFill style={{ background: 'linear-gradient(#F7F7F5 0%, #F7F7F5cc 16%, transparent 30%, transparent 74%, #F7F7F5cc 82%, #F7F7F5 100%)' }} />
      {props.frame < props.storyFrames && (v ? <AbsoluteFill style={{ opacity: fade(props.frame - props.beat.start, props.beat.frames - 8, props.beat.frames, 1, 0) }}><Composer visual={v} beat={props.beat} frame={props.frame} area={{ l: 50, r: 1030, t: props.zones.top, b: props.zones.bottom }} skin={SKIN} logoBase={props.spec.logoBase} /></AbsoluteFill> : <Layer {...props} />)}
      {!props.bare && props.frame < props.storyFrames && <Header {...props} />}
    </AbsoluteFill>
  );
};

const Captions: React.FC<SceneProps> = ({ beat, frame, zones, captions }) => {
  const ch = chunkAt(beat, frame);
  if (!ch) return null;
  const s = captionScale(captions);
  const k = interpolate(ch.since, [-4, 2], [0.85, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <div style={{ position: 'absolute', left: 50, right: 50, top: zones.caption, display: 'flex', justifyContent: 'center', fontFamily: FONT }}>
      <div style={{ background: captions.look === 'plain' ? 'transparent' : C.ink, borderRadius: 30, padding: '20px 32px', transform: `scale(${k})`, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', columnGap: 16, maxWidth: 960 }}>
        {ch.words.map((w, i) => {
          const active = frame >= w.start && frame < (ch.words[i + 1]?.start ?? w.end + 8);
          return (
            <span key={i} style={{ fontSize: 64 * s, fontWeight: 900, letterSpacing: -1, color: active ? C.ink : isKey(beat, w.text) ? C.yellow : C.white, background: active ? C.yellow : 'transparent', borderRadius: 14, padding: '0 10px', WebkitTextStroke: captions.look === 'plain' && !active ? `2px ${C.ink}` : undefined }}>
              {cleanWord(w.text)}
            </span>
          );
        })}
      </div>
    </div>
  );
};

const EndCard: StyleKit['EndCard'] = ({ frame, fps, brand, platform }) => {
  const p = pop(frame, fps);
  const cta = ctaFor(platform);
  return (
    <AbsoluteFill style={{ background: `rgba(11,11,12,${0.92 * p})`, justifyContent: 'center', alignItems: 'center', fontFamily: FONT }}>
      <div style={{ transform: `scale(${0.8 + p * 0.2})`, opacity: p, textAlign: 'center', padding: 60 }}>
        <div style={{ fontSize: 46, fontWeight: 800, color: '#ffffffaa', marginBottom: 24 }}>{cta.small}</div>
        <div style={{ fontSize: 120, fontWeight: 900, color: C.yellow, letterSpacing: -3 }}>{cta.big}</div>
        <div style={{ marginTop: 40, display: 'inline-block', background: C.white, color: C.ink, fontSize: 40, fontWeight: 900, padding: '14px 34px', borderRadius: 999 }}>{brand.handle}</div>
      </div>
    </AbsoluteFill>
  );
};

export const liveMap: StyleKit = {
  Stage,
  Captions,
  EndCard,
  palette: { bg: C.bg, ink: C.ink, accent: C.yellow, panel: C.white, font: FONT, hiBg: C.yellow, hiInk: C.ink },
};
