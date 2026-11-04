import type { CSSProperties, ReactNode } from 'react';
import { cn } from '../lib/cn';

type G = { className?: string };
const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

/** Black-outline glyphs, drawn on a 48 grid. They take their colour from the text colour. */
const Reels = (p: G) => (
  <svg viewBox="0 0 48 48" {...p} {...base}>
    <rect x="7" y="7" width="34" height="34" rx="9" />
    <path d="M7 17h34M17 7l5 10M28 7l5 10" />
    <path d="M20 26v9l8-4.5z" />
  </svg>
);
const Insta = (p: G) => (
  <svg viewBox="0 0 48 48" {...p} {...base}>
    <rect x="7" y="7" width="34" height="34" rx="10" />
    <circle cx="24" cy="24" r="8" />
    <circle cx="33.5" cy="14.5" r="1.4" />
  </svg>
);
const YouTube = (p: G) => (
  <svg viewBox="0 0 48 48" {...p} {...base}>
    <rect x="4" y="11" width="40" height="26" rx="9" />
    <path d="M20 18v12l11-6z" />
  </svg>
);
const Shorts = (p: G) => (
  <svg viewBox="0 0 48 48" {...p} {...base}>
    <path d="M18 9l14 8a5 5 0 0 1 0 9l-3 1.7M30 39l-14-8a5 5 0 0 1 0-9l3-1.7" />
    <path d="M21 20v8l7-4z" />
  </svg>
);
const Heart = (p: G) => (
  <svg viewBox="0 0 48 48" {...p} {...base}>
    <path d="M24 39S8 29.5 8 18.5A8.5 8.5 0 0 1 24 14a8.5 8.5 0 0 1 16 4.5C40 29.5 24 39 24 39z" />
  </svg>
);
const Phone = (p: G) => (
  <svg viewBox="0 0 48 48" {...p} {...base}>
    <rect x="13" y="5" width="22" height="38" rx="5" />
    <path d="M21 9h6M22 38h4" />
  </svg>
);
const Film = (p: G) => (
  <svg viewBox="0 0 48 48" {...p} {...base}>
    <rect x="6" y="10" width="36" height="28" rx="4" />
    <path d="M14 10v28M34 10v28M6 19h8M6 29h8M34 19h8M34 29h8" />
  </svg>
);

const ICONS = [Reels, Insta, YouTube, Shorts, Heart, Phone, Film];

/** Where each one sits (percent), how big (px), how long a loop takes (s) and its tilt. Fixed, so the layout is calm and never jumps. */
const SPOTS: { i: number; x: number; y: number; s: number; d: number; r: number }[] = [
  { i: 0, x: 4, y: 8, s: 64, d: 11, r: -12 },
  { i: 1, x: 90, y: 6, s: 56, d: 13, r: 10 },
  { i: 2, x: 80, y: 40, s: 72, d: 15, r: -6 },
  { i: 3, x: 8, y: 36, s: 52, d: 12, r: 14 },
  { i: 4, x: 52, y: 4, s: 40, d: 10, r: 8 },
  { i: 5, x: 94, y: 74, s: 60, d: 14, r: -10 },
  { i: 6, x: 3, y: 66, s: 68, d: 16, r: 6 },
  { i: 1, x: 46, y: 88, s: 48, d: 12, r: -14 },
  { i: 0, x: 70, y: 92, s: 44, d: 13, r: 12 },
  { i: 2, x: 24, y: 90, s: 50, d: 17, r: -4 },
];

/**
 * Reels, Instagram and YouTube drawn as thin black outlines that drift and turn slowly behind a page.
 * Decoration only: it ignores the pointer, is hidden from screen readers, and stops under reduced motion.
 */
export function FloatingIcons({ className, count = SPOTS.length, tone = 'text-ink-100/[0.15]' }: { className?: string; count?: number; tone?: string }): ReactNode {
  return (
    <div className={cn('pointer-events-none absolute inset-0 overflow-hidden', tone, className)} aria-hidden>
      {SPOTS.slice(0, count).map((s, n) => {
        const Icon = ICONS[s.i]!;
        return (
          <span
            key={n}
            className="float-icon absolute"
            style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.s, height: s.s, '--r': `${s.r}deg`, '--t': `${s.d}s`, animationDelay: `${-n * 1.7}s` } as CSSProperties}
          >
            <Icon className="h-full w-full" />
          </span>
        );
      })}
    </div>
  );
}
