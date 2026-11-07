import React from 'react';
import { AbsoluteFill, Easing } from 'remotion';
import { captionScale, chunkAt, cleanWord, clamp01, contentOf, countText, ctaFor, extrasOf, fade, isKey, parts, plain, rnd, splitNumber, stepName, Logo, fitSize, type SceneProps, type StyleKit } from './common';

// Dark Keynote: a software-launch stage. Near-black, a hairline grid, soft cool light, one accent colour, and
// interface pieces that snap into place on the beat. One giant number gets a screen of its own.
// Written from the "Dark Tech Keynote" style rulebook in lemo-opuscar (MIT, LemoLab).

const C = { stage: '#07080B', s1: '#111318', s2: '#171A21', s3: '#1E222B', line: 'rgba(255,255,255,0.08)', t1: '#F2F4F8', t2: '#A3A9B6', t3: '#6B7280', accent: '#B7F34A', problem: '#FF5A5F' };
const SANS = 'Inter, "Segoe UI", Arial, sans-serif';
const TIGHT = '"Inter Tight", Inter, Arial, sans-serif';
const MONO = '"JetBrains Mono", Consolas, monospace';
const back = Easing.back(1.3);
/** Snap in: fast out with one small overshoot, over `len` frames from `a`. */
const snap = (f: number, a: number, len = 8) => back(clamp01((f - a) / len));

const Grid: React.FC<{ frame: number }> = ({ frame }) => (
  <AbsoluteFill>
    <AbsoluteFill style={{ background: `radial-gradient(ellipse 90% 50% at 50% 8%, #1A1F2B 0%, ${C.stage} 60%)` }} />
    <div style={{ position: 'absolute', left: 620 + Math.sin(frame / 90) * 30, top: 700, width: 900, height: 900, borderRadius: 999, background: 'radial-gradient(circle, rgba(120,150,255,0.09), transparent 65%)' }} />
    <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
      {Array.from({ length: 23 }, (_, i) => <line key={`v${i}`} x1={i * 48} y1={0} x2={i * 48} y2={1920} stroke="#fff" strokeOpacity={i % 4 ? 0.03 : 0.06} />)}
      {Array.from({ length: 41 }, (_, i) => <line key={`h${i}`} x1={0} y1={i * 48} x2={1080} y2={i * 48} stroke="#fff" strokeOpacity={i % 4 ? 0.03 : 0.06} />)}
    </svg>
    <AbsoluteFill style={{ background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.55) 100%)' }} />
  </AbsoluteFill>
);

const Panel: React.FC<{ style?: React.CSSProperties; children: React.ReactNode; level?: 1 | 2 | 3; glow?: boolean }> = ({ style, children, level = 2, glow }) => (
  <div
    style={{
      position: 'absolute',
      background: level === 1 ? C.s1 : level === 2 ? C.s2 : C.s3,
      border: `1px solid ${glow ? C.accent : C.line}`,
      borderRadius: 26,
      boxShadow: `inset 0 1px 0 rgba(255,255,255,0.06), 0 24px 60px rgba(0,0,0,0.5)${glow ? `, 0 0 40px ${C.accent}44` : ''}`,
      fontFamily: SANS,
      color: C.t1,
      ...style,
    }}
  >
    {children}
  </div>
);

/** Digits that scramble, then lock one by one from the left. */
const Scramble: React.FC<{ value: string; f: number; a: number; size: number; color: string }> = ({ value, f, a, size, color }) => {
  const n = splitNumber(value);
  if (!n) return <span style={{ fontFamily: TIGHT, fontWeight: 600, fontSize: size, color, letterSpacing: -size * 0.045 }}>{value}</span>;
  const final = countText(value, 1);
  const chars = [...final];
  size = fitSize(final, size, 930);
  return (
    <span style={{ whiteSpace: 'nowrap', fontFamily: TIGHT, fontWeight: 600, fontSize: size, color, letterSpacing: -size * 0.045, fontVariantNumeric: 'tabular-nums' }}>
      {chars.map((ch, i) => {
        const lock = a + 6 + i * 3;
        const isDigit = /\d/.test(ch);
        const shown = ch === ' ' ? String.fromCharCode(160) : f >= lock || !isDigit ? ch : String(Math.floor(rnd(i * 13 + Math.floor(f / 2)) * 10));
        const k = isDigit ? 1 + 0.08 * Math.max(0, 1 - Math.abs(f - lock) / 3) : 1;
        return <span key={i} style={{ display: 'inline-block', transform: `scale(${k})`, opacity: f < a ? 0 : 1 }}>{shown}</span>;
      })}
    </span>
  );
};

