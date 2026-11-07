import React from 'react';
import { AbsoluteFill } from 'remotion';
import type { Tone } from '../script';
import { Composer, type Skin } from './composer';
import { captionScale, chunkAt, cleanWord, clamp01, contentOf, ctaFor, easeInOut, extrasOf, fade, isKey, parts, plain, pop, rnd, stepName, fitSize, type SceneProps, type StyleKit } from './common';

// Whiteboard: one glossy dry-erase board. Everything is written and drawn in marker in front of the viewer,
// stroke by stroke; each scene lives in its own part of the board and the camera travels between them.
// Written from the "Whiteboard Explainer" style rulebook in lemo-opuscar (MIT, LemoLab).

const C = { board: '#FBFAF6', ink: '#23262c', blue: '#2a5cb3', accent: '#d97757', green: '#2e8b57', red: '#c8363a', ghost: '#9aa6b8', note: '#FFE680' };
const TONE: Record<Tone, string> = { red: C.red, teal: C.green, purple: '#7a4fb3', blue: C.blue, amber: C.accent };
const HAND = 'Kalam, "Comic Sans MS", cursive';

/** A hand-drawn rectangle: corners overshoot a little and the lines wobble. */
function roughRect(x: number, y: number, w: number, h: number, seed: number) {
  const j = (k: number) => (rnd(seed * 17 + k) - 0.5) * 8;
  return `M${x - 6 + j(1)},${y + j(2)} L${x + w + 8 + j(3)},${y + j(4)} M${x + w + j(5)},${y - 6 + j(6)} L${x + w + j(7)},${y + h + 8 + j(8)} M${x + w + 6 + j(9)},${y + h + j(10)} L${x - 8 + j(11)},${y + h + j(12)} M${x + j(13)},${y + h + 6 + j(14)} L${x + j(15)},${y - 8 + j(16)}`;
}
/** A hand-drawn loop around a point that doesn't quite close. */
function roughEllipse(cx: number, cy: number, rx: number, ry: number, seed: number) {
  const pts: string[] = [];
  for (let k = 0; k <= 26; k++) {
    const a = -0.4 + (k / 26) * (Math.PI * 2 + 0.5);
    const wob = 1 + (rnd(seed + k) - 0.5) * 0.06;
    pts.push(`${k ? 'L' : 'M'}${(cx + Math.cos(a) * rx * wob).toFixed(1)},${(cy + Math.sin(a) * ry * wob).toFixed(1)}`);
  }
  return pts.join(' ');
}
const arrowDown = (x: number, y1: number, y2: number, seed: number) => {
  const j = (k: number) => (rnd(seed * 7 + k) - 0.5) * 10;
  return `M${x + j(1)},${y1} Q${x + 18 + j(2)},${(y1 + y2) / 2} ${x},${y2} M${x - 20},${y2 - 26} L${x},${y2} L${x + 22},${y2 - 24}`;
};

/** A stroke that draws itself between frames `a` and `a + len`. */
const Stroke: React.FC<{ d: string; f: number; a: number; len: number; color?: string; width?: number }> = ({ d, f, a, len, color = C.ink, width = 8 }) => {
  const p = clamp01((f - a) / Math.max(1, len));
  const k = p - Math.sin(2 * Math.PI * p) / (2 * Math.PI) * 0.8; // slow-fast-slow, like a hand
  if (p <= 0) return null;
  return <path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - clamp01(k)} opacity={0.94} style={{ mixBlendMode: 'multiply' }} />;
};

