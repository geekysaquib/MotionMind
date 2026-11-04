import { BRAND } from '@motionmind/shared';
import { cn } from '../lib/cn';

/**
 * The mark, in two colours: violet and white. An isometric cube (the 3D world every reel is built in) whose front
 * reads as an M. With `animated`, the cube draws itself, then the M.
 */
export function LogoMark({ className, animated = false }: { className?: string; animated?: boolean }) {
  const draw = (delay: number, len: number) => (animated ? { className: 'draw', style: { '--len': len, animationDelay: `${delay}s` } as React.CSSProperties } : {});
  return (
    <svg viewBox="0 0 512 512" className={className} aria-hidden>
      <rect width="512" height="512" rx="120" fill="#6D28D9" />
      <g fill="none" stroke="#fff" strokeLinecap="round" strokeLinejoin="round">
        <path d="M256 78 400 161V351L256 434 112 351V161Z" strokeWidth="20" {...draw(0.1, 900)} />
        <path d="M178 336V204L256 282 334 204V336" strokeWidth="32" {...draw(0.7, 520)} />
      </g>
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
        {first} <span className="text-accent">{rest.join(' ')}</span>
      </span>
    </span>
  );
}
