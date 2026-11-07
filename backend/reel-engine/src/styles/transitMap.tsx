import React from 'react';
import { AbsoluteFill } from 'remotion';
import type { Tone } from '../script';
import { captionScale, chunkAt, cleanWord, clamp01, contentOf, countText, ctaFor, easeInOut, extrasOf, fade, isKey, parts, plain, pop, splitNumber, Logo, type SceneProps, type StyleKit } from './common';

// Transit Map: a metro schematic printed on paper. The reel is one line: every scene is a station, and a glowing
// pen tip draws the line from stop to stop while the camera follows it. Lists become branch lines with their
// own stops, numbers roll on a small mechanical counter. Lines keep to eight directions.
// Written from the "Transit Map" style rulebook in lemo-opuscar (MIT, LemoLab).

const C = { paper: '#F2EEE5', ink: '#1B1C1E', sub: '#4A4740', river: '#BCD6EA', riverEdge: '#8FB5D6', accent: '#E3002B', navy: '#24346E' };
const LINE: Record<Tone, string> = { red: '#E3002B', teal: '#009B77', purple: '#8E4FB0', blue: '#0072BC', amber: '#F39800' };
const BRANCH = ['#0072BC', '#009B77', '#F39800', '#8E4FB0', '#24346E'];
const FONT = 'Inter, "Segoe UI", Arial, sans-serif';
const G = 110;
const SPACING = 3.2 * G;
const DIRS = [
  [1, 0],
  [Math.SQRT1_2, Math.SQRT1_2],
  [1, 0],
  [Math.SQRT1_2, -Math.SQRT1_2],
] as const;

type Pt = { x: number; y: number };
function stations(n: number): Pt[] {
  const out: Pt[] = [{ x: 0, y: 0 }];
  for (let i = 1; i < n; i++) {
    const d = DIRS[(i - 1) % DIRS.length]!;
    const p = out[i - 1]!;
    out.push({ x: p.x + d[0] * SPACING, y: p.y + d[1] * SPACING });
  }
  return out;
}
const CENTER = { x: 380, y: 760 };

/** Text printed on the sheet, with a paper-coloured halo under it. */
const Label: React.FC<{ x: number; y: number; text: string; size: number; weight?: number; anchor?: 'start' | 'middle' | 'end'; color?: string; opacity?: number }> = ({ x, y, text, size, weight = 700, anchor = 'start', color = C.ink, opacity = 1 }) => (
  <text x={x} y={y} fontFamily={FONT} fontSize={size} fontWeight={weight} textAnchor={anchor} fill={color} stroke={C.paper} strokeWidth={size * 0.22} paintOrder="stroke" strokeLinejoin="round" opacity={opacity}>
    {text}
  </text>
);

const Stop: React.FC<{ x: number; y: number; color: string; r?: number; closed?: boolean; k?: number }> = ({ x, y, color, r = 0.13 * G, closed, k = 1 }) => (
  <g transform={`translate(${x},${y}) scale(${k})`}>
    <circle r={r} fill="#fff" stroke={closed ? '#9A958B' : color} strokeWidth={0.07 * G} />
    {closed && <path d={`M${-r * 0.6},${-r * 0.6} L${r * 0.6},${r * 0.6} M${r * 0.6},${-r * 0.6} L${-r * 0.6},${r * 0.6}`} stroke="#9A958B" strokeWidth={5} />}
  </g>
);