/** Handwriting that appears letter by letter, finishing at `a + len`. Highlighted words are written in the accent and underlined. */
const Written: React.FC<{ text: string; f: number; a: number; len: number; size: number; color?: string; align?: 'left' | 'center'; style?: React.CSSProperties }> = ({ text, f, a, len, size, color = C.ink, align = 'left', style }) => {
  const all = plain(text);
  const shown = Math.floor(clamp01((f - a) / Math.max(1, len)) * all.length);
  let used = 0;
  return (
    <div style={{ fontFamily: HAND, fontWeight: 700, fontSize: size, lineHeight: 1.15, color, textAlign: align, ...style }}>
      {parts(text).map((p, i) => {
        const vis = p.text.slice(0, Math.max(0, shown - used));
        const done = shown - used >= p.text.length;
        used += p.text.length;
        return (
          <span key={i} style={p.hi ? { color: C.accent, textDecoration: done ? 'underline' : undefined, textDecorationThickness: 6, textUnderlineOffset: 10, textDecorationColor: C.accent } : undefined}>
            {vis}
            {!done && <span style={{ visibility: 'hidden' }}>{p.text.slice(vis.length)}</span>}
          </span>
        );
      })}
    </div>
  );
};

/** A floating marker (no hand), with a shadow that grows when it lifts. */
const Pen: React.FC<{ x: number; y: number; color: string; lift: number }> = ({ x, y, color, lift }) => (
  <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
    <ellipse cx={x + 30 + lift * 20} cy={y + 20 + lift * 26} rx={60} ry={14} fill="#000" opacity={0.08 + 0.06 * (1 - lift)} />
    <g transform={`translate(${x},${y - lift * 30}) rotate(-35)`}>
      <rect x={0} y={-14} width={190} height={28} rx={12} fill="#f4f4f2" stroke="#c9c9c4" strokeWidth={2} />
      <rect x={128} y={-15} width={62} height={30} rx={12} fill={color} />
      <path d="M0,-9 L-22,-3 L-22,3 L0,9 Z" fill={color} />
    </g>
  </svg>
);

/** Whiteboard's look for Claude's scene pieces: no fill, a hand-drawn marker outline that draws itself, arrows drawn on. */
const SKIN: Skin = {
  font: HAND,
  mono: HAND,
  ink: C.ink,
  sub: '#5b6170',
  accent: C.accent,
  hiInk: C.accent,
  hiBg: 'transparent',
  tone: (t) => (t ? TONE[t] : C.blue),
  panel: ({ w, h, k, color, focus, seed, frame }) => ({
    style: {},
    overlay: (
      <svg width={w + 40} height={h + 40} style={{ position: 'absolute', left: -20, top: -20, overflow: 'visible', pointerEvents: 'none' }}>
        <Stroke d={roughRect(20, 20, w, h, seed + 7)} f={k * 12} a={0} len={12} color={focus ? C.accent : color === C.blue ? C.ink : color} width={focus ? 9 : 7} />
        {focus && frame >= 0 && <Stroke d={roughEllipse(20 + w / 2, 20 + h / 2, w * 0.62, h * 0.72, seed)} f={k * 12} a={6} len={10} color={C.accent} width={5} />}
      </svg>
    ),
  }),
  enter: (k) => ({ opacity: k > 0 ? 1 : 0, clipPath: `inset(0 ${(1 - clamp01(k * 1.4)) * 100}% 0 0)` }),
  Link: ({ a, b, k, label, seed }) => {
    const mx = (a.x + b.x) / 2 + (rnd(seed) - 0.5) * 60;
    const my = (a.y + b.y) / 2 + (rnd(seed + 3) - 0.5) * 60;
    const ang = Math.atan2(b.y - my, b.x - mx);
    const head = `M${b.x - 28 * Math.cos(ang - 0.5)},${b.y - 28 * Math.sin(ang - 0.5)} L${b.x},${b.y} L${b.x - 28 * Math.cos(ang + 0.5)},${b.y - 28 * Math.sin(ang + 0.5)}`;
    return (
      <g>
        <Stroke d={`M${a.x},${a.y} Q${mx},${my} ${b.x},${b.y}`} f={k * 14} a={0} len={14} color={C.blue} width={7} />
        {k >= 1 && <Stroke d={head} f={1} a={0} len={1} color={C.blue} width={7} />}
        {label && k >= 1 && (
          <text x={mx + 16} y={my - 8} fontFamily={HAND} fontWeight={700} fontSize={34} fill={C.blue}>
            {label}
          </text>
        )}
      </g>
    );
  },
};

