import { useEffect, useRef, useState, type CSSProperties, type ElementType, type ReactNode } from 'react';
import { cn } from '../lib/cn';

/** True when the browser can watch elements scroll into view (jsdom, tests and old browsers can't: show everything). */
const canObserve = () => typeof window !== 'undefined' && 'IntersectionObserver' in window;
const reduced = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Fades and slides its children in the first time they scroll into view. `delay` staggers siblings (ms). */
export function Reveal({ children, delay = 0, as: Tag = 'div', className }: { children: ReactNode; delay?: number; as?: ElementType; className?: string }) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(() => !canObserve());
  useEffect(() => {
    const el = ref.current;
    if (shown || !el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -6% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shown]);
  return (
    <Tag ref={ref} className={cn('reveal', shown && 'is-in', className)} style={{ '--d': `${delay}ms` } as CSSProperties}>
      {children}
    </Tag>
  );
}

/** A number that counts up from 0 when first shown. */
export function CountUp({ to, durationMs = 900, className }: { to: number; durationMs?: number; className?: string }) {
  const [v, setV] = useState(() => (reduced() || typeof requestAnimationFrame === 'undefined' ? to : 0));
  useEffect(() => {
    if (reduced() || typeof requestAnimationFrame === 'undefined') {
      setV(to);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      setV(Math.round(to * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, durationMs]);
  return <span className={className}>{v}</span>;
}

/** A circular progress meter that fills in when it appears. `value` is 0 to 1. */
export function ProgressRing({ value, size = 56, stroke = 6, children, className }: { value: number; size?: number; stroke?: number; children?: ReactNode; className?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const [v, setV] = useState(0);
  useEffect(() => {
    const id = setTimeout(() => setV(Math.max(0, Math.min(1, value))), 60);
    return () => clearTimeout(id);
  }, [value]);
  return (
    <div className={cn('relative inline-flex items-center justify-center', className)} style={{ width: size, height: size }} role="img" aria-label={`${Math.round(value * 100)} percent done`}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={`pr-${size}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#2DD4BF" />
            <stop offset="1" stopColor="#8B5CF6" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeOpacity={0.1} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#pr-${size})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(.2,.8,.2,1)' }}
        />
      </svg>
      {children && <div className="absolute inset-0 flex items-center justify-center text-xs font-bold">{children}</div>}
    </div>
  );
}

/** Types out each phrase, deletes it, and moves on to the next. Static text for people who prefer less motion. */
export function Typewriter({ phrases, className }: { phrases: string[]; className?: string }) {
  const [i, setI] = useState(0);
  const [n, setN] = useState(() => (reduced() ? phrases[0]?.length ?? 0 : 0));
  const [deleting, setDeleting] = useState(false);
  useEffect(() => {
    if (reduced() || phrases.length === 0) return;
    const word = phrases[i % phrases.length]!;
    const done = !deleting && n === word.length;
    const empty = deleting && n === 0;
    const id = setTimeout(
      () => {
        if (done) setDeleting(true);
        else if (empty) {
          setDeleting(false);
          setI((x) => x + 1);
        } else setN((x) => x + (deleting ? -1 : 1));
      },
      done ? 1500 : empty ? 250 : deleting ? 30 : 70,
    );
    return () => clearTimeout(id);
  }, [n, deleting, i, phrases]);
  const text = (phrases[i % phrases.length] ?? '').slice(0, n);
  return (
    <span className={className} aria-label={phrases[i % phrases.length]}>
      {text}
      <span className="ml-0.5 inline-block w-[3px] animate-blink bg-current align-[-0.1em]" style={{ height: '0.9em' }} aria-hidden />
    </span>
  );
}
