import { BRAND } from '@motionmind/shared';
import { cn } from '../lib/cn';

/**
 * The mark: an isometric cube (the 3D world every reel is built in) with an M cut across its front faces and a spark on top.
 * With `animated`, the three faces drop in one after another, the M draws itself, and the spark keeps a soft pulse.
 */
export function LogoMark({ className, animated = false }: { className?: string; animated?: boolean }) {
  const face = (delay: number) => (animated ? { style: { animation: `pop .6s ${delay}s cubic-bezier(.2,.8,.2,1) both`, transformOrigin: '256px 270px' } } : {});
  return (
    <svg viewBox="0 0 512 512" className={className} aria-hidden>
      <defs>
        <linearGradient id="lm-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2A3142" />
          <stop offset="1" stopColor="#171B26" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="120" fill="url(#lm-bg)" />
      <g {...face(0.05)}>
        <polygon points="256,108 396,189 256,270 116,189" fill="#5EEAD4" />
      </g>
      <g {...face(0.18)}>
        <polygon points="116,189 256,270 256,432 116,351" fill="#F7A08A" />
      </g>
      <g {...face(0.31)}>
        <polygon points="256,270 396,189 396,351 256,432" fill="#8B5CF6" />
      </g>
      <polyline
        points="152,352 152,240 256,330 360,240 360,352"
        fill="none"
        stroke="#fff"
        strokeWidth="34"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={animated ? 'draw' : undefined}
        style={animated ? ({ '--len': 560 } as React.CSSProperties) : undefined}
      />
      <circle cx="256" cy="189" r="20" fill="#fff" />
      {animated && <circle cx="256" cy="189" r="20" fill="none" stroke="#fff" strokeWidth="6" className="origin-center animate-ping-soft" style={{ transformBox: 'fill-box' }} />}
    </svg>
  );
}

export function Logo({ className, size = 'md', animated = false }: { className?: string; size?: 'sm' | 'md' | 'lg'; animated?: boolean }) {
  const s = { sm: 'h-7 w-7 text-base', md: 'h-9 w-9 text-lg', lg: 'h-12 w-12 text-2xl' }[size];
  const [first, ...rest] = BRAND.name.split(' ');
  return (
    <span className={cn('group inline-flex items-center gap-2.5 font-display font-bold tracking-tight', className)}>
      <LogoMark animated={animated} className={cn(s.split(' ').slice(0, 2).join(' '), 'transition-transform duration-500 group-hover:rotate-[-8deg] group-hover:scale-110')} />
      <span className={s.split(' ')[2]}>
        {first} <span className="text-gradient">{rest.join(' ')}</span>
      </span>
    </span>
  );
}
