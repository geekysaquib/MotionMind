import { Check } from 'lucide-react';
import { PLATFORMS, PLATFORM_IDS, type Platform } from '@motionmind/shared';
import { cn } from '../lib/cn';
import { PlatformIcon } from './BrandIcons';

/** Pick Instagram Reels, YouTube Shorts, or both. At least one stays on. */
export function PlatformPicker({ value, onChange, compact }: { value: Platform[]; onChange: (next: Platform[]) => void; compact?: boolean }) {
  function toggle(p: Platform) {
    const on = value.includes(p);
    if (on && value.length === 1) return;
    onChange(PLATFORM_IDS.filter((x) => (x === p ? !on : value.includes(x))));
  }
  return (
    <div role="group" aria-label="Platforms" className="flex flex-wrap items-center gap-2">
      {PLATFORM_IDS.map((p) => {
        const on = value.includes(p);
        return (
          <button
            key={p}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(p)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg border font-medium transition',
              compact ? 'h-8 px-2.5 text-xs' : 'h-10 px-3.5 text-sm',
              on ? 'border-mint-500/60 bg-mint-400/10 text-accent' : 'border-line/[0.12] bg-ink-900 text-ink-300 hover:bg-ink-800',
            )}
          >
            <PlatformIcon platform={p} className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
            {PLATFORMS[p].label}
            {on && <Check className="h-3.5 w-3.5 animate-pop" />}
          </button>
        );
      })}
    </div>
  );
}