const Headline: React.FC<SceneProps> = ({ frame, beat, spec, zones, timed }) => {
  const f = frame - beat.start;
  const step = stepName(spec, beat.chapter);
  const total = Math.max(1, spec.steps.length);
  const sweep = clamp01(f / 26);
  const { terms, logos } = extrasOf(beat, spec);
  const size = plain(beat.card.headline).length > 30 ? 74 : 88;
  return (
    <div style={{ position: 'absolute', left: 72, right: 72, top: zones.head + 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: MONO, fontSize: 26, letterSpacing: 4, color: C.t3, textTransform: 'uppercase' }}>
        <span>{beat.chapter > 0 ? `${String(beat.chapter).padStart(2, '0')} / ${String(total).padStart(2, '0')}` : 'INTRO'} · {step || beat.card.eyebrow}</span>
        <span style={{ color: C.accent }}>● LIVE</span>
      </div>
      <div style={{ height: 2, background: C.line, marginTop: 18 }}>
        <div style={{ height: 2, width: `${(100 * (timed.indexOf(beat) + clamp01(f / beat.frames))) / timed.length}%`, background: C.accent }} />
      </div>
      <div
        style={{
          marginTop: 46,
          fontFamily: SANS,
          fontWeight: 600,
          fontSize: size,
          lineHeight: 1.08,
          letterSpacing: -size * 0.03,
          color: C.t1,
          // The light reveal: only what the soft band has passed is lit.
          WebkitMaskImage: `linear-gradient(90deg, #000 ${sweep * 130 - 30}%, rgba(0,0,0,0.06) ${sweep * 130}%)`,
          maskImage: `linear-gradient(90deg, #000 ${sweep * 130 - 30}%, rgba(0,0,0,0.06) ${sweep * 130}%)`,
        }}
      >
        {parts(beat.card.headline).map((p, i) => (p.hi ? <span key={i} style={{ color: C.accent, textShadow: `0 0 30px ${C.accent}66` }}>{p.text}</span> : <span key={i}>{p.text}</span>))}
      </div>
      <div style={{ display: 'flex', gap: 14, marginTop: 26, flexWrap: 'wrap', opacity: fade(f, 20, 30) }}>
        {logos.map((l) => (
          <div key={l.domain} style={{ display: 'flex', alignItems: 'center', gap: 12, background: C.s2, border: `1px solid ${C.line}`, borderRadius: 14, padding: '8px 16px 8px 8px' }}>
            <Logo src={l.url} style={{ width: 40, height: 40, borderRadius: 10, background: '#fff', objectFit: 'contain', padding: 4 }} />
            <span style={{ fontFamily: MONO, fontSize: 24, color: C.t2 }}>{l.name}</span>
          </div>
        ))}
        {terms.map((t) => (
          <div key={t.short} style={{ fontFamily: MONO, fontSize: 24, color: C.t2, border: `1px solid ${C.line}`, borderRadius: 14, padding: '12px 16px' }}>
            <span style={{ color: C.accent }}>{t.short}</span> = {t.full}
          </div>
        ))}
      </div>
    </div>
  );
};

