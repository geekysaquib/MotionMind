import React from 'react';
import { AbsoluteFill, Easing } from 'remotion';
import type { Tone } from '../script';
import { Composer, type Skin } from './composer';
import { captionScale, chunkAt, cleanWord, clamp01, contentOf, countText, ctaFor, extrasOf, fade, isKey, parts, plain, Logo, fitSize, type SceneProps, type StyleKit } from './common';

// Newsroom: social-video news that reads with the sound off. Huge captions are the lead actor, slammed in a
// chunk at a time with the keyword on a yellow block; the picture above them is a ledger-style data card
// (rolling counters, numbered panels, a split screen, a highlighted document). Hard cuts and a white flash.
// Written from the "Caption News" style rulebook in lemo-opuscar (MIT, LemoLab).

const C = { ledger: '#151512', desk: '#0B0B0A', ivory: '#F7F5EF', honey: '#FFC21A', red: '#FF4A3D', grey: '#8D8B83', dim: '#5E5C55', ink: '#0E0E0C' };
const TONE: Record<Tone, string> = { red: C.red, teal: '#3DD68C', purple: '#B48CFF', blue: '#5AB0FF', amber: C.honey };
const SANS = 'Inter, "Segoe UI", Arial, sans-serif';
const TIGHT = '"Inter Tight", Inter, Arial, sans-serif';
const DISPLAY = 'Anton, "Inter Tight", Impact, sans-serif';
const back = Easing.back(1.6);

/** The data card ground: a dark ruled sheet with a red double margin, pushed in slowly. */
const Ledger: React.FC<{ f: number; bottom: number }> = ({ f, bottom }) => (
  <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: bottom, overflow: 'hidden', background: C.desk }}>
    <div style={{ position: 'absolute', inset: 0, transform: `scale(${1 + f * 0.0006})`, background: C.ledger }}>
      <svg width={1080} height={bottom} style={{ position: 'absolute', inset: 0 }}>
        {Array.from({ length: Math.ceil(bottom / 54) }, (_, i) => <line key={i} x1={0} y1={i * 54} x2={1080} y2={i * 54} stroke="#fff" strokeOpacity={0.045} />)}
        <line x1={78} y1={0} x2={78} y2={bottom} stroke={C.red} strokeOpacity={0.55} strokeWidth={2} />
        <line x1={86} y1={0} x2={86} y2={bottom} stroke={C.red} strokeOpacity={0.55} strokeWidth={2} />
      </svg>
    </div>
    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(transparent 60%, rgba(0,0,0,0.75))' }} />
  </div>
);

const Bug: React.FC<SceneProps> = ({ spec, beat, frame }) => {
  const f = frame - beat.start;
  const { logos } = extrasOf(beat, spec);
  return (
    <div style={{ position: 'absolute', left: 60, top: spec.platform === 'youtube' ? 150 : 70, fontFamily: SANS }}>
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        <div style={{ background: C.honey, color: C.ink, fontWeight: 900, fontSize: 30, padding: '10px 18px', letterSpacing: 1 }}>{spec.brand.name.toUpperCase()}</div>
        <div style={{ background: 'rgba(0,0,0,0.6)', color: C.ivory, fontWeight: 700, fontSize: 26, padding: '12px 18px', letterSpacing: 3, textTransform: 'uppercase', maxWidth: 560, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{spec.title}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12, transform: `translateX(${(1 - clamp01(f / 6)) * -40}px)`, opacity: clamp01(f / 6) }}>
        <span style={{ background: C.ivory, color: C.ink, fontWeight: 800, fontSize: 22, padding: '6px 12px' }}>{beat.chapter > 0 ? `STEP ${beat.chapter}` : 'NEWS'}</span>
        <span style={{ color: C.ivory, fontWeight: 600, fontSize: 24 }}>{beat.card.eyebrow}</span>
        {logos.map((l) => <Logo key={l.domain} src={l.url} style={{ width: 38, height: 38, objectFit: 'contain', background: '#fff', borderRadius: 6, padding: 3 }} />)}
      </div>
    </div>
  );
};

