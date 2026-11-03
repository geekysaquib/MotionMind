import React from 'react';
import { spring, interpolate } from 'remotion';
import { C } from './World';
import type { Card as CardT, CardRow, Tone, TimedBeat } from './script';

const TONE: Record<Tone, string> = { red: C.red, teal: C.teal, purple: C.purple, blue: C.blue, amber: C.amber };
const SAFE_X = 60;

function Highlight({ text, tone }: { text: string; tone: string }) {
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

export const Header: React.FC<{ chapter: number; frame: number; fps: number; chapterStart: number }> = ({
  chapter,
  frame,
  fps,
  chapterStart,
}) => {
  const steps = ['Tower', 'Naksha', 'Timetable', 'Accuracy'];
  const grow = spring({ frame: frame - chapterStart, fps, config: { damping: 200 } });
  return (
    <div style={{ position: 'absolute', top: 70, left: SAFE_X, right: SAFE_X }}>
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
            RS
          </div>
          <div style={{ fontFamily: 'JetBrains Mono', fontWeight: 700, fontSize: 28, letterSpacing: 4, color: '#5B6170' }}>
            REEL STUDIO
          </div>
        </div>
        <div style={{ fontFamily: 'JetBrains Mono', fontSize: 26, color: '#7A8090' }}>@yourchannel</div>
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
                    border: `3px solid ${on ? C.teal : '#C5C9D2'}`,
                    transform: `scale(${current ? 1 + 0.25 * grow : 1})`,
                  }}
                />
                <div
                  style={{
                    fontFamily: 'JetBrains Mono',
                    fontWeight: 700,
                    fontSize: 22,
                    letterSpacing: 2,
                    color: on ? C.ink : '#A3A8B4',
                  }}
                >
                  {s.toUpperCase()}
                </div>
              </div>
              {i < steps.length - 1 && (
                <div style={{ flex: 1, height: 3, background: '#DCDFE5', position: 'relative' }}>
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

export const InfoCard: React.FC<{ card: CardT; frame: number; fps: number; start: number }> = ({ card, frame, fps, start }) => {
  const local = frame - start;
  const inS = spring({ frame: local, fps, config: { damping: 18, mass: 0.7 } });
  const tone = TONE[card.tone];
  return (
    <div
      style={{
        position: 'absolute',
        top: 232,
        left: SAFE_X,
        right: SAFE_X,
        background: 'rgba(255,255,255,0.96)',
        borderRadius: 34,
        border: `3px solid ${tone}55`,
        padding: '34px 40px 38px',
        boxShadow: '0 18px 50px rgba(31,36,48,0.10)',
        opacity: interpolate(inS, [0, 1], [0, 1]),
        transform: `translateY(${(1 - inS) * -30}px) scale(${0.96 + 0.04 * inS})`,
      }}
    >
      <div style={{ fontFamily: 'JetBrains Mono', fontWeight: 700, fontSize: 24, letterSpacing: 4, color: tone }}>
        {card.eyebrow.toUpperCase()}
      </div>
      <div
        style={{
          fontFamily: 'Space Grotesk',
          fontWeight: 700,
          fontSize: 60,
          lineHeight: 1.12,
          color: C.ink,
          marginTop: 12,
          letterSpacing: -1,
        }}
      >
        <Highlight text={card.headline} tone={tone} />
      </div>
      {card.rows?.map((r, i) => {
        const appear = spring({ frame: local - 14 - i * 10, fps, config: { damping: 200 } });
        return <Row key={i} row={r} tone={tone} appear={appear} />;
      })}
    </div>
  );
};

/** Phrase-level karaoke captions: spoken words white, upcoming grey, keywords teal. */
export const Captions: React.FC<{ beat: TimedBeat; frame: number }> = ({ beat, frame }) => {
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
  const active = groups.find((g) => frame < g[g.length - 1].end + 4) ?? groups[groups.length - 1];
  if (frame < beat.words[0].start - 2) return null;
  const pop = interpolate(frame - active[0].start, [0, 5], [0.92, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: 1545, display: 'flex', justifyContent: 'center' }}>
      <div
        style={{
          background: 'rgba(31,36,48,0.92)',
          padding: '16px 30px',
          borderRadius: 22,
          fontFamily: 'Space Grotesk',
          fontWeight: 700,
          fontSize: 62,
          letterSpacing: -0.5,
          transform: `scale(${pop})`,
          maxWidth: 900,
          textAlign: 'center',
        }}
      >
        {active.map((w, i) => {
          const spoken = frame >= w.start;
          const bare = w.text.toLowerCase().replace(/[.,?!]/g, '');
          const key = beat.keywords.some((k) => k.replace(/[.,?!]/g, '') === bare);
          const color = !spoken ? 'rgba(255,255,255,0.38)' : key ? '#5EEAD4' : '#FFFFFF';
          return (
            <span key={i} style={{ color }}>
              {w.text}
              {i < active.length - 1 ? ' ' : ''}
            </span>
          );
        })}
      </div>
    </div>
  );
};

export const EndCard: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
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
        RS
      </div>
      <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 84, color: C.ink, marginTop: 40, opacity: s }}>
        Reel Studio
      </div>
      <div style={{ fontFamily: 'Space Grotesk', fontWeight: 500, fontSize: 38, color: '#6B7180', marginTop: 6, opacity: s }}>
        Roz ki tech, <span style={{ color: C.teal }}>andar ki baat</span>
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
        follow @yourchannel
      </div>
    </div>
  );
};