/** Where scene i sits on the big board. */
const regionOf = (i: number) => ({ x: (i % 2) * 1240 + (Math.floor(i / 2) % 2) * 260, y: Math.floor(i / 2) * 1620 });

const Region: React.FC<SceneProps & { i: number; f: number }> = ({ i, f, fps, timed, zones, spec, bare }) => {
  const beat = timed[i]!;
  const c = contentOf(beat);
  const color = TONE[beat.card.tone] ?? C.blue;
  const head = bare ? 0 : Math.min(36, 10 + plain(beat.card.headline).length * 0.9);
  const t0 = 8 + head; // the picture starts once the headline is written
  const mid = (zones.top + zones.bottom) / 2;
  const { terms } = extrasOf(beat, spec);
  let pen = { x: 840, y: zones.top + 40, until: t0 };
  let picture: React.ReactNode = null;
  if (beat.visual) {
    picture = <Composer visual={beat.visual} beat={{ ...beat, start: beat.start }} frame={beat.start + f} area={{ l: 50, r: 1030, t: zones.top, b: zones.bottom }} skin={SKIN} logoBase={spec.logoBase} />;
    pen = { x: 940, y: zones.top + 60, until: t0 + 30 };
  } else if (c.lead === 'flow') {
    const n = c.flow.length;
    const gap = Math.min(220, (zones.bottom - zones.top - 60) / n);
    const h = Math.min(130, gap - 70);
    picture = c.flow.map((it, k) => {
      const y = zones.top + 30 + k * gap;
      const a = t0 + k * 22;
      if (f >= a) pen = { x: 900, y: y + h / 2, until: a + 22 };
      return (
        <React.Fragment key={k}>
          <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
            <Stroke d={roughRect(190, y, 700, h, i * 10 + k)} f={f} a={a} len={12} color={k === n - 1 ? color : C.ink} />
            {k < n - 1 && <Stroke d={arrowDown(540, y + h + 12, y + gap - 12, i * 10 + k)} f={f} a={a + 14} len={8} color={C.blue} width={7} />}
          </svg>
          <Written text={it} f={f} a={a + 6} len={12} size={Math.min(58, h * 0.48)} align="center" style={{ position: 'absolute', left: 200, width: 680, top: y + h / 2 - Math.min(58, h * 0.48) * 0.62 }} />
        </React.Fragment>
      );
    });
  } else if (c.lead === 'stats') {
    const n = c.stats.length;
    picture = c.stats.map((s, k) => {
      const cx = n === 1 ? 540 : n === 2 ? (k ? 790 : 290) : 540;
      const cy = n === 3 ? zones.top + 110 + k * 230 : mid - 40;
      const size = fitSize(s.value, n === 1 ? 170 : n === 2 ? 120 : 92, n === 2 ? 470 : 900);
      const a = t0 + k * 26;
      if (f >= a) pen = { x: cx + 160, y: cy, until: a + 26 };
      return (
        <React.Fragment key={k}>
          <Written text={s.value} f={f} a={a} len={14} size={size} color={s.tone ? TONE[s.tone] : color} align="center" style={{ position: 'absolute', left: cx - 260, width: 520, top: cy - size * 0.66 }} />
          <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
            <Stroke d={roughEllipse(cx, cy, n === 1 ? 330 : n === 2 ? 220 : 260, size * 0.85, i * 5 + k)} f={f} a={a + 14} len={14} color={C.accent} width={7} />
          </svg>
          <Written text={s.label} f={f} a={a + 16} len={10} size={n === 3 ? 40 : 46} color={C.ink} align="center" style={{ position: 'absolute', left: cx - 260, width: 520, top: cy + size * 0.85 + 10 }} />
        </React.Fragment>
      );
    });
    if (n === 2) picture = [picture, <Written key="vs" text="vs" f={f} a={t0 + 20} len={6} size={60} color={C.ghost} align="center" style={{ position: 'absolute', left: 490, width: 100, top: mid - 80 }} />];
  } else if (c.lead === 'chips') {
    picture = c.chips.map((ch, k) => {
      const y = zones.top + 40 + k * 150;
      const a = t0 + k * 20;
      if (f >= a) pen = { x: 260, y: y + 40, until: a + 20 };
      const mark = ch.strike ? `M140,${y + 10} L210,${y + 80} M210,${y + 10} L140,${y + 80}` : `M136,${y + 46} L166,${y + 78} L222,${y + 2}`;
      return (
        <React.Fragment key={k}>
          <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
            <Stroke d={roughRect(130, y, 90, 90, i * 3 + k)} f={f} a={a} len={8} />
            <Stroke d={mark} f={f} a={a + 14} len={6} color={ch.strike ? C.red : C.green} width={10} />
          </svg>
          <Written text={ch.text} f={f} a={a + 4} len={12} size={56} color={ch.strike ? C.ghost : C.ink} style={{ position: 'absolute', left: 260, right: 60, top: y + 8, textDecoration: ch.strike ? 'line-through' : undefined }} />
        </React.Fragment>
      );
    });
  } else if (c.lead === 'note') {
    const k = pop(f, fps, t0, 11);
    picture = (
      <div style={{ position: 'absolute', left: 170, top: mid - 260, width: 740, height: 460, background: C.note, transform: `rotate(-3deg) translateY(${(1 - k) * -120}px)`, opacity: k, boxShadow: '0 18px 30px #0002', padding: 50 }}>
        <div style={{ position: 'absolute', left: 340, top: -26, width: 60, height: 60, borderRadius: 99, background: `radial-gradient(circle at 35% 30%, #fff, ${color} 45%)`, boxShadow: '0 6px 10px #0004' }} />
        <Written text={c.notes[0]!} f={f} a={t0 + 10} len={24} size={60} />
      </div>
    );
  } else {
    picture = (
      <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
        <Stroke d={c.question ? `M420,${mid - 150} C420,${mid - 300} 680,${mid - 300} 680,${mid - 150} C680,${mid - 50} 550,${mid - 60} 550,${mid + 60} M550,${mid + 150} L552,${mid + 162}` : roughEllipse(540, mid, 300, 200, i)} f={f} a={t0} len={24} color={color} width={18} />
      </svg>
    );
    pen = { x: 700, y: mid, until: t0 + 24 };
  }
  // The pen rests off to the side once its last stroke is done.
  const lift = clamp01((f - pen.until) / 10);
  const step = stepName(spec, beat.chapter);
  return (
    <>
      {!bare && (
        <div style={{ position: 'absolute', left: 70, right: 70, top: zones.head + 30 }}>
          {step && <Written text={`${beat.chapter}. ${step}`} f={f} a={0} len={8} size={42} color={C.blue} />}
          <Written text={beat.card.headline} f={f} a={6} len={head} size={plain(beat.card.headline).length > 34 ? 76 : 92} style={{ marginTop: 12 }} />
          {terms.map((t) => (
            <Written key={t.short} text={`${t.short} = ${t.full}`} f={f} a={t0 + 40} len={14} size={38} color={C.green} style={{ marginTop: 10 }} />
          ))}
        </div>
      )}
      {picture}
      <Pen x={lerpN(pen.x, 980, lift)} y={lerpN(pen.y, zones.bottom + 40, lift)} color={color} lift={lift} />
    </>
  );
};
const lerpN = (a: number, b: number, t: number) => a + (b - a) * t;

