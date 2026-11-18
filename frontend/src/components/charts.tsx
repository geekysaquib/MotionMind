import { cn } from '../lib/cn';

/** A tiny trend line for a stat card. `values` are plotted left to right; a flat line when all are equal. */
export function Sparkline({ values, className }: { values: number[]; className?: string }) {
  const w = 120;
  const h = 32;
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? w / (values.length - 1) : w;
  const pts = values.map((v, i) => `${(i * step).toFixed(1)},${(h - 3 - (v / max) * (h - 6)).toFixed(1)}`);
  const line = pts.join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={cn('h-8 w-full', className)} aria-hidden>
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8b5cf6" stopOpacity=".35" />
          <stop offset="1" stopColor="#8b5cf6" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${line} ${w},${h}`} fill="url(#spark-fill)" />
      <polyline points={line} fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Vertical bars with a label under each, for counts per day. The bars grow in when shown. */
export function BarChart({ data, className, label }: { data: { label: string; value: number; hint?: string }[]; className?: string; label: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className={cn('flex h-40 items-end gap-1.5', className)} role="img" aria-label={label}>
      {data.map((d, i) => (
        <div key={`${d.label}-${i}`} className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5" title={d.hint ?? `${d.label}: ${d.value}`}>
          <span className="text-[10px] font-semibold text-ink-300 opacity-0 transition group-hover:opacity-100">{d.value}</span>
          <div
            className={cn('grow-bar w-full rounded-md transition-colors', d.value ? 'bg-gradient-to-t from-mint-600 to-mint-400 group-hover:from-mint-500 group-hover:to-mint-300' : 'bg-line/[0.07]')}
            style={{ height: `${Math.max(4, (d.value / max) * 100)}%`, animationDelay: `${i * 25}ms` }}
          />
          <span className="truncate text-[10px] text-ink-400">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

/** Horizontal bars with a label and a count, for shares (steps reached, styles used). */
export function BarList({ data, empty }: { data: { label: string; value: number }[]; empty?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (!data.length) return <p className="text-sm text-ink-400">{empty ?? 'Nothing yet.'}</p>;
  return (
    <ul className="space-y-2.5">
      {data.map((d, i) => (
        <li key={d.label}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="truncate text-ink-300">{d.label}</span>
            <span className="font-semibold text-ink-100">{d.value}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-line/[0.07]">
            <div className="grow-x h-full rounded-full bg-gradient-to-r from-mint-600 to-mint-400" style={{ width: `${(d.value / max) * 100}%`, animationDelay: `${i * 40}ms` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