const Picture: React.FC<SceneProps & { bandBottom: number }> = ({ frame, beat, bandBottom, spec, bare }) => {
  const f = frame - beat.start;
  const c = contentOf(beat);
  const top = spec.platform === 'youtube' ? 360 : 290;
  const h = bandBottom - top - 60;
  const { terms } = extrasOf(beat, spec);
  const title = !bare && (
    <div style={{ position: 'absolute', left: 120, right: 70, top, fontFamily: SANS }}>
      <div style={{ fontWeight: 900, fontSize: plain(beat.card.headline).length > 30 ? 62 : 74, lineHeight: 1.08, color: C.ivory, letterSpacing: -1 }}>
        {parts(beat.card.headline).map((p, i) => (p.hi ? <span key={i} style={{ color: C.honey }}>{p.text}</span> : <span key={i}>{p.text}</span>))}
      </div>
      {terms.map((t) => (
        <div key={t.short} style={{ marginTop: 10, fontSize: 28, color: C.grey, fontWeight: 600 }}>
          <span style={{ color: C.ivory }}>{t.short}</span> · {t.full}
        </div>
      ))}
    </div>
  );
  const areaTop = top + 260;
  let body: React.ReactNode = null;
  if (c.lead === 'stats') {
    body = c.stats.map((s, i) => {
      const t = clamp01((f - 8 - i * 10) / 22);
      const arrived = t >= 1;
      const color = s.tone === 'red' ? C.red : arrived ? (i === 0 ? C.honey : C.ivory) : C.ivory;
      return (
        <div key={i} style={{ position: 'absolute', left: 120, right: 70, top: areaTop + i * Math.min(260, h / c.stats.length - 20), opacity: clamp01((f - 6 - i * 10) / 4) }}>
          <div style={{ fontFamily: SANS, fontSize: 28, fontWeight: 700, color: C.grey, letterSpacing: 3, textTransform: 'uppercase' }}>{s.label}</div>
          <div style={{ fontFamily: TIGHT, fontWeight: 800, fontSize: fitSize(s.value, c.stats.length === 1 ? 220 : 150, 880), whiteSpace: 'nowrap', color, lineHeight: 1, fontVariantNumeric: 'tabular-nums', letterSpacing: -4 }}>{countText(s.value, t)}</div>
        </div>
      );
    });
  } else if (c.lead === 'chips' && c.chips.some((x) => x.strike)) {
    const bad = c.chips.filter((x) => x.strike);
    const good = c.chips.filter((x) => !x.strike);
    const open = clamp01((f - 6) / 8);
    body = (
      <div style={{ position: 'absolute', left: 100, right: 60, top: areaTop, height: Math.min(560, h - 240), display: 'flex', gap: 0 }}>
        {[bad, good].map((list, side) => (
          <div key={side} style={{ flex: 1, background: side ? 'rgba(255,194,26,0.08)' : 'rgba(255,74,61,0.12)', padding: 26, opacity: open, transform: `translateY(${(1 - open) * 40}px)` }}>
            <div style={{ display: 'inline-block', background: side ? C.honey : C.red, color: C.ink, fontFamily: SANS, fontWeight: 900, fontSize: 26, padding: '6px 14px' }}>{side ? 'AB' : 'PEHLE'}</div>
            {list.map((x, i) => (
              <div key={i} style={{ fontFamily: SANS, fontWeight: 800, fontSize: 40, color: side ? C.ivory : C.grey, marginTop: 22, textDecoration: side ? undefined : 'line-through', textDecorationColor: C.red, opacity: clamp01((f - 12 - i * 8 - side * 12) / 5) }}>{x.text}</div>
            ))}
          </div>
        ))}
        <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 4, background: C.honey, transform: `scaleY(${clamp01((f - 2) / 6)})`, transformOrigin: 'top' }} />
      </div>
    );
  } else if (c.lead === 'flow' || c.lead === 'chips') {
    const items = c.lead === 'flow' ? c.flow : c.chips.map((x) => x.text);
    const ph = Math.min(150, (h - 280) / items.length - 18);
    // Each panel lights up in turn, as the narration gets to it.
    const lit = Math.min(items.length - 1, Math.floor(((f - 10) / Math.max(1, beat.frames - 30)) * items.length));
    body = items.map((it, i) => {
      const k = back(clamp01((f - 4 - i * 5) / 9));
      const on = i <= lit;
      return (
        <div key={i} style={{ position: 'absolute', left: 120, right: 70, top: areaTop + i * (ph + 18), height: ph, background: '#1F1F1B', border: `4px solid ${on ? C.honey : '#2E2E29'}`, display: 'flex', alignItems: 'center', gap: 26, padding: '0 26px', transform: `translateY(${(1 - k) * 80}px)`, opacity: clamp01(k) }}>
          <div style={{ fontFamily: TIGHT, fontWeight: 800, fontSize: ph * 0.5, color: on ? C.honey : C.dim, width: ph * 0.5 }}>{i + 1}</div>
          <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: Math.min(46, ph * 0.38), color: on ? C.ivory : C.grey }}>{it}</div>
        </div>
      );
    });
  } else if (c.lead === 'note') {
    const sweep = clamp01((f - 18) / 16);
    body = (
      <div style={{ position: 'absolute', left: 140, right: 110, top: areaTop + 20, background: '#FBFAF5', padding: '40px 44px', transform: `rotate(-1.5deg) scale(${1 + f * 0.0005})`, boxShadow: '0 30px 60px rgba(0,0,0,0.6)' }}>
        <div style={{ height: 14, width: '60%', background: '#DDD9CE', marginBottom: 18 }} />
        <div style={{ height: 14, width: '85%', background: '#DDD9CE', marginBottom: 26 }} />
        <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: 44, color: C.ink, lineHeight: 1.3, background: `linear-gradient(90deg, ${C.honey}cc ${sweep * 100}%, transparent ${sweep * 100}%)`, mixBlendMode: 'multiply' }}>{c.notes[0]}</span>
        <div style={{ height: 14, width: '70%', background: '#DDD9CE', marginTop: 26 }} />
      </div>
    );
  } else {
    // The hook: the biggest word lands on frame 4 and holds.
    const k = back(clamp01((f - 3) / 5));
    body = (
      <div style={{ position: 'absolute', left: 120, right: 70, top: areaTop + 40, fontFamily: DISPLAY, fontSize: c.question ? 360 : 200, color: C.honey, lineHeight: 1, transform: `scale(${1.3 - 0.3 * k})`, transformOrigin: 'left top', opacity: clamp01(k * 2) }}>{c.question ? '?' : '!'}</div>
    );
  }
  return (
    <>
      {title}
      {!beat.visual && body}
    </>
  );
};

