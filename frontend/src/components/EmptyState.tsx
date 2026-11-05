import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

/** A friendly "nothing here yet" panel with the one thing to do next. */
export function EmptyState({ icon, title, text, to, action }: { icon: ReactNode; title: string; text: string; to?: string; action?: string }) {
  return (
    <div className="card relative overflow-hidden px-6 py-12 text-center">
      <div className="relative">
        <span className="mx-auto flex h-12 w-12 animate-float items-center justify-center rounded-2xl bg-mint-500/10 text-accent">{icon}</span>
        <h2 className="mt-4 font-display text-lg font-bold">{title}</h2>
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink-400">{text}</p>
        {to && action && (
          <Link to={to} className="group mt-5 inline-flex items-center gap-2 rounded-lg bg-mint-600 px-4 py-2 text-sm font-semibold text-white shadow-glow transition hover:bg-mint-700">
            {action} <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </Link>
        )}
      </div>
    </div>
  );
}
