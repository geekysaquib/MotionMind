import React from 'react';
import { interpolate, spring } from 'remotion';
import { Art, DiagramWorld, GLYPH_FOR, Glyph, HAS_ART, PALETTES, TONES, type Pal, type Region } from './DiagramWorld';
import { chipRows, flowItems, kvRows, statsIn, type Stat } from './shotplan';
import { logoUrl } from './terms';
import type { DiagramStyle, ReelLook, ScenePropSpec, ShotKind, TimedBeat } from './script';

// The shots of the flat world. Each one stages a scene the way the reference reels do, and each moves:
// a question mark slams in, a number counts up, ticks draw themselves, digits roll and lock, a terminal types,
// a button is pressed, a ring fills. The look (colours, outlines, shadows) still comes from the template's style.

interface ShotProps {
  frame: number;
  fps: number;
  beat: TimedBeat;
  pal: Pal;
  style: DiagramStyle;
  region: Region;
  logoBase?: string;
}

const mono = 'JetBrains Mono';
const sans = 'Space Grotesk';
const starred = (h: string) => [...h.matchAll(/\*([^*]+)\*/g)].map((m) => m[1]!);
const plain = (h: string) => h.replace(/\*/g, '');
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const ease = (t: number) => 1 - Math.pow(1 - t, 3);
const fmt = (n: number, d: number) => n.toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d });

/** A card in the template's own style: outline, hard shadow or glow. */
function panel(pal: Pal, accent = false): React.CSSProperties {
  return {
    background: pal.card,
    border: `${pal.strokeW}px solid ${accent && pal.glow ? pal.accent : pal.stroke}`,
    borderRadius: pal.radius,
    boxShadow: pal.hardShadow ? `10px 10px 0 ${pal.hardShadow}` : pal.glow ? `0 0 30px ${pal.accent}44` : 'none',
    boxSizing: 'border-box',
  };
}

const Stage: React.FC<{ region: Region; children: React.ReactNode; style?: React.CSSProperties }> = ({ region, children, style }) => (
  <div style={{ position: 'absolute', left: region.l, top: region.t, width: region.r - region.l, height: region.b - region.t, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28, fontFamily: sans, ...style }}>{children}</div>
);

const propVisual = (p: ScenePropSpec | undefined, size: number, pal: Pal, frame: number, logoBase?: string) => {
  if (!p) return null;
  if (p.logo) return <img src={logoUrl(logoBase, p.logo, p.label)} width={size} height={size} style={{ objectFit: 'contain', borderRadius: size * 0.16 }} alt="" />;
  if (HAS_ART.has(p.kind)) return <Art spec={p} size={size} pal={pal} frame={frame} />;
  if (p.kind === 'custom' && !p.glyph && p.icon) return <span style={{ fontSize: size * 0.8 }}>{p.icon}</span>;
  return <Glyph name={p.glyph ?? GLYPH_FOR[p.kind] ?? 'box'} size={size} color={pal.accent} w={1.6} />;
};

// ---------------------------------------------------------------- hero