const bandBottomOf = (z: SceneProps['zones']) => z.bottom - 110;

/** Newsroom's look for Claude's scene pieces: dark ledger panels, a honey border on the one that matters, slammed in. */
const SKIN: Skin = {
  font: SANS,
  mono: '"JetBrains Mono", Consolas, monospace',
  ink: C.ivory,
  sub: C.grey,
  accent: C.honey,
  hiInk: C.ink,
  hiBg: C.honey,
  tone: (t) => (t ? TONE[t] : C.ivory),
  panel: ({ focus, round }) => ({ style: { background: '#1F1F1B', border: `4px solid ${focus ? C.honey : '#2E2E29'}`, borderRadius: round ?? 4 } }),
  enter: (k) => {
    const e = back(k);
    return { opacity: clamp01(k * 3), transform: `scale(${1.25 - 0.25 * e})` };
  },
  Link: ({ a, b, k, label }) => {
    const e = { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
    const ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
    return (
      <g>
        <line x1={a.x} y1={a.y} x2={e.x} y2={e.y} stroke={C.honey} strokeWidth={8} />
        {k >= 1 && <polygon points="0,-18 30,0 0,18" fill={C.honey} transform={`translate(${b.x},${b.y}) rotate(${ang}) translate(-26,0)`} />}
        {label && k >= 1 && (
          <g transform={`translate(${(a.x + b.x) / 2},${(a.y + b.y) / 2})`}>
            <rect x={-label.length * 9 - 14} y={-22} width={label.length * 18 + 28} height={44} fill={C.honey} />
            <text textAnchor="middle" y={10} fontFamily={SANS} fontWeight={900} fontSize={26} fill={C.ink}>{label.toUpperCase()}</text>
          </g>
        )}
      </g>
    );
  },
};

const Stage: React.FC<SceneProps> = (props) => {
  const { frame, beat, timed, index, zones } = props;
  const f = frame - beat.start;
  const prev = timed[index - 1];
  // A two-frame white flash when the story turns to a new step.
  const flash = prev && prev.chapter !== beat.chapter && f < 3 ? 0.85 * (1 - f / 3) : 0;
  const bandBottom = bandBottomOf(zones);
  return (
    <AbsoluteFill style={{ background: C.desk }}>
      <Ledger f={f} bottom={bandBottom} />
      {frame < props.storyFrames && (beat.visual ? <><Picture {...props} bandBottom={bandBottom} /><Composer visual={beat.visual} beat={beat} frame={frame} area={{ l: 110, r: 1020, t: (props.spec.platform === 'youtube' ? 360 : 290) + 250, b: bandBottom - 30 }} skin={SKIN} logoBase={props.spec.logoBase} /></> : <Picture {...props} bandBottom={bandBottom} />)}
      {!props.bare && <Bug {...props} />}
      <AbsoluteFill style={{ background: '#fff', opacity: flash }} />
    </AbsoluteFill>
  );
};

/** The caption is the shot: up to two lines, slammed in chunks, one keyword on a yellow block. */
const Captions: React.FC<SceneProps> = ({ beat, frame, zones, captions }) => {
  const ch = chunkAt(beat, frame, 5);
  if (!ch) return null;
  const s = captionScale(captions);
  const top = captions.position === 'middle' ? zones.caption : bandBottomOf(zones) + 30;
  let keyUsed = false;
  return (
    <div style={{ position: 'absolute', left: 60, right: 50, top, fontFamily: SANS }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: 20, rowGap: 6 }}>
        {ch.words.map((w, i) => {
          const at = w.start - ch.words[0]!.start;
          const k = back(clamp01((ch.since - at + 2) / 4));
          const key = !keyUsed && isKey(beat, w.text);
          if (key) keyUsed = true;
          const wipe = clamp01((ch.since - at) / 4);
          return (
            <span key={i} style={{ display: 'inline-block', fontWeight: 900, fontSize: 92 * s, lineHeight: 1.08, letterSpacing: -2, color: key ? C.ink : C.ivory, textShadow: key ? undefined : '0 6px 20px rgba(0,0,0,0.6)', transform: `scale(${1.15 - 0.15 * k})`, transformOrigin: 'left bottom', opacity: ch.since < at - 2 ? 0 : 1, padding: key ? '0 10px' : 0, background: key ? `linear-gradient(90deg, ${C.honey} ${wipe * 100}%, transparent ${wipe * 100}%)` : undefined }}>
              {cleanWord(w.text)}
            </span>
          );
        })}
      </div>
    </div>
  );
};

