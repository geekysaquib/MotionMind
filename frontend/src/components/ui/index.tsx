import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/cn';

type Variant = 'primary' | 'dark' | 'secondary' | 'ghost' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:brightness-110 shadow-glow',
  dark: 'bg-ink-100 text-ink-950 hover:opacity-90',
  secondary: 'bg-line/[0.05] text-ink-100 hover:bg-line/[0.09] border border-line/[0.12]',
  ghost: 'text-ink-300 hover:text-ink-100 hover:bg-line/5',
  danger: 'bg-coral-500/10 text-danger border border-coral-500/30 hover:bg-coral-500/20',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, icon, className, children, disabled, ...rest },
  ref,
) {
  const sizes = { sm: 'h-8 px-3 text-xs', md: 'h-10 px-4 text-sm', lg: 'h-12 px-6 text-base' };
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition active:scale-[.98] disabled:pointer-events-none disabled:opacity-50',
        VARIANTS[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});

export interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  trailing?: ReactNode;
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field({ label, hint, error, trailing, id, className, ...rest }, ref) {
  const fid = id ?? `f-${label.toLowerCase().replace(/\W+/g, '-')}`;
  return (
    <div className={className}>
      <label htmlFor={fid} className="label">
        {label}
      </label>
      <div className="relative">
        <input ref={ref} id={fid} aria-invalid={Boolean(error)} className={cn('field', trailing ? 'pr-10' : '', error && 'border-coral-500/60')} {...rest} />
        {trailing && <div className="absolute inset-y-0 right-3 flex items-center">{trailing}</div>}
      </div>
      {error ? <p className="mt-1.5 text-xs text-danger">{error}</p> : hint ? <div className="mt-1.5 text-xs text-ink-400">{hint}</div> : null}
    </div>
  );
});

export function Select({ label, children, id, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  const fid = id ?? `s-${label.toLowerCase().replace(/\W+/g, '-')}`;
  return (
    <div>
      <label htmlFor={fid} className="label">
        {label}
      </label>
      <select id={fid} className="field appearance-none" {...rest}>
        {children}
      </select>
    </div>
  );
}

export function Badge({ tone = 'neutral', children }: { tone?: 'neutral' | 'mint' | 'coral' | 'violet' | 'amber'; children: ReactNode }) {
  const tones = {
    neutral: 'bg-line/5 text-ink-300 border-line/10',
    mint: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30',
    coral: 'bg-coral-500/10 text-danger border-coral-500/30',
    violet: 'bg-violet-500/10 text-violet-600 border-violet-500/30',
    amber: 'bg-amber-400/10 text-amber-700 border-amber-400/30',
  };
  return <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold', tones[tone])}>{children}</span>;
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('card p-6', className)}>{children}</div>;
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-2 text-sm text-ink-400">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {label}…
    </div>
  );
}

export function Alert({ tone = 'error', children }: { tone?: 'error' | 'info' | 'success'; children: ReactNode }) {
  const tones = {
    error: 'border-coral-500/30 bg-coral-500/10 text-danger',
    info: 'border-line/10 bg-line/5 text-ink-300',
    success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700',
  };
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cn('rounded-xl border px-4 py-3 text-sm', tones[tone])}>
      {children}
    </div>
  );
}