/** One giant thing: a question mark, a logo or an icon, slammed in with a shake, and the word it stands for. */
export const HeroShot: React.FC<ShotProps> = ({ frame, fps, beat, pal, style, region, logoBase }) => {
  const local = frame - beat.start;
  const head = plain(beat.card.headline);
  const word = starred(beat.card.headline)[0] ?? beat.scene?.props[0]?.label ?? beat.card.eyebrow;
  const question = /\?|\b(kya|kyun|kyon|kaise|kaun|kab|kahan|why|how|what|who)\b/i.test(head);
  const s = spring({ frame: local - 2, fps, config: { damping: 9, mass: 0.7 } });
  const shake = local < 12 ? Math.sin(local * 2.4) * (12 - local) * 0.7 : 0;
  const prop = beat.scene?.props[0];
  const size = 430;
  return (
    <Stage region={region}>
      <div style={{ position: 'relative', width: size + 120, height: size + 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {[0, 1, 2].map((k) => {
          const t = ((local / 60 + k / 3) % 1 + 1) % 1;
          return <div key={k} style={{ position: 'absolute', width: size * (0.7 + t * 0.7), height: size * (0.7 + t * 0.7), borderRadius: 999, border: `4px solid ${pal.accent}`, opacity: (1 - t) * 0.45 }} />;
        })}
        <div style={{ transform: `scale(${1.7 - 0.7 * s}) rotate(${style === 'sticker' ? -6 + shake : shake}deg)`, opacity: interpolate(s, [0, 0.4], [0, 1], clamp), ...(question ? {} : { ...panel(pal, true), padding: 46 }) }}>
          {question ? (
            <span style={{ fontSize: 520, fontWeight: 800, lineHeight: 0.9, color: pal.accent, textShadow: pal.hardShadow ? `12px 12px 0 ${pal.hardShadow}` : pal.glow ? `0 0 50px ${pal.accent}88` : undefined, display: 'block' }}>?</span>
          ) : (
            propVisual(prop, 300, pal, frame, logoBase) ?? <Glyph name="sparkles" size={300} color={pal.accent} />
          )}
        </div>
      </div>
      <div style={{ fontSize: Math.min(130, 1500 / Math.max(6, word.length)), fontWeight: 800, color: pal.ink, textAlign: 'center', letterSpacing: -2, lineHeight: 1, transform: `translateY(${(1 - ease(Math.min(1, Math.max(0, (local - 8) / 14)))) * 40}px)`, opacity: interpolate(local, [8, 20], [0, 1], clamp) }}>{word}</div>
    </Stage>
  );
};

// ---------------------------------------------------------------- stat

/** A big number that counts up, with what it is. */
export const StatShot: React.FC<ShotProps> = ({ frame, beat, pal, region }) => {
  const local = frame - beat.start;
  const kvs = kvRows(beat);
  const fromKv = kvs.flatMap((r) => statsIn(r.v).map((st) => ({ st, label: r.k })));
  const fromText = statsIn(`${plain(beat.card.headline)} ${beat.narration}`).map((st) => ({ st, label: plain(beat.card.headline) }));
  const all = [...fromKv, ...fromText];
  const main = all[0] ?? { st: { text: '', value: 0, prefix: '', suffix: '', decimals: 0 } as Stat, label: plain(beat.card.headline) };
  const second = all[1];
  const c = ease(interpolate(local, [4, 40], [0, 1], clamp));
  // A long number written without commas is a code (an OTP, an id): its digits appear one by one instead of counting up.
  const code = /^\d{4,}$/.test(main.st.text);
  const shown = code ? main.st.text.slice(0, Math.ceil(c * main.st.text.length)) : `${main.st.prefix}${fmt(main.st.value * c, main.st.decimals)}`;
  const unit = main.st.suffix.trim();
  const fontSize = shown.length > 8 ? 150 : shown.length > 5 ? 200 : 260;
  const pop = spring({ frame: local - 40, fps: 30, config: { damping: 8 } });
  return (
    <Stage region={region}>
      <div style={{ ...panel(pal, true), padding: '50px 60px', textAlign: 'center', width: '100%' }}>
        <div style={{ fontFamily: mono, fontWeight: 700, fontSize: 26, letterSpacing: 5, color: pal.sub, textTransform: 'uppercase', marginBottom: 6 }}>{main.label.slice(0, 40)}</div>
        <div style={{ fontWeight: 800, fontSize, lineHeight: 1.05, color: pal.accent, letterSpacing: -4, textShadow: pal.glow ? `0 0 40px ${pal.accent}66` : undefined, transform: `scale(${1 + 0.06 * Math.max(0, pop) * (local > 40 ? 1 : 0)})` }}>
          {shown}
          {unit && <span style={{ fontSize: fontSize * 0.34, color: pal.ink, marginLeft: 14, letterSpacing: 0 }}>{unit}</span>}
        </div>
        <div style={{ height: 8, borderRadius: 4, background: `${pal.accent}33`, marginTop: 22, overflow: 'hidden' }}>
          <div style={{ width: `${c * 100}%`, height: '100%', background: pal.accent }} />
        </div>
      </div>
      {second && (
        <div style={{ opacity: interpolate(local, [30, 46], [0, 0.85], clamp), fontSize: 64, fontWeight: 700, color: pal.ink }}>
          <span style={{ fontFamily: mono, fontSize: 26, letterSpacing: 4, color: pal.sub, marginRight: 18 }}>{second.label.slice(0, 22).toUpperCase()}</span>
          {second.st.text}
        </div>
      )}
    </Stage>
  );
};

// ---------------------------------------------------------------- compare

/** Two things, one above the other: the old one fades and is struck through, the new one slams in with a tick. */
export const CompareShot: React.FC<ShotProps> = ({ frame, fps, beat, pal, region }) => {
  const local = frame - beat.start;
  const kvs = kvRows(beat);
  const props = beat.scene?.props ?? [];
  const a = kvs[0] ? { label: kvs[0].k, value: kvs[0].v } : { label: props[0]?.label ?? 'Before', value: props[0]?.label ?? '' };
  const b = kvs[1] ? { label: kvs[1].k, value: kvs[1].v } : { label: props[1]?.label ?? 'After', value: props[1]?.label ?? '' };
  const sa = spring({ frame: local - 2, fps, config: { damping: 16 } });
  const sb = spring({ frame: local - 18, fps, config: { damping: 9, mass: 0.7 } });
  const tick = interpolate(local, [30, 44], [0, 1], clamp);
  const Row = ({ item, accent, s, dir }: { item: { label: string; value: string }; accent?: boolean; s: number; dir: number }) => (
    <div style={{ ...panel(pal, accent), width: '100%', padding: '34px 44px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, opacity: accent ? 1 : 0.7, transform: `translateX(${(1 - s) * 260 * dir}px) scale(${accent ? 0.9 + 0.1 * s : 1})` }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: mono, fontWeight: 700, fontSize: 26, letterSpacing: 4, color: pal.sub }}>{item.label.toUpperCase().slice(0, 28)}</div>
        <div style={{ fontWeight: 800, fontSize: 84, lineHeight: 1.05, color: accent ? pal.accent : pal.ink, textDecoration: accent ? 'none' : `line-through ${pal.hot} 6px`, overflowWrap: 'anywhere' }}>{item.value}</div>
      </div>
      <svg width="96" height="96" viewBox="0 0 24 24" fill="none" stroke={accent ? pal.accent : pal.hot} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        {accent ? <path d="M4 12l5 5L20 6" strokeDasharray="30" strokeDashoffset={30 * (1 - tick)} /> : <path d="M6 6l12 12M18 6L6 18" opacity={0.9} />}
      </svg>
    </div>
  );
  return (
    <Stage region={region} style={{ gap: 18 }}>
      <Row item={a} s={sa} dir={-1} />
      <div style={{ fontFamily: mono, fontWeight: 800, fontSize: 40, color: pal.sub, letterSpacing: 6, transform: `scale(${interpolate(local, [10, 20], [0, 1], clamp)})` }}>{beat.narration.match(/\b(ab|now|naya|new)\b/i) ? '↓' : 'VS'}</div>
      <Row item={b} accent s={sb} dir={1} />
    </Stage>
  );
};

// ---------------------------------------------------------------- checklist

/** A list whose ticks draw themselves one after another; struck-out items get a cross. */
export const ChecklistShot: React.FC<ShotProps> = ({ frame, fps, beat, pal, region }) => {
  const local = frame - beat.start;
  const chips = chipRows(beat);
  const items = chips.length >= 2 ? chips : (flowItems(beat).length ? flowItems(beat).map((text) => ({ text, strike: false })) : (beat.scene?.props ?? []).map((p) => ({ text: p.label ?? p.kind, strike: false })));
  const rows = items.slice(0, 4);
  return (
    <Stage region={region} style={{ gap: 22 }}>
      {rows.map((it, i) => {
        const s = spring({ frame: local - 6 - i * 14, fps, config: { damping: 14 } });
        const d = interpolate(local, [14 + i * 14, 28 + i * 14], [0, 1], clamp);
        const bad = Boolean(it.strike);
        return (
          <div key={i} style={{ ...panel(pal, !bad), width: '100%', padding: '26px 36px', display: 'flex', alignItems: 'center', gap: 28, opacity: interpolate(s, [0, 1], [0, 1]), transform: `translateX(${(1 - s) * -120}px)` }}>
            <svg width="84" height="84" viewBox="0 0 24 24" fill="none" stroke={bad ? pal.hot : pal.accent} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10" opacity={0.35} />
              {bad ? <path d="M8 8l8 8M16 8l-8 8" strokeDasharray="24" strokeDashoffset={24 * (1 - d)} /> : <path d="M7 12.5l3.2 3.2L17 9" strokeDasharray="20" strokeDashoffset={20 * (1 - d)} />}
            </svg>
            <div style={{ fontSize: 56, fontWeight: 700, color: bad ? pal.sub : pal.ink, textDecoration: bad ? 'line-through' : 'none', lineHeight: 1.1, overflowWrap: 'anywhere' }}>{it.text}</div>
          </div>
        );
      })}
    </Stage>
  );
};

// ---------------------------------------------------------------- ui

const typed = (text: string, local: number, start: number, cps = 1.4) => text.slice(0, Math.max(0, Math.floor((local - start) * cps)));
const firstSentence = (s: string, n: number) => (s.split(/[.?!।]/)[0] ?? s).trim().slice(0, n);

/** A screen being used: a terminal typing a command, a chat getting a reply, or a phone whose button is pressed. */
export const UiShot: React.FC<ShotProps> = ({ frame, fps, beat, pal, style, region, logoBase }) => {
  const local = frame - beat.start;
  const props = beat.scene?.props ?? [];
  const text = `${beat.card.headline} ${beat.narration}`;
  const term = props.some((p) => ['terminal', 'laptop', 'server', 'database', 'cache'].includes(p.kind)) || /\b(command|code|run|api|query|deploy)\b/i.test(text);
  const chat = /\b(chat|comment|message|reply|dm|whatsapp|bot)\b/i.test(text) || props.some((p) => ['chat', 'envelope', 'bell'].includes(p.kind));
  const word = starred(beat.card.headline)[0] ?? props[0]?.label ?? 'go';
  const kv = kvRows(beat)[0];

  if (term && !chat) {
    const lines = [`$ ${word.toLowerCase().replace(/\s+/g, '-')} --run`, kv ? `> ${kv.k}: ${kv.v}` : `> ${firstSentence(beat.narration, 38)}`, '✓ done'];
    let used = 0;
    return (
      <Stage region={region}>
        <div style={{ ...panel(pal, true), width: '100%', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '22px 28px', borderBottom: `3px solid ${pal.stroke}` }}>
            {[pal.hot, '#F59E0B', pal.accent].map((c) => (
              <span key={c} style={{ width: 24, height: 24, borderRadius: 99, background: c }} />
            ))}
            <span style={{ fontFamily: mono, fontSize: 24, color: pal.sub, marginLeft: 16 }}>{(props[0]?.label ?? 'terminal').toLowerCase()}</span>
          </div>
          <div style={{ padding: '36px 40px', minHeight: 420, fontFamily: mono, fontSize: 40, lineHeight: 1.6, color: pal.ink }}>
            {lines.map((ln, i) => {
              const start = 8 + used;
              used += Math.ceil(ln.length / 1.5) + 6;
              const t = typed(ln, local, start, 1.5);
              if (!t) return null;
              return (
                <div key={i} style={{ color: i === 2 ? pal.accent : i === 1 ? pal.sub : pal.ink, fontWeight: i === 2 ? 700 : 400 }}>
                  {t}
                  {t.length < ln.length && Math.floor(local / 8) % 2 === 0 && <span style={{ background: pal.accent, color: 'transparent' }}>_</span>}
                </div>
              );
            })}
          </div>
        </div>
      </Stage>
    );
  }

  if (chat) {
    const them = firstSentence(beat.narration, 56) || 'Hi';
    const me = plain(beat.card.headline).slice(0, 44);
    const dots = local < 26;
    const s1 = spring({ frame: local - 4, fps, config: { damping: 14 } });
    const s2 = spring({ frame: local - 30, fps, config: { damping: 11, mass: 0.7 } });
    return (
      <Stage region={region} style={{ alignItems: 'stretch', gap: 26 }}>
        <div style={{ alignSelf: 'flex-start', maxWidth: '82%', ...panel(pal), borderRadius: pal.radius, padding: '26px 34px', fontSize: 50, lineHeight: 1.2, color: pal.ink, opacity: s1, transform: `translateY(${(1 - s1) * 30}px) rotate(${style === 'sticker' ? -1.5 : 0}deg)` }}>
          {dots ? '• • •' : them}
        </div>
        <div style={{ alignSelf: 'flex-end', maxWidth: '82%', background: pal.accent, color: style === 'paper' ? '#FFFFFF' : '#0B1020', border: pal.hardShadow ? `${pal.strokeW}px solid ${pal.stroke}` : 'none', boxShadow: pal.hardShadow ? `8px 8px 0 ${pal.hardShadow}` : 'none', borderRadius: pal.radius, padding: '26px 34px', fontSize: 54, fontWeight: 700, lineHeight: 1.2, opacity: s2, transform: `scale(${0.8 + 0.2 * s2}) translateY(${(1 - s2) * 40}px) rotate(${style === 'sticker' ? 1.5 : 0}deg)` }}>
          {me}
        </div>
      </Stage>
    );
  }

  // A phone: an app, a button, a press, a result.
  const press = interpolate(local, [38, 44, 52], [1, 0.92, 1], clamp);
  const ripple = interpolate(local, [40, 66], [0, 1], clamp);
  const done = local > 56;
  const w = 430;
  const h = Math.min(region.b - region.t - 10, 800);
  return (
    <Stage region={region}>
      <div style={{ ...panel(pal, true), width: w, height: h, borderRadius: 54, padding: 26, display: 'flex', flexDirection: 'column', gap: 20, position: 'relative', overflow: 'hidden' }}>
        <div style={{ height: 30, width: 140, borderRadius: 16, background: pal.stroke, opacity: 0.5, alignSelf: 'center' }} />
        <div style={{ background: pal.accent, borderRadius: 20, padding: '20px 22px', color: style === 'paper' ? '#FFFFFF' : '#0B1020', fontWeight: 800, fontSize: 38 }}>{(props[0]?.label ?? beat.card.eyebrow).slice(0, 18)}</div>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ height: 70, borderRadius: 16, border: `3px solid ${pal.stroke}`, opacity: interpolate(local, [4 + i * 5, 12 + i * 5], [0, 0.7], clamp), display: 'flex', alignItems: 'center', padding: '0 20px', gap: 14 }}>
            <span style={{ width: 34, height: 34, borderRadius: 99, background: `${pal.accent}55` }} />
            <span style={{ height: 14, width: `${70 - i * 14}%`, borderRadius: 7, background: pal.sub, opacity: 0.5 }} />
          </div>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ position: 'relative', alignSelf: 'stretch', textAlign: 'center', background: done ? pal.accent : pal.ink, color: done ? (style === 'paper' ? '#FFFFFF' : '#0B1020') : pal.card === '#FFFFFF' ? '#FFFFFF' : '#0B1020', borderRadius: 24, padding: '28px 10px', fontWeight: 800, fontSize: 44, transform: `scale(${press})`, overflow: 'hidden' }}>
          {done ? `✓ ${kv ? kv.v : 'Done'}`.slice(0, 22) : word.slice(0, 16)}
          {ripple > 0 && ripple < 1 && <span style={{ position: 'absolute', left: '50%', top: '50%', width: 520 * ripple, height: 520 * ripple, marginLeft: -260 * ripple, marginTop: -260 * ripple, borderRadius: 999, background: 'rgba(255,255,255,0.35)', opacity: 1 - ripple }} />}
        </div>
      </div>
      {propVisual(undefined, 0, pal, frame, logoBase)}
    </Stage>
  );
};