/** Old faint marks on the board, so it looks used. */
const Ghosts: React.FC = () => (
  <svg width={6000} height={9000} style={{ position: 'absolute', left: -1000, top: -1000 }}>
    {Array.from({ length: 70 }, (_, k) => {
      const x = rnd(k) * 6000;
      const y = rnd(k + 300) * 9000;
      return k % 3 ? <path key={k} d={roughEllipse(x, y, 60 + rnd(k + 7) * 120, 40 + rnd(k + 9) * 70, k)} fill="none" stroke={C.ghost} strokeWidth={6} opacity={0.08} /> : <path key={k} d={`M${x},${y} L${x + 220},${y + 30}`} stroke={C.ghost} strokeWidth={8} opacity={0.07} />;
    })}
  </svg>
);

const Stage: React.FC<SceneProps> = (props) => {
  const { frame, timed, index } = props;
  const beat = timed[index]!;
  const f = frame - beat.start;
  const a = regionOf(Math.max(0, index - 1));
  const b = regionOf(index);
  const t = index === 0 ? 1 : easeInOut(clamp01(f / 22));
  const cam = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  // A whip move zooms out a little in the middle, so the viewer sees where the camera travels.
  const z = 1 - 0.18 * Math.sin(Math.PI * t) * (index === 0 ? 0 : 1);
  const sheen = (frame * 0.6) % 2400;
  const show = [index - 1, index].filter((i) => i >= 0);
  return (
    <AbsoluteFill style={{ background: `linear-gradient(160deg, ${C.board}, #F1EFE8)`, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, transform: `translate(540px,960px) scale(${z}) translate(${-cam.x - 540}px,${-cam.y - 960}px)` }}>
        <Ghosts />
        {show.map((i) => (
          <div key={i} style={{ position: 'absolute', left: regionOf(i).x, top: regionOf(i).y, width: 1080, height: 1920, opacity: i === index ? 1 : 0.28 }}>
            <Region {...props} i={i} f={frame - timed[i]!.start} />
          </div>
        ))}
      </div>
      <div style={{ position: 'absolute', left: sheen - 900, top: -400, width: 500, height: 3000, transform: 'rotate(24deg)', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.14), transparent)' }} />
    </AbsoluteFill>
  );
};