const Picture: React.FC<SceneProps> = ({ frame, beat, zones }) => {
  const f = frame - beat.start;
  const c = contentOf(beat);
  const mid = (zones.top + zones.bottom) / 2 + 40;
  if (c.lead === 'stats') {
    const n = c.stats.length;
    return (
      <>
        {c.stats.map((s, i) => {
          const a = 14 + i * 16;
          const k = snap(f, a, 10);
          const size = n === 1 ? 300 : n === 2 ? 190 : 140;
          const top = n === 1 ? mid - 230 : zones.top + 150 + i * (n === 2 ? 330 : 250);
          const bad = s.tone === 'red';
          return (
            <div key={i} style={{ position: 'absolute', left: 72, right: 72, top, opacity: clamp01(k), transform: `translateY(${(1 - k) * 40}px)` }}>
              <div style={{ fontFamily: MONO, fontSize: 28, letterSpacing: 5, color: C.t3, textTransform: 'uppercase' }}>{s.label}</div>
              <Scramble value={s.value} f={f} a={a} size={size} color={bad ? C.problem : i === 0 ? C.accent : C.t1} />
            </div>
          );
        })}
      </>
    );
  }
  if (c.lead === 'flow') {
    const items = c.flow;
    const gap = Math.min(190, (zones.bottom - zones.top - 120) / items.length);
    const h = gap - 50;
    const done = clamp01((f - 14) / (items.length * 10 + 20));
    const y0 = zones.top + 110;
    const packetY = y0 + h / 2 + ((f * 9) % Math.max(1, gap * (items.length - 1)));
    return (
      <>
        <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <line x1={150} y1={y0 + h / 2} x2={150} y2={y0 + h / 2 + (items.length - 1) * gap * done} stroke={C.accent} strokeOpacity={0.7} strokeWidth={2} />
          {done > 0.95 && <circle cx={150} cy={packetY} r={9} fill={C.accent} style={{ filter: `drop-shadow(0 0 10px ${C.accent})` }} />}
        </svg>
        {items.map((it, i) => {
          const k = snap(f, 14 + i * 10);
          const last = i === items.length - 1;
          return (
            <Panel key={i} glow={last && f > 14 + i * 10 + 10} style={{ left: 110, right: 90, top: y0 + i * gap, height: h, display: 'flex', alignItems: 'center', gap: 26, padding: '0 30px', opacity: clamp01(k), transform: `translateX(${(1 - k) * 80}px)` }}>
              <div style={{ width: 22, height: 22, borderRadius: 99, background: last ? C.accent : C.s3, border: `2px solid ${last ? C.accent : C.t3}`, marginLeft: -12 }} />
              <div style={{ fontFamily: MONO, fontSize: 24, color: C.t3 }}>{String(i + 1).padStart(2, '0')}</div>
              <div style={{ fontSize: Math.min(48, h * 0.4), fontWeight: 600, letterSpacing: -1 }}>{it}</div>
            </Panel>
          );
        })}
      </>
    );
  }
  if (c.lead === 'chips') {
    return (
      <>
        {c.chips.map((ch, i) => {
          const a = 12 + i * 9;
          const k = snap(f, a, 9);
          const bad = ch.strike || ch.tone === 'red';
          return (
            <Panel key={i} level={3} style={{ left: 90 + (i % 2) * 40, right: 130 - (i % 2) * 40, top: zones.top + 140 + i * 150, height: 120, display: 'flex', alignItems: 'center', gap: 24, padding: '0 28px', opacity: clamp01(k), transform: `translateY(${(1 - k) * -60}px)` }}>
              <div style={{ width: 64, height: 64, borderRadius: 18, background: bad ? `${C.problem}22` : `${C.accent}22`, color: bad ? C.problem : C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34, fontWeight: 700 }}>{bad ? '!' : '✓'}</div>
              <div>
                <div style={{ fontFamily: MONO, fontSize: 20, color: C.t3, letterSpacing: 3 }}>{bad ? 'ISSUE' : 'UPDATE'} · now</div>
                <div style={{ fontSize: 40, fontWeight: 600, color: ch.strike ? C.t2 : C.t1, textDecoration: ch.strike ? 'line-through' : undefined }}>{ch.text}</div>
              </div>
            </Panel>
          );
        })}
      </>
    );
  }
  if (c.lead === 'note') {
    const k = snap(f, 14, 10);
    return (
      <Panel glow style={{ left: 90, right: 90, top: mid - 120, padding: '36px 40px', opacity: clamp01(k), transform: `scale(${0.9 + 0.1 * k})` }}>
        <div style={{ fontFamily: MONO, fontSize: 22, letterSpacing: 4, color: C.accent }}>NOTE</div>
        <div style={{ fontSize: 50, fontWeight: 600, marginTop: 12, letterSpacing: -1 }}>{c.notes[0]}</div>
      </Panel>
    );
  }
  // Nothing but the headline: the living element, a cursor and a breathing accent dot.
  const blink = Math.floor(f / 15) % 2 === 0;
  return (
    <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
      <circle cx={540} cy={mid} r={60 + 30 * ((f % 40) / 40)} fill="none" stroke={C.accent} strokeOpacity={1 - (f % 40) / 40} strokeWidth={3} />
      <circle cx={540} cy={mid} r={26} fill={C.accent} style={{ filter: `drop-shadow(0 0 20px ${C.accent})` }} />
      {blink && <rect x={600} y={mid - 50} width={8} height={100} fill={C.t1} />}
    </svg>
  );
};