// ---------------------------------------------------------------- tiles

/** Digits that roll and lock one by one (a code), or the letters of a word picked out one at a time. */
export const TilesShot: React.FC<ShotProps> = ({ frame, fps, beat, pal, style, region }) => {
  const local = frame - beat.start;
  const stat = statsIn(`${plain(beat.card.headline)} ${beat.narration} ${kvRows(beat).map((r) => r.v).join(' ')}`).find((x) => x.value >= 1000 && !x.suffix.trim());
  const digits = stat ? String(Math.round(stat.value)).slice(0, 8).split('') : null;
  const letters = (starred(beat.card.headline)[0] ?? plain(beat.card.headline)).replace(/[^\p{L}\p{N}]/gu, '').toUpperCase().slice(0, 6).split('');
  const cells = digits ?? letters;
  const size = Math.min(150, (region.r - region.l - 60) / cells.length - 14);
  const active = Math.floor(local / 16) % cells.length;
  return (
    <Stage region={region}>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
        {cells.map((c, i) => {
          const lockAt = 14 + i * 7;
          const locked = local >= lockAt;
          const shown = digits ? (locked ? c : String((Math.floor(local * 1.3) + i * 7) % 10)) : c;
          const s = spring({ frame: local - (digits ? lockAt : 4 + i * 5), fps, config: { damping: 9, mass: 0.6 } });
          const hot = !digits && i === active && local > 20;
          return (
            <div key={i} style={{ ...panel(pal, hot), width: size, height: size * 1.25, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: mono, fontWeight: 800, fontSize: size * 0.82, color: hot || locked ? pal.accent : pal.sub, transform: `scale(${0.85 + 0.15 * s}) translateY(${(1 - s) * 30}px) rotate(${style === 'sticker' ? (i % 2 ? 2 : -2) : 0}deg)`, borderColor: hot ? pal.accent : undefined }}>
              {shown}
            </div>
          );
        })}
      </div>
      <div style={{ fontFamily: mono, fontWeight: 700, fontSize: 34, letterSpacing: 5, color: pal.sub, textTransform: 'uppercase', opacity: interpolate(local, [20, 34], [0, 1], clamp), textAlign: 'center' }}>{beat.card.eyebrow}</div>
    </Stage>
  );
};

