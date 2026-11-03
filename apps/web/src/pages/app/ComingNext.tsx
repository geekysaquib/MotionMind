import { Link } from 'react-router-dom';
import { Hammer } from 'lucide-react';
import { Card } from '../../components/ui';

/** Honest placeholder for modules that are planned but not built yet. No fake controls. */
export function ComingNext({ title, phase, points, needs }: { title: string; phase: string; points: string[]; needs?: { label: string; to: string } }) {
  return (
    <Card className="mx-auto max-w-2xl">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/15">
          <Hammer className="h-5 w-5 text-violet-600" />
        </div>
        <div>
          <h2 className="font-display text-xl font-semibold">{title}</h2>
          <p className="text-xs uppercase tracking-wider text-ink-400">Not built yet · {phase}</p>
        </div>
      </div>
      <ul className="mt-6 space-y-2 text-sm text-ink-300">
        {points.map((p) => (
          <li key={p} className="flex gap-2">
            <span className="text-accent">•</span> {p}
          </li>
        ))}
      </ul>
      {needs && (
        <Link to={needs.to} className="mt-6 inline-block text-sm font-semibold text-accent hover:underline">
          {needs.label} →
        </Link>
      )}
    </Card>
  );
}
