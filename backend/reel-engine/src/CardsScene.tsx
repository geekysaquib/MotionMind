import React from 'react';
import { interpolate, spring } from 'remotion';
import { C } from './World';
import type { CardRow, TimedBeat, Tone } from './script';

const TONE: Record<Tone, string> = { red: C.red, teal: C.teal, purple: C.purple, blue: C.blue, amber: C.amber };
// The free band between the info card (top) and the captions (bottom).
const TOP = 760;
const HEIGHT = 720;

/**
 * The big animated visual in the middle of a 'cards' world reel. It turns the beat's card rows into
 * graphics: a flow becomes a connected diagram with a moving signal, chips pop in as large tags,
 * a key/value becomes a big stat, and a beat without rows gets its key word in an orbit.
 */
export const CardsScene: React.FC<{ beat: TimedBeat; frame: number; fps: number }> = ({ beat, frame, fps }) => {
  const local = frame - beat.start;
  const tone = TONE[beat.card.tone] ?? C.teal;
  const row = pickRow(beat.card.rows);
  const enter = spring({ frame: local - 6, fps, config: { damping: 16, mass: 0.8 } });
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: TOP, height: HEIGHT, opacity: enter, transform: `translateY(${(1 - enter) * 40}px)` }}>
      {row?.kind === 'flow' ? (
        <Flow items={row.items} tone={tone} local={local} fps={fps} />
      ) : row?.kind === 'chips' ? (
        <Chips items={row.items} tone={tone} local={local} fps={fps} />
      ) : row?.kind === 'kv' ? (
        <Stat k={row.k} v={row.v} tone={row.tone ? TONE[row.tone] : tone} local={local} fps={fps} />
      ) : (
        <Orbit word={keyWord(beat)} tone={tone} local={local} fps={fps} />
      )}
    </div>
  );
};

/** The most visual row wins: flow, then chips, then a fact. */
function pickRow(rows: CardRow[] | undefined): CardRow | undefined {
  if (!rows?.length) return undefined;
  return rows.find((r) => r.kind === 'flow') ?? rows.find((r) => r.kind === 'chips') ?? rows.find((r) => r.kind === 'kv') ?? undefined;
}

function keyWord(beat: TimedBeat): string {
  const starred = beat.card.headline.match(/\*([^*]+)\*/)?.[1];
  return (starred ?? beat.keywords[0] ?? beat.card.eyebrow).replace(/[.,!?]+$/, '');
}

const Flow: React.FC<{ items: string[]; tone: string; local: number; fps: number }> = ({ items, tone, local, fps }) => {
  const nodes = items.slice(0, 4);
  const n = nodes.length;
  const w = 1080;
  // Keep node labels (240 px wide) inside the frame.
  const margin = 170;
  const gap = (w - 2 * margin) / Math.max(1, n - 1);
  const cy = HEIGHT / 2 - 20;
  const xs = nodes.map((_, i) => (n === 1 ? w / 2 : margin + i * gap));
  // A signal dot travels along the chain, looping once every 2.5 seconds.
  const period = 2.5 * fps;
  const t = ((local % period) + period) % period / period;
  const seg = Math.min(n - 2, Math.floor(t * Math.max(1, n - 1)));
  const segT = t * Math.max(1, n - 1) - seg;
  const dotX = n > 1 ? interpolate(segT, [0, 1], [xs[seg]!, xs[seg + 1]!]) : xs[0]!;
  return (
    <svg width={w} height={HEIGHT} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
      {xs.slice(0, -1).map((x, i) => {
        const grow = spring({ frame: local - 14 - i * 8, fps, config: { damping: 200 } });
        return <line key={i} x1={x + 70} y1={cy} x2={x + 70 + (xs[i + 1]! - x - 140) * grow} y2={cy} stroke={tone} strokeWidth={8} strokeLinecap="round" strokeDasharray="2 18" />;
      })}
      {n > 1 && <circle cx={dotX} cy={cy} r={16} fill={tone} opacity={0.9} />}
      {nodes.map((label, i) => {
        const pop = spring({ frame: local - 8 - i * 8, fps, config: { damping: 12 } });
        return (
          <g key={i} transform={`translate(${xs[i]}, ${cy}) scale(${pop})`}>
            <circle r={n > 3 ? 58 : 70} fill="#fff" stroke={tone} strokeWidth={8} />
            <text textAnchor="middle" dy={14} fontFamily="Space Grotesk" fontWeight={700} fontSize={44} fill={tone}>
              {i + 1}
            </text>
            <foreignObject x={-120} y={92} width={240} height={140}>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 34, lineHeight: 1.15, textAlign: 'center', color: C.ink }}>{label}</div>
            </foreignObject>
          </g>
        );
      })}
    </svg>
  );
};