// ---------------------------------------------------------------- ring

/** A ring that fills while its number counts: a percentage, or a time running down. */
export const RingShot: React.FC<ShotProps> = ({ frame, beat, pal, region }) => {
  const local = frame - beat.start;
  const st = statsIn(`${plain(beat.card.headline)} ${beat.narration} ${kvRows(beat).map((r) => r.v).join(' ')}`).find((x) => /%|s|sec|min|hour/i.test(x.suffix)) ?? statsIn(plain(beat.card.headline))[0];
  const pct = st && /%/.test(st.suffix);
  const target = pct ? Math.min(1, st!.value / 100) : 0.78;
  const c = ease(interpolate(local, [4, 50], [0, 1], clamp));
  const r = 200;
  const circ = 2 * Math.PI * r;
  const shown = st ? (pct ? fmt(st.value * c, st.decimals) : fmt(st.value * (1 - 0.0 * c), st.decimals)) : '';
  return (
    <Stage region={region}>
      <div style={{ position: 'relative', width: 520, height: 520 }}>
        <svg width="520" height="520" viewBox="0 0 520 520" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="260" cy="260" r={r} fill="none" stroke={pal.stroke} strokeWidth={pal.glow ? 6 : 24} opacity={0.35} />
          <circle cx="260" cy="260" r={r} fill="none" stroke={pal.accent} strokeWidth={pal.strokeW > 4 ? 30 : 24} strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - target * c)} />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: sans }}>
          <div style={{ fontWeight: 800, fontSize: 170, lineHeight: 1, color: pal.ink, letterSpacing: -4 }}>
            {shown}
            <span style={{ fontSize: 60, color: pal.accent, marginLeft: 6 }}>{st?.suffix.trim() ?? ''}</span>
          </div>
        </div>
      </div>
      <div style={{ fontFamily: mono, fontWeight: 700, fontSize: 34, letterSpacing: 5, color: pal.sub, textTransform: 'uppercase', textAlign: 'center' }}>{beat.card.eyebrow}</div>
    </Stage>
  );
};