const Sheet: React.FC<SceneProps> = (props) => {
  const { frame, timed, index, fps, zones } = props;
  const beat = timed[index]!;
  const f = frame - beat.start;
  const pts = stations(timed.length);
  const main = LINE[timed[0]!.card.tone] ?? C.accent;
  // The pen draws from the previous station to this one during the first second of the scene.
  const draw = index === 0 ? 1 : easeInOut(clamp01(f / 26));
  const from = pts[Math.max(0, index - 1)]!;
  const to = pts[index]!;
  const tip = { x: from.x + (to.x - from.x) * draw, y: from.y + (to.y - from.y) * draw };
  const cam = tip;
  const tx = CENTER.x - cam.x;
  const ty = CENTER.y - cam.y;
  const linePts = [...pts.slice(0, index), tip];
  const d = linePts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const c = contentOf(beat);
  const branchItems = c.lead === 'flow' ? c.flow : c.lead === 'chips' ? c.chips.map((ch) => ch.text) : [];
  const closed = c.lead === 'chips' ? c.chips.map((ch) => !!ch.strike) : [];
  const bColor = BRANCH[index % BRANCH.length]!;
  const branchGap = Math.min(1.5 * G, (zones.bottom - zones.top - 2 * G) / Math.max(1, branchItems.length));
  const bStart = 12;
  const bDraw = clamp01((f - bStart - 18) / (branchItems.length * 10 + 10));
  // The branch: one diagonal step down-right, then straight down.
  const bPts: Pt[] = [to, { x: to.x + 0.9 * G, y: to.y + 0.9 * G }];
  branchItems.forEach((_, i) => bPts.push({ x: to.x + 0.9 * G, y: to.y + 0.9 * G + (i + 1) * branchGap }));
  const bLen = bPts.length - 1;
  const bPath = bPts.slice(0, 1 + Math.ceil(bDraw * bLen)).map((p, i, arr) => {
    const last = i === arr.length - 1 && i > 0;
    const prev = arr[i - 1];
    const part = bDraw * bLen - (i - 1);
    const q = last && prev && part < 1 ? { x: prev.x + (p.x - prev.x) * part, y: prev.y + (p.y - prev.y) * part } : p;
    return `${i ? 'L' : 'M'}${q.x.toFixed(1)},${q.y.toFixed(1)}`;
  }).join(' ');

  return (
    <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
      <defs>
        <filter id="paper">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={3} />
          <feColorMatrix values="0 0 0 0 0.4  0 0 0 0 0.37  0 0 0 0 0.3  0 0 0 0.07 0" />
        </filter>
        <radialGradient id="halo">
          <stop offset="0%" stopColor={main} stopOpacity={0.45} />
          <stop offset="100%" stopColor={main} stopOpacity={0} />
        </radialGradient>
      </defs>
      <rect width={1080} height={1920} fill={C.paper} />
      <rect width={1080} height={1920} filter="url(#paper)" />
      <g transform={`translate(${tx.toFixed(1)},${ty.toFixed(1)})`}>
        {/* a river crossing the city, edges on the eight directions */}
        <path d={`M${-1200},${1.6 * G + 420} L${pts[pts.length - 1]!.x * 0.5},${1.6 * G + 420} L${pts[pts.length - 1]!.x * 0.5 + 500},${1.6 * G - 80} L${pts[pts.length - 1]!.x + 2000},${1.6 * G - 80}`} fill="none" stroke={C.riverEdge} strokeWidth={0.76 * G + 6} strokeLinejoin="round" opacity={0.9} />
        <path d={`M${-1200},${1.6 * G + 420} L${pts[pts.length - 1]!.x * 0.5},${1.6 * G + 420} L${pts[pts.length - 1]!.x * 0.5 + 500},${1.6 * G - 80} L${pts[pts.length - 1]!.x + 2000},${1.6 * G - 80}`} fill="none" stroke={C.river} strokeWidth={0.76 * G} strokeLinejoin="round" />
        {/* the main line so far */}
        <path d={d} fill="none" stroke={main} strokeWidth={0.15 * G * 1.6} strokeLinecap="round" strokeLinejoin="round" />
        {pts.slice(0, index + (draw >= 1 ? 1 : 0)).map((p, i) => (
          <React.Fragment key={i}>
            {i > 0 && <Stop x={(p.x + pts[i - 1]!.x) / 2} y={(p.y + pts[i - 1]!.y) / 2} color={main} r={0.09 * G} />}
            {i === index ? (
              <g>
                <rect x={p.x - 0.32 * G} y={p.y - 0.32 * G} width={0.64 * G} height={0.64 * G} rx={0.32 * G} fill="#fff" stroke={C.ink} strokeWidth={0.07 * G} />
              </g>
            ) : (
              <Stop x={p.x} y={p.y} color={main} r={0.16 * G} />
            )}
            <Label x={p.x} y={p.y - 0.55 * G} text={timed[i]!.card.eyebrow || `Stop ${i + 1}`} size={i === index ? 34 : 26} anchor="middle" opacity={i === index ? 1 : 0.7} />
          </React.Fragment>
        ))}
        {/* this scene's branch line */}
        {branchItems.length > 0 && f > bStart + 18 && <path d={bPath} fill="none" stroke={bColor} strokeWidth={0.15 * G * 1.4} strokeLinecap="round" strokeLinejoin="round" />}
        {branchItems.map((it, i) => {
          const p = bPts[i + 2]!;
          const at = bStart + 18 + ((i + 1.5) / bLen) * (branchItems.length * 10 + 10);
          const k = pop(f, fps, at, 11);
          return (
            <g key={i} opacity={clamp01(k)}>
              <Stop x={p.x} y={p.y} color={bColor} closed={closed[i]} k={k} r={0.15 * G} />
              <Label x={p.x + 0.4 * G} y={p.y + 14} text={it} size={40} weight={i === branchItems.length - 1 && c.lead === 'flow' ? 800 : 600} color={closed[i] ? '#9A958B' : C.ink} />
            </g>
          );
        })}
        {/* the pen tip */}
        {draw < 1 && (
          <g transform={`translate(${tip.x},${tip.y})`}>
            <circle r={0.8 * G} fill="url(#halo)" />
            <circle r={0.11 * G} fill="#fff" stroke={main} strokeWidth={0.05 * G} />
          </g>
        )}
      </g>
    </svg>
  );
};

