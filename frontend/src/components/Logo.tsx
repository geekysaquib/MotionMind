import { BRAND } from '@motionmind/shared';
import { cn } from '../lib/cn';

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} aria-hidden>
      <rect width="512" height="512" rx="120" fill="#1F2430" />
      <polygon points="256,108 396,189 256,270 116,189" fill="#5EEAD4" />
      <polygon points="116,189 256,270 256,432 116,351" fill="#F7A08A" />
      <polygon points="256,270 396,189 396,351 256,432" fill="#8B5CF6" />
      <polyline points="152,352 152,240 256,330 360,240 360,352" fill="none" stroke="#fff" strokeWidth="34" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="256" cy="189" r="20" fill="#fff" />
    </svg>
  );
}

export function Logo({ className, size = 'md' }: { className?: string; size?: 'sm' | 'md' | 'lg' }) {
  const s = { sm: 'h-7 w-7 text-base', md: 'h-9 w-9 text-lg', lg: 'h-12 w-12 text-2xl' }[size];
  const [first, ...rest] = BRAND.name.split(' ');
  return (
    <span className={cn('inline-flex items-center gap-2.5 font-display font-bold tracking-tight', className)}>
      <LogoMark className={s.split(' ').slice(0, 2).join(' ')} />
      <span className={s.split(' ')[2]}>
        {first} <span className="text-accent">{rest.join(' ')}</span>
      </span>
    </span>
  );
}
