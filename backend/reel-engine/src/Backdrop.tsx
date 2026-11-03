import React from 'react';
import { interpolate, spring } from 'remotion';
import { C } from './World';
import type { Tone } from './script';

const TONE: Record<Tone, string> = { red: C.red, teal: C.teal, purple: C.purple, blue: C.blue, amber: C.amber };

/**
 * The 'cards' world: a calm, moving background that works for any topic.
 * A soft grid drifts upward, and large blurred shapes take on the colour of the current beat's card.
 */
export const Backdrop: React.FC<{ frame: number; fps: number; tone: Tone; chapter: number; progress: number }> = ({ frame, fps, tone, chapter, progress }) => {
  const color = TONE[tone] ?? C.teal;
  const drift = (frame * 0.6) % 120;
  const pulse = spring({ frame: frame % (fps * 4), fps, config: { damping: 30 } });
  const orbs = [
    { x: 160, y: 520, r: 360, speed: 0.011, phase: 0 },
    { x: 900, y: 980, r: 420, speed: 0.008, phase: 2 },
    { x: 420, y: 1600, r: 300, speed: 0.013, phase: 4 },
  ];
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#F6F2E9', overflow: 'hidden' }}>
      {orbs.map((o, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: o.x + Math.sin(frame * o.speed + o.phase) * 60 - o.r,
            top: o.y + Math.cos(frame * o.speed + o.phase) * 50 - o.r,
            width: o.r * 2,
            height: o.r * 2,
            borderRadius: '50%',
            background: color,
            opacity: 0.13 + 0.04 * pulse,
            filter: 'blur(90px)',
          }}
        />
      ))}
      <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0, opacity: 0.35 }}>
        <defs>
          <pattern id="grid" width={120} height={120} patternUnits="userSpaceOnUse" y={-drift}>
            <path d="M 120 0 L 0 0 0 120" fill="none" stroke="#D9D3C4" strokeWidth={2} />
          </pattern>
        </defs>
        <rect width={1080} height={1920 + 120} fill="url(#grid)" />
      </svg>
      {/* Big chapter number, faint, behind the card */}
      {chapter > 0 && (
        <div
          style={{
            position: 'absolute',
            right: 60,
            top: 1240,
            fontFamily: 'Space Grotesk',
            fontWeight: 700,
            fontSize: 520,
            lineHeight: 1,
            color,
            opacity: interpolate(pulse, [0, 1], [0.05, 0.09]),
          }}
        >
          {chapter}
        </div>
      )}
      {/* Reel progress line along the bottom */}
      <div style={{ position: 'absolute', left: 0, bottom: 0, height: 10, width: `${progress * 100}%`, background: color, opacity: 0.8 }} />
    </div>
  );
};