const Stage: React.FC<SceneProps> = (props) => (
  <AbsoluteFill style={{ background: C.stage }}>
    <Grid frame={props.frame} />
    {props.frame < props.storyFrames && <Picture {...props} />}
    {!props.bare && props.frame < props.storyFrames && <Headline {...props} />}
  </AbsoluteFill>
);

const Captions: React.FC<SceneProps> = ({ beat, frame, zones, captions }) => {
  const ch = chunkAt(beat, frame, 5);
  if (!ch) return null;
  const s = captionScale(captions);
  const k = clamp01((ch.since + 4) / 5);
  return (
    <div style={{ position: 'absolute', left: 70, right: 70, top: zones.caption + 30, display: 'flex', justifyContent: 'center', opacity: k, transform: `translateY(${(1 - k) * 12}px)` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, background: captions.look === 'plain' ? 'transparent' : 'rgba(20,22,28,0.82)', border: captions.look === 'plain' ? undefined : '1px solid rgba(255,255,255,0.12)', borderRadius: 999, padding: '18px 34px', boxShadow: '0 16px 40px rgba(0,0,0,0.45)', maxWidth: 940 }}>
        <div style={{ width: 14, height: 14, borderRadius: 99, background: C.accent, boxShadow: `0 0 12px ${C.accent}`, flexShrink: 0, opacity: Math.floor(frame / 6) % 2 ? 0.6 : 1 }} />
        <span style={{ fontFamily: SANS, fontWeight: 500, fontSize: 46 * s, color: C.t1, lineHeight: 1.2 }}>
          {ch.words.map((w, i) => (
            <span key={i} style={{ color: isKey(beat, w.text) ? C.accent : frame >= w.start ? C.t1 : C.t3 }}>{cleanWord(w.text)} </span>
          ))}
        </span>
      </div>
    </div>
  );
};

const EndCard: StyleKit['EndCard'] = ({ frame, brand, platform }) => {
  const cta = ctaFor(platform);
  const k = snap(frame, 4, 10);
  return (
    <AbsoluteFill style={{ background: C.stage }}>
      <Grid frame={frame} />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', fontFamily: SANS }}>
        <div style={{ width: 240, height: 240, borderRadius: 48, background: C.accent, boxShadow: `0 0 90px ${C.accent}88`, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${k})`, fontFamily: TIGHT, fontSize: 100, fontWeight: 700, color: C.stage }}>{brand.initials}</div>
        <div style={{ marginTop: 70, fontSize: 96, fontWeight: 600, color: C.t1, letterSpacing: -3, opacity: fade(frame, 10, 20) }}>{cta.big}</div>
        <div style={{ marginTop: 18, fontFamily: MONO, fontSize: 36, color: C.t2, opacity: fade(frame, 16, 26) }}>{brand.handle}</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const darkKeynote: StyleKit = {
  Stage,
  Captions,
  EndCard,
  palette: { bg: C.stage, ink: C.t1, accent: C.accent, panel: C.s2, font: SANS, hiBg: 'transparent', hiInk: C.accent },
};