/** The mechanical counter: digits roll into place like a ticket machine. */
const Counter: React.FC<{ label: string; value: string; f: number; a: number; color: string }> = ({ label, value, f, a, color }) => {
  const n = splitNumber(value);
  const text = n ? countText(value, clamp01((f - a) / 30)) : value;
  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', background: C.ink, borderRadius: 18, padding: '16px 24px 18px', boxShadow: '0 14px 30px rgba(0,0,0,0.25)' }}>
      <div style={{ fontFamily: FONT, fontSize: 24, fontWeight: 700, letterSpacing: 4, color: '#BDB7AA', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
        {[...text].map((ch, i) => (
          <div key={i} style={{ minWidth: /\d/.test(ch) ? 64 : 24, height: 92, borderRadius: 10, background: /\d/.test(ch) ? '#2A2B2F' : 'transparent', color: /\d/.test(ch) ? '#fff' : color, fontFamily: FONT, fontWeight: 800, fontSize: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', fontVariantNumeric: 'tabular-nums', borderTop: /\d/.test(ch) ? `4px solid ${color}` : undefined }}>
            {ch}
          </div>
        ))}
      </div>
    </div>
  );
};

const Overlay: React.FC<SceneProps> = ({ frame, fps, beat, spec, zones, bare, index }) => {
  const f = frame - beat.start;
  const c = contentOf(beat);
  const line = LINE[beat.card.tone] ?? C.accent;
  const { terms, logos } = extrasOf(beat, spec);
  const k = pop(f, fps, 0, 15);
  return (
    <AbsoluteFill>
      {!bare && (
        <div style={{ position: 'absolute', left: 60, right: 60, top: zones.head, transform: `translateY(${(1 - k) * -30}px)`, opacity: k }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 26, background: '#fff', borderRadius: 26, padding: '28px 32px', boxShadow: '0 10px 30px rgba(27,28,30,0.14)', borderLeft: `14px solid ${line}` }}>
            <div style={{ width: 92, height: 92, borderRadius: 99, background: line, color: '#fff', fontFamily: FONT, fontWeight: 800, fontSize: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{index + 1}</div>
            <div>
              <div style={{ fontFamily: FONT, fontSize: 26, fontWeight: 700, letterSpacing: 3, color: C.sub, textTransform: 'uppercase' }}>{beat.card.eyebrow}</div>
              <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: plain(beat.card.headline).length > 32 ? 58 : 68, lineHeight: 1.1, color: C.ink, letterSpacing: -1, marginTop: 6 }}>
                {parts(beat.card.headline).map((p, i) => (p.hi ? <span key={i} style={{ color: line }}>{p.text}</span> : <span key={i}>{p.text}</span>))}
              </div>
              {(terms.length > 0 || logos.length > 0) && (
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 14, alignItems: 'center' }}>
                  {logos.map((l) => <Logo key={l.domain} src={l.url} style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'contain', background: '#fff', border: '2px solid #E2DDD2', padding: 4 }} />)}
                  {terms.map((t) => (
                    <span key={t.short} style={{ fontFamily: FONT, fontSize: 26, color: C.sub }}>
                      <b style={{ color: C.ink }}>{t.short}</b> {t.full}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {c.lead === 'stats' && (
        <div style={{ position: 'absolute', left: 70, right: 70, top: zones.top + 280, display: 'flex', flexDirection: 'column', gap: 26, alignItems: 'flex-start' }}>
          {c.stats.map((s, i) => (
            <div key={i} style={{ opacity: fade(f, 16 + i * 14, 24 + i * 14), transform: `translateX(${(1 - clamp01((f - 16 - i * 14) / 10)) * -60}px)` }}>
              <Counter label={s.label} value={s.value} f={f} a={18 + i * 14} color={s.tone ? LINE[s.tone] : line} />
            </div>
          ))}
        </div>
      )}
      {(c.lead === 'note' || c.lead === 'headline') && c.notes[0] && (
        <div style={{ position: 'absolute', left: 90, right: 90, top: zones.bottom - 260, opacity: fade(f, 20, 32) }}>
          <div style={{ borderLeft: `12px solid ${line}`, paddingLeft: 26, fontFamily: FONT, fontSize: 46, fontWeight: 700, color: C.ink, background: 'rgba(242,238,229,0.9)', padding: '14px 26px' }}>{c.notes[0]}</div>
        </div>
      )}
    </AbsoluteFill>
  );
};

const Stage: React.FC<SceneProps> = (props) => (
  <AbsoluteFill style={{ background: C.paper }}>
    <Sheet {...props} />
    <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 30% 30%, transparent 55%, rgba(60,50,30,0.18) 100%)' }} />
    {props.frame < props.storyFrames && <Overlay {...props} />}
  </AbsoluteFill>
);

const Captions: React.FC<SceneProps> = ({ beat, frame, zones, captions }) => {
  const ch = chunkAt(beat, frame, 5);
  if (!ch) return null;
  const s = captionScale(captions);
  const line = LINE[beat.card.tone] ?? C.accent;
  return (
    <div style={{ position: 'absolute', left: 60, right: 60, top: zones.caption + 20, display: 'flex', justifyContent: 'center', opacity: fade(ch.since, -4, 2) }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, background: captions.look === 'plain' ? 'transparent' : '#fff', borderRadius: 18, padding: '16px 28px', boxShadow: captions.look === 'plain' ? undefined : '0 8px 22px rgba(27,28,30,0.16)', maxWidth: 960 }}>
        <div style={{ width: 22, height: 22, borderRadius: 99, background: line, flexShrink: 0 }} />
        <span style={{ fontFamily: FONT, fontWeight: 800, fontSize: 52 * s, color: C.ink, lineHeight: 1.18 }}>
          {ch.words.map((w, i) => (
            <span key={i} style={{ color: isKey(beat, w.text) ? line : frame >= w.start ? C.ink : '#1B1C1E55' }}>{cleanWord(w.text)} </span>
          ))}
        </span>
      </div>
    </div>
  );
};

const EndCard: StyleKit['EndCard'] = ({ frame, fps, brand, platform }) => {
  const cta = ctaFor(platform);
  const k = pop(frame, fps, 0, 12);
  return (
    <AbsoluteFill style={{ background: C.paper, justifyContent: 'center', alignItems: 'center', fontFamily: FONT, opacity: clamp01(k * 1.4) }}>
      <svg width={1080} height={300}>
        <line x1={0} y1={150} x2={540 * k} y2={150} stroke={C.accent} strokeWidth={30} strokeLinecap="round" />
        <circle cx={540} cy={150} r={58 * k} fill="#fff" stroke={C.ink} strokeWidth={12} />
      </svg>
      <div style={{ fontSize: 40, fontWeight: 700, color: C.sub, letterSpacing: 6, textTransform: 'uppercase' }}>Last stop · {cta.small}</div>
      <div style={{ fontSize: 120, fontWeight: 900, color: C.ink, letterSpacing: -3, marginTop: 14 }}>{cta.big}</div>
      <div style={{ marginTop: 26, background: C.accent, color: '#fff', fontSize: 42, fontWeight: 800, padding: '12px 34px', borderRadius: 999 }}>{brand.handle}</div>
    </AbsoluteFill>
  );
};

export const transitMap: StyleKit = {
  Stage,
  Captions,
  EndCard,
  palette: { bg: C.paper, ink: C.ink, accent: C.accent, panel: '#FFFFFF', font: FONT, hiBg: 'transparent', hiInk: C.accent },
};
