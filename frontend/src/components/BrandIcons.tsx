import { useId } from 'react';
import type { Platform } from '@motionmind/shared';
import { PLATFORMS, normalizePlatforms } from '@motionmind/shared';
import { cn } from '../lib/cn';

type IconProps = { className?: string; title?: string };

/** The Instagram glyph on its gradient tile (official colours). */
export function InstagramIcon({ className, title }: IconProps) {
  const id = useId();
  return (
    <svg viewBox="0 0 24 24" className={cn('h-4 w-4 shrink-0', className)} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <defs>
        <radialGradient id={id} cx="0.3" cy="1.05" r="1.2">
          <stop offset="0" stopColor="#FFD879" />
          <stop offset="0.25" stopColor="#FA8F21" />
          <stop offset="0.5" stopColor="#E1306C" />
          <stop offset="0.78" stopColor="#B22DBB" />
          <stop offset="1" stopColor="#5851DB" />
        </radialGradient>
      </defs>
      <rect width="24" height="24" rx="6.2" fill={`url(#${id})`} />
      <rect x="5.4" y="5.4" width="13.2" height="13.2" rx="3.9" fill="none" stroke="#fff" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="3.1" fill="none" stroke="#fff" strokeWidth="1.5" />
      <circle cx="16.1" cy="7.9" r="0.95" fill="#fff" />
    </svg>
  );
}

/** The YouTube play button (official red). */
export function YouTubeIcon({ className, title }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={cn('h-4 w-4 shrink-0', className)} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <rect x="0.5" y="4" width="23" height="16" rx="5" fill="#FF0000" />
      <path d="M9.9 8.7v6.6l5.7-3.3z" fill="#fff" />
    </svg>
  );
}

/** Claude's spark, in Anthropic's orange. */
export function ClaudeIcon({ className, title }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={cn('h-4 w-4 shrink-0', className)} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <g fill="#D97757" transform="translate(12 12)">
        {Array.from({ length: 8 }, (_, i) => (
          <rect key={i} x="-1.1" y="-10.5" width="2.2" height={i % 2 ? 6.5 : 8.5} rx="1.1" transform={`rotate(${i * 45})`} />
        ))}
      </g>
    </svg>
  );
}

/** ElevenLabs' two bars. */
export function ElevenLabsIcon({ className, title }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={cn('h-4 w-4 shrink-0', className)} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <rect x="6.5" y="3" width="4" height="18" rx="1.2" fill="currentColor" />
      <rect x="13.5" y="3" width="4" height="18" rx="1.2" fill="currentColor" />
    </svg>
  );
}

/** Wikipedia's W, for the trending source. */
export function WikipediaIcon({ className, title }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={cn('h-4 w-4 shrink-0', className)} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <circle cx="12" cy="12" r="11" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M4.8 8.2h3.2M16 8.2h3.2M6.2 8.4l3.2 8.4 2.6-6 2.6 6 3.2-8.4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PlatformIcon({ platform, className, title }: { platform: Platform; className?: string; title?: string }) {
  return platform === 'youtube' ? <YouTubeIcon className={className} title={title} /> : <InstagramIcon className={className} title={title} />;
}

/** The logos of the platforms a reel is for, side by side, with the names as the accessible label. */
export function PlatformIcons({ list, className }: { list: Platform[] | undefined; className?: string }) {
  const names = normalizePlatforms(list);
  return (
    <span className={cn('inline-flex items-center gap-1', className)} role="img" aria-label={names.map((p) => PLATFORMS[p].label).join(' and ')}>
      {names.map((p) => (
        <PlatformIcon key={p} platform={p} className="h-3.5 w-3.5" />
      ))}
    </span>
  );
}

/** A small pill: the platform's logo and short name. */
export function PlatformBadge({ platform, className }: { platform: Platform; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md bg-ink-800 px-1.5 py-0.5 text-[11px] font-semibold text-ink-300', className)}>
      <PlatformIcon platform={platform} className="h-3.5 w-3.5" /> {PLATFORMS[platform].short}
    </span>
  );
}
