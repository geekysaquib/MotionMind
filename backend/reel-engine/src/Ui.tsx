import React from 'react';
import { spring, interpolate } from 'remotion';
import { C } from './World';
import type { Brand, CaptionStyle, ReelLook, Card as CardT, CardRow, Tone, TimedBeat } from './script';

const TONE: Record<Tone, string> = { red: C.red, teal: C.teal, purple: C.purple, blue: C.blue, amber: C.amber };
const SAFE_X = 60;

export type PlatformId = 'instagram' | 'youtube';
/** Each app covers a different part of the frame with its own buttons and caption, so text sits in a different place. */
export const PLATFORM_LAYOUT: Record<PlatformId, { headerTop: number; cardTop: number; captionBottom: number; captionMiddle: number; captionWidth: number; cta: string }> = {
  instagram: { headerTop: 70, cardTop: 232, captionBottom: 1545, captionMiddle: 1210, captionWidth: 900, cta: 'follow' },
  youtube: { headerTop: 130, cardTop: 292, captionBottom: 1470, captionMiddle: 1190, captionWidth: 800, cta: 'subscribe' },
};

export function Highlight({ text, tone }: { text: string; tone: string }) {
  const parts = text.split(/(\*[^*]+\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('*') ? (
          <span key={i} style={{ color: tone }}>
            {p.slice(1, -1)}
          </span>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

export const Header: React.FC<{ chapter: number; frame: number; fps: number; chapterStart: number; steps: string[]; brand: Brand; dark?: boolean; platform?: PlatformId; look?: ReelLook }> = ({
  look,
  dark = false,
  platform = 'instagram',
  chapter,
  frame,
  fps,
  chapterStart,
  steps,
  brand,
}) => {
  const grow = spring({ frame: frame - chapterStart, fps, config: { damping: 200 } });
  if (look?.header === 'bar') {
    const light = look.ink !== 'dark';
    const accent = look.accent ?? C.teal;
    return (
      <div style={{ position: 'absolute', top: PLATFORM_LAYOUT[platform].headerTop, left: SAFE_X, right: SAFE_X }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: 'JetBrains Mono', fontWeight: 700, fontSize: 24, letterSpacing: 4, color: light ? '#C9D0E4' : '#4B5262' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 14, height: 14, background: accent, display: 'inline-block' }} />
            {brand.name.toUpperCase()}
          </span>
          <span style={{ opacity: 0.85 }}>{(look.tag ?? brand.handle).toUpperCase()}</span>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
          {steps.map((s, i) => {
            const n = i + 1;
            const fill = chapter > n ? 1 : chapter === n ? grow : 0;
            return (
              <div key={s} style={{ flex: 1, height: 6, borderRadius: 3, background: light ? 'rgba(255,255,255,0.18)' : 'rgba(31,36,48,0.14)', overflow: 'hidden' }}>
                <div style={{ width: `${fill * 100}%`, height: '100%', background: accent }} />
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  return (
    <div style={{ position: 'absolute', top: PLATFORM_LAYOUT[platform].headerTop, left: SAFE_X, right: SAFE_X }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 58,
              height: 58,
              borderRadius: 999,
              background: C.ink,
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'Space Grotesk',
              fontWeight: 700,
              fontSize: 24,
              border: `3px solid ${C.teal}`,
            }}
          >
            {brand.initials}
          </div>
          <div style={{ fontFamily: 'JetBrains Mono', fontWeight: 700, fontSize: 28, letterSpacing: 4, color: dark ? '#D6DBE8' : '#5B6170' }}>
            {brand.name.toUpperCase()}
          </div>
        </div>
        <div style={{ fontFamily: 'JetBrains Mono', fontSize: 26, color: dark ? '#A9B1C6' : '#7A8090' }}>{brand.handle}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', marginTop: 30, gap: 14 }}>
        {steps.map((s, i) => {
          const n = i + 1;
          const done = chapter > n;
          const current = chapter === n;
          const on = done || current;
          const lineFill = done ? 1 : current ? grow : 0;
          return (
            <React.Fragment key={s}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 99,
                    background: on ? C.teal : 'transparent',
                    border: `3px solid ${on ? C.teal : dark ? '#5A6483' : '#C5C9D2'}`,
                    transform: `scale(${current ? 1 + 0.25 * grow : 1})`,
                  }}
                />
                <div
                  style={{
                    fontFamily: 'JetBrains Mono',
                    fontWeight: 700,
                    fontSize: 22,
                    letterSpacing: 2,
                    color: on ? (dark ? '#FFFFFF' : C.ink) : dark ? '#7F89A8' : '#A3A8B4',
                  }}
                >
                  {s.toUpperCase()}
                </div>
              </div>
              {i < steps.length - 1 && (
                <div style={{ flex: 1, height: 3, background: dark ? '#3A4466' : '#DCDFE5', position: 'relative' }}>
                  <div style={{ position: 'absolute', inset: 0, width: `${lineFill * 100}%`, background: C.teal }} />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

function Row({ row, tone, appear }: { row: CardRow; tone: string; appear: number }) {
  const style: React.CSSProperties = {
    opacity: appear,
    transform: `translateY(${(1 - appear) * 18}px)`,
    marginTop: 22,
  };
  const mono: React.CSSProperties = { fontFamily: 'JetBrains Mono', fontWeight: 700 };
  switch (row.kind) {
    case 'chips':
      return (
        <div style={{ ...style, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {row.items.map((c) => {
            const t = TONE[c.tone ?? 'teal'];
            return (
              <div
                key={c.text}
                style={{
                  ...mono,
                  fontSize: 26,
                  padding: '10px 20px',
                  borderRadius: 14,
                  border: `3px solid ${t}`,
                  color: t,
                  background: '#fff',
                  textDecoration: c.strike ? 'line-through' : 'none',
                  textDecorationThickness: 3,
                }}
              >
                {c.text}
              </div>
            );
          })}
        </div>
      );
    case 'flow':
      return (
        <div style={{ ...style, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {row.items.map((it, i) => (
            <React.Fragment key={it}>
              <div style={{ ...mono, fontSize: 25, padding: '10px 16px', borderRadius: 12, background: '#F1F3F6', color: C.ink }}>
                {it}
              </div>
              {i < row.items.length - 1 && <div style={{ ...mono, fontSize: 30, color: tone }}>→</div>}
            </React.Fragment>
          ))}
        </div>
      );
    case 'kv':
      return (
        <div style={{ ...style, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ ...mono, fontSize: 26, color: '#6B7180' }}>{row.k}</div>
          <div
            style={{
              ...mono,
              fontSize: 30,
              color: '#fff',
              background: TONE[row.tone ?? 'teal'],
              padding: '8px 18px',
              borderRadius: 12,
            }}
          >
            {row.v}
          </div>
        </div>
      );
    case 'file':
      return (
        <div style={{ ...style, display: 'flex', alignItems: 'center', gap: 22 }}>
          <div
            style={{
              width: 92,
              height: 112,
              borderRadius: 14,
              background: '#F3EEFF',
              border: `3px solid ${tone}`,
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              paddingBottom: 12,
              ...mono,
              fontSize: 20,
              color: tone,
            }}
          >
            .db
          </div>
          <div>
            <div style={{ ...mono, fontSize: 26, color: C.ink }}>{row.name}</div>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 64, color: tone, lineHeight: 1.05 }}>{row.size}</div>
            <div style={{ ...mono, fontSize: 22, color: '#8A8F9C' }}>{row.note}</div>
          </div>
        </div>
      );
    case 'timetable':
      return (
        <div style={{ ...style }}>
          {row.rows.map((r) => {
            const here = r.state === 'here';
            return (
              <div
                key={r.stop}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 18px',
                  marginTop: 8,
                  borderRadius: 12,
                  background: here ? '#E8F0FF' : 'transparent',
                  border: here ? `3px solid ${C.blue}` : '3px solid transparent',
                }}
              >
                <div style={{ ...mono, fontSize: 26, color: r.state === 'done' ? '#A0A5B1' : C.ink }}>
                  {r.state === 'done' ? '✓ ' : here ? '● ' : '○ '}
                  {r.stop}
                </div>
                <div style={{ ...mono, fontSize: 26, color: here ? C.blue : '#6B7180' }}>{r.time}</div>
              </div>
            );
          })}
        </div>
      );
    case 'note':
      return <div style={{ ...style, ...mono, fontWeight: 500, fontSize: 23, color: '#8A8F9C' }}>{row.text}</div>;
  }
}

/** `compact` hides the rows: the 'cards' world draws them large in the middle of the frame instead. */
/**
 * How tall the info card will be, estimated from its words (the browser decides the real height, so this is a careful
 * guess that errs a little tall). `end` is the y where it stops. When the card would crowd the scene under it, `showRows`
 * says to leave out its chips and flows (the scene shows that information itself), so the card never covers an object.
 */
export function cardLayout(card: CardT, terms: { short: string; full: string }[], logos: { name: string }[], look: ReelLook | undefined, platform: PlatformId = 'instagram', maxEnd = 840): { height: number; end: number; showRows: boolean } {
  const kind = look?.card ?? 'box';
  const headline = kind === 'headline';
  const fs = headline ? 84 : 60;
  const inner = 960 - (headline ? 40 : 86);
  const perLine = Math.max(8, Math.floor(inner / (fs * 0.55)));
  const plain = card.headline.replace(/\*/g, '');
  let lines = 1;
  let cur = 0;
  for (const w of plain.split(/\s+/).filter(Boolean)) {
    if (cur && cur + 1 + w.length > perLine) {
      lines++;
      cur = w.length;
    } else cur += (cur ? 1 : 0) + w.length;
  }
  const padding = headline ? 20 : 72;
  const base = padding + 40 + lines * fs * 1.12 + 12;
  const footer = (terms.length || logos.length ? 42 : 0) + terms.reduce((n, t) => n + 10 + Math.ceil((t.short.length + 3 + t.full.length) / 52) * 37, 0) + (logos.length ? 66 : 0);
  const rowsH = headline ? 0 : (card.rows ?? []).reduce((n, r) => {
    const row = r as unknown as Record<string, unknown>;
    switch (row.kind) {
      case 'chips':
        return n + 22 + 60 * Math.ceil(((row.items as unknown[]) ?? []).length / 3);
      case 'flow':
        return n + 22 + 70 * Math.ceil(((row.items as unknown[]) ?? []).length / 3);
      case 'kv':
        return n + 22 + 56;
      default:
        return n + 22 + 38 * Math.ceil(String(row.text ?? '').length / 52);
    }
  }, 0);
  const top = PLATFORM_LAYOUT[platform].cardTop;
  const withRows = top + base + footer + rowsH;
  const showRows = rowsH === 0 || withRows <= maxEnd;
  const height = base + footer + (showRows ? rowsH : 0);
  return { height, end: top + height, showRows };
}

export const InfoCard: React.FC<{ card: CardT; frame: number; fps: number; start: number; compact?: boolean; platform?: PlatformId; terms?: { short: string; full: string }[]; logos?: { name: string; url: string }[]; look?: ReelLook }> = ({ card, frame, fps, start, compact, platform = 'instagram', terms = [], logos = [], look }) => {
  const local = frame - start;
  const inS = spring({ frame: local, fps, config: { damping: 18, mass: 0.7 } });
  const kind = look?.card ?? 'box';
  const tone = look?.accent ?? TONE[card.tone];
  const lightWorld = look?.ink === 'dark';
  // Text colour: dark card and headline text are light unless the world behind is light.
  const ink = kind === 'box' ? C.ink : kind === 'dark' ? '#F4F6FB' : lightWorld ? C.ink : '#FFFFFF';
  const headline = kind === 'headline';
  return (
    <div
      style={{
        position: 'absolute',
        top: PLATFORM_LAYOUT[platform].cardTop,
        left: SAFE_X,
        right: SAFE_X,
        background: headline ? 'transparent' : kind === 'dark' ? 'rgba(9,14,28,0.9)' : 'rgba(255,255,255,0.96)',
        borderRadius: kind === 'dark' ? 26 : 34,
        border: headline ? 'none' : `3px solid ${tone}${kind === 'dark' ? '' : '55'}`,
        padding: headline ? '10px 20px' : '34px 40px 38px',
        textAlign: headline ? 'center' : 'left',
        boxShadow: headline ? 'none' : kind === 'dark' ? `0 0 44px ${tone}44` : '0 18px 50px rgba(31,36,48,0.10)',
        opacity: interpolate(inS, [0, 1], [0, 1]),
        transform: `translateY(${(1 - inS) * -30}px) scale(${0.96 + 0.04 * inS})`,
      }}
    >
      <div style={{ fontFamily: 'JetBrains Mono', fontWeight: 700, fontSize: headline ? 22 : 24, letterSpacing: 4, color: tone }}>
        {headline ? `// ${card.eyebrow}` : card.eyebrow.toUpperCase()}
      </div>
      <div
        style={{
          fontFamily: 'Space Grotesk',
          fontWeight: 700,
          fontSize: headline ? 84 : 60,
          lineHeight: headline ? 1.05 : 1.12,
          color: ink,
          marginTop: headline ? 18 : 12,
          letterSpacing: -1,
          textShadow: headline && !lightWorld ? '0 4px 24px rgba(0,0,0,0.55)' : undefined,
        }}
      >
        <Highlight text={card.headline} tone={tone} />
      </div>
      {!compact && !headline && card.rows?.map((r, i) => {
        const appear = spring({ frame: local - 14 - i * 10, fps, config: { damping: 200 } });
        return <Row key={i} row={r} tone={tone} appear={appear} />;
      })}
      {(terms.length > 0 || logos.length > 0) && (
        <div style={{ marginTop: 22, paddingTop: 18, borderTop: `2px dashed ${tone}44`, display: 'flex', flexDirection: 'column', gap: 10, opacity: interpolate(frame - start, [8, 20], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) }}>
          {terms.map((t) => (
            <div key={t.short} style={{ fontFamily: 'Space Grotesk', fontSize: 30, lineHeight: 1.2, color: ink, textShadow: headline && !lightWorld ? '0 2px 14px rgba(0,0,0,0.6)' : undefined }}>
              <span style={{ fontFamily: 'JetBrains Mono', fontWeight: 700, color: tone, marginRight: 12 }}>{t.short}</span>
              <span style={{ opacity: 0.8 }}>= {t.full}</span>
            </div>
          ))}
          {logos.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center' }}>
              {logos.map((l) => (
                <div key={l.name} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: `2px solid ${tone}33`, borderRadius: 16, padding: '6px 16px 6px 8px', fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 28, color: C.ink }}>
                  <img src={l.url} width={40} height={40} style={{ borderRadius: 10, objectFit: 'contain' }} alt="" />
                  {l.name}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/** Phrase-level karaoke captions: spoken words white, upcoming grey, keywords teal. */
const CAPTION_SIZE: Record<CaptionStyle['size'], number> = { small: 50, medium: 62, large: 76 };

export const Captions: React.FC<{ beat: TimedBeat; frame: number; style?: CaptionStyle; platform?: PlatformId; look?: ReelLook; progress?: number }> = ({ beat, frame, style, platform = 'instagram', look, progress = 0 }) => {
  const lay = PLATFORM_LAYOUT[platform];
  const pill = look?.captions === 'pill';
  const lightWorld = look?.ink === 'dark';
  const size = pill ? Math.min(52, CAPTION_SIZE[style?.size ?? 'medium']) : CAPTION_SIZE[style?.size ?? 'medium'];
  const top = (style?.position ?? 'bottom') === 'middle' ? lay.captionMiddle : lay.captionBottom;
  const plain = style?.look === 'plain';
  const groups: (typeof beat.words)[] = [];
  let cur: typeof beat.words = [];
  for (const w of beat.words) {
    cur.push(w);
    const endsPhrase = /[.,?!]$/.test(w.text);
    if (cur.length >= 4 || (endsPhrase && cur.length >= 2)) {
      groups.push(cur);
      cur = [];
    }
  }
  if (cur.length) groups.push(cur);
  const active = groups.find((g) => frame < g[g.length - 1]!.end + 4) ?? groups[groups.length - 1];
  if (!active?.length || frame < beat.words[0]!.start - 2) return null;
  const pop = interpolate(frame - active[0]!.start, [0, 5], [0.92, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top, display: 'flex', justifyContent: 'center' }}>
      <div
        style={{
          background: pill ? (lightWorld ? 'rgba(255,255,255,0.94)' : 'rgba(8,12,26,0.8)') : plain ? 'transparent' : 'rgba(31,36,48,0.92)',
          border: pill ? `2px solid ${lightWorld ? 'rgba(31,36,48,0.12)' : 'rgba(255,255,255,0.22)'}` : undefined,
          padding: pill ? '12px 34px' : plain ? '8px 20px' : '16px 30px',
          borderRadius: pill ? 999 : 22,
          fontFamily: 'Space Grotesk',
          fontWeight: 700,
          fontSize: size,
          letterSpacing: -0.5,
          // Plain captions have no box, so a dark outline keeps them readable on any background.
          textShadow: plain ? '0 0 6px rgba(31,36,48,0.9), 0 3px 10px rgba(31,36,48,0.8), 2px 2px 0 rgba(31,36,48,0.9), -2px -2px 0 rgba(31,36,48,0.9)' : undefined,
          transform: `scale(${pop})`,
          maxWidth: lay.captionWidth,
          textAlign: 'center',
        }}
      >
        {active.map((w, i) => {
          const spoken = frame >= w.start;
          const bare = w.text.toLowerCase().replace(/[.,?!]/g, '');
          const key = beat.keywords.some((k) => k.replace(/[.,?!]/g, '') === bare);
          const color = pill && lightWorld ? (!spoken ? 'rgba(31,36,48,0.35)' : key ? (look?.accent ?? '#0D9488') : C.ink) : !spoken ? 'rgba(255,255,255,0.38)' : key ? (look?.accent ?? '#5EEAD4') : '#FFFFFF';
          return (
            <span key={i} style={{ color }}>
              {w.text}
              {i < active.length - 1 ? ' ' : ''}
            </span>
          );
        })}
      </div>
      {pill && (
        <div style={{ position: 'absolute', top: 'calc(100% + 18px)', left: '50%', transform: 'translateX(-50%)', width: 520, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ flex: 1, height: 4, borderRadius: 2, background: lightWorld ? 'rgba(31,36,48,0.14)' : 'rgba(255,255,255,0.2)', overflow: 'hidden' }}>
            <div style={{ width: `${Math.round(progress * 100)}%`, height: '100%', background: look?.accent ?? '#5EEAD4' }} />
          </div>
          <span style={{ fontFamily: 'JetBrains Mono', fontSize: 18, color: lightWorld ? '#6B7280' : '#8B93AB' }}>{Math.round(progress * 100)}%</span>
        </div>
      )}
    </div>
  );
};

export const EndCard: React.FC<{ frame: number; fps: number; brand: Brand; platform?: PlatformId }> = ({ frame, fps, brand, platform = 'instagram' }) => {
  const s = spring({ frame, fps, config: { damping: 14 } });
  const b = spring({ frame: frame - 18, fps, config: { damping: 12 } });
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: `rgba(246,242,233,${0.88 * Math.min(1, frame / 10)})`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: 220,
          height: 220,
          borderRadius: 999,
          background: C.ink,
          border: `8px solid ${C.teal}`,
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Space Grotesk',
          fontWeight: 700,
          fontSize: 92,
          transform: `scale(${s})`,
        }}
      >
        {brand.initials}
      </div>
      <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 84, color: C.ink, marginTop: 40, opacity: s }}>
        {brand.name}
      </div>
      <div style={{ fontFamily: 'Space Grotesk', fontWeight: 500, fontSize: 38, color: '#6B7180', marginTop: 6, opacity: s }}>
        {brand.tagline}
      </div>
      <div
        style={{
          marginTop: 44,
          fontFamily: 'JetBrains Mono',
          fontWeight: 700,
          fontSize: 40,
          color: C.teal,
          border: `4px solid ${C.teal}`,
          borderRadius: 999,
          padding: '18px 44px',
          transform: `scale(${b})`,
          background: '#fff',
        }}
      >
        {PLATFORM_LAYOUT[platform].cta} {brand.handle}
      </div>
    </div>
  );
};