const Chips: React.FC<{ items: { text: string; tone?: Tone; strike?: boolean }[]; tone: string; local: number; fps: number }> = ({ items, tone, local, fps }) => (
  <div style={{ position: 'absolute', inset: '0 60px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 34 }}>
    {items.slice(0, 4).map((c, i) => {
      const pop = spring({ frame: local - 10 - i * 9, fps, config: { damping: 11 } });
      const color = c.tone ? TONE[c.tone] : tone;
      const float = Math.sin((local + i * 17) / 18) * 6;
      return (
        <div
          key={i}
          style={{
            position: 'relative',
            fontFamily: 'Space Grotesk',
            fontWeight: 700,
            fontSize: 64,
            padding: '22px 54px',
            borderRadius: 999,
            background: '#fff',
            border: `6px solid ${color}`,
            color,
            transform: `translateY(${float}px) scale(${pop}) rotate(${(i % 2 ? 1 : -1) * 2}deg)`,
            boxShadow: `0 16px 40px ${color}33`,
          }}
        >
          {c.text}
          {c.strike && (
            <div
              style={{
                position: 'absolute',
                left: 30,
                right: 30,
                top: '50%',
                height: 8,
                borderRadius: 8,
                background: C.red,
                transformOrigin: 'left',
                transform: `scaleX(${spring({ frame: local - 26 - i * 9, fps, config: { damping: 200 } })})`,
              }}
            />
          )}
        </div>
      );
    })}
  </div>
);

const Stat: React.FC<{ k: string; v: string; tone: string; local: number; fps: number }> = ({ k, v, tone, local, fps }) => {
  const pop = spring({ frame: local - 8, fps, config: { damping: 12 } });
  // Count up the leading number ("7-8 MB" -> 7..), keeping the rest of the text as is.
  const m = v.match(/^(\d+(?:\.\d+)?)(.*)$/);
  const shown = m ? `${Math.round(Number(m[1]) * Math.min(1, local / (0.8 * fps)))}${m[2]}` : v;
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div
        style={{
          width: 560,
          height: 560,
          borderRadius: '50%',
          background: '#fff',
          border: `10px solid ${tone}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `scale(${pop})`,
          boxShadow: `0 24px 70px ${tone}40`,
          textAlign: 'center',
          padding: 40,
        }}
      >
        <div style={{ fontFamily: 'JetBrains Mono', fontWeight: 700, fontSize: 30, letterSpacing: 3, color: '#6B7180' }}>{k.toUpperCase()}</div>
        <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: shown.length > 10 ? 72 : 110, lineHeight: 1.05, color: tone, marginTop: 14 }}>{shown}</div>
      </div>
    </div>
  );
};

const Orbit: React.FC<{ word: string; tone: string; local: number; fps: number }> = ({ word, tone, local, fps }) => {
  const pop = spring({ frame: local - 8, fps, config: { damping: 13 } });
  const cx = 540;
  const cy = HEIGHT / 2 - 10;
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <svg width={1080} height={HEIGHT} style={{ position: 'absolute', inset: 0 }}>
        {[200, 270, 340].map((r, i) => (
          <circle key={r} cx={cx} cy={cy} r={r * pop} fill="none" stroke={tone} strokeOpacity={0.25 - i * 0.06} strokeWidth={4} strokeDasharray="6 14" />
        ))}
        {[0, 1, 2].map((i) => {
          const a = (local / fps) * (0.9 + i * 0.3) + (i * Math.PI * 2) / 3;
          const r = 200 + i * 70;
          return <circle key={i} cx={cx + Math.cos(a) * r * pop} cy={cy + Math.sin(a) * r * pop} r={26 - i * 5} fill={tone} />;
        })}
      </svg>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: cy - 70,
          textAlign: 'center',
          fontFamily: 'Space Grotesk',
          fontWeight: 700,
          fontSize: word.length > 12 ? 80 : 120,
          color: tone,
          transform: `scale(${pop})`,
          letterSpacing: -2,
        }}
      >
        {word}
      </div>
    </div>
  );
};