// ---------------------------------------------------------------- the world

const SHOTS: Record<Exclude<ShotKind, 'nodes'>, React.FC<ShotProps>> = { hero: HeroShot, stat: StatShot, compare: CompareShot, checklist: ChecklistShot, ui: UiShot, tiles: TilesShot, ring: RingShot };

/** The flat world with a chosen shot: the template's palette and background, the scene staged the way `shot` says. */
export const FlatWorld: React.FC<{ frame: number; fps: number; beat: TimedBeat; look?: ReelLook; region: Region; shot: ShotKind; logoBase?: string }> = ({ frame, fps, beat, look, region, shot, logoBase }) => {
  if (shot === 'nodes') return <DiagramWorld frame={frame} fps={fps} beat={beat} look={look} region={region} logoBase={logoBase} />;
  const style: DiagramStyle = look?.diagram ?? 'neon';
  const accent = look?.accent ?? TONES[beat.card.tone];
  const pal = PALETTES[style](accent);
  const Shot = SHOTS[shot];
  return (
    <div style={{ position: 'absolute', inset: 0, background: pal.bg, overflow: 'hidden' }}>
      {pal.grid && (
        <svg width="1080" height="1920" style={{ position: 'absolute', inset: 0 }}>
          <defs>
            <pattern id="fw-grid" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M60 0H0V60" fill="none" stroke={pal.grid} strokeWidth="2" />
            </pattern>
          </defs>
          <rect width="1080" height="1920" fill="url(#fw-grid)" />
        </svg>
      )}
      <Shot frame={frame} fps={fps} beat={beat} pal={pal} style={style} region={region} logoBase={logoBase} />
    </div>
  );
};