const Captions: React.FC<SceneProps> = ({ beat, frame, zones, captions }) => {
  const ch = chunkAt(beat, frame, 6);
  if (!ch) return null;
  const s = captionScale(captions);
  return (
    <div style={{ position: 'absolute', left: 60, right: 60, top: zones.caption + 20, display: 'flex', justifyContent: 'center', opacity: fade(ch.since, -4, 3) }}>
      <div style={{ background: captions.look === 'plain' ? 'transparent' : 'rgba(255,253,246,0.94)', borderRadius: 26, padding: '16px 30px 18px', boxShadow: captions.look === 'plain' ? undefined : '0 6px 18px #0001', maxWidth: 960, textAlign: 'center' }}>
        <div style={{ width: 70, height: 7, borderRadius: 4, background: C.accent, margin: '0 auto 8px' }} />
        <span style={{ fontFamily: HAND, fontWeight: 700, fontSize: 54 * s, color: C.ink, lineHeight: 1.2 }}>
          {ch.words.map((w, i) => (
            <span key={i} style={{ color: isKey(beat, w.text) ? C.accent : frame >= w.start ? C.ink : '#23262c66' }}>{cleanWord(w.text)} </span>
          ))}
        </span>
      </div>
    </div>
  );
};

const EndCard: StyleKit['EndCard'] = ({ frame, fps, brand, platform }) => {
  const cta = ctaFor(platform);
  const k = pop(frame, fps);
  return (
    <AbsoluteFill style={{ background: C.board, opacity: k, justifyContent: 'center', alignItems: 'center' }}>
      <Written text={cta.small} f={frame} a={0} len={14} size={60} color={C.blue} align="center" />
      <Written text={`*${cta.big}*`} f={frame} a={10} len={18} size={140} align="center" style={{ marginTop: 20 }} />
      <svg width={1080} height={300} style={{ position: 'absolute', top: 1060 }}>
        <Stroke d={roughEllipse(540, 120, 330, 80, 3)} f={frame} a={30} len={16} color={C.ink} width={6} />
      </svg>
      <Written text={brand.handle} f={frame} a={30} len={12} size={64} align="center" style={{ position: 'absolute', top: 1140, left: 0, right: 0 }} />
    </AbsoluteFill>
  );
};

export const whiteboard: StyleKit = {
  Stage,
  Captions,
  EndCard,
  palette: { bg: C.board, ink: C.ink, accent: C.accent, panel: '#FFFFFF', font: HAND, hiBg: 'transparent', hiInk: C.accent },
};