const EndCard: StyleKit['EndCard'] = ({ frame, brand, platform }) => {
  const cta = ctaFor(platform);
  const wipe = clamp01(frame / 10);
  return (
    <AbsoluteFill style={{ background: C.desk, fontFamily: SANS }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${wipe * 100}%`, background: C.honey }} />
      <div style={{ position: 'absolute', left: 90, right: 60, top: 760, opacity: fade(frame, 8, 14) }}>
        <div style={{ fontWeight: 800, fontSize: 44, color: C.ink, letterSpacing: 2 }}>{cta.small.toUpperCase()}</div>
        <div style={{ fontFamily: DISPLAY, fontSize: 180, color: C.ink, lineHeight: 1 }}>{cta.big.toUpperCase()}</div>
        <div style={{ display: 'inline-block', marginTop: 30, background: C.ink, color: C.honey, fontWeight: 900, fontSize: 44, padding: '12px 26px' }}>{brand.handle}</div>
      </div>
    </AbsoluteFill>
  );
};

export const newsroom: StyleKit = {
  Stage,
  Captions,
  EndCard,
  palette: { bg: C.ledger, ink: C.ivory, accent: C.honey, panel: '#1F1F1B', font: SANS, hiBg: C.honey, hiInk: C.ink },
};
export const NEWS_TONES = TONE;
