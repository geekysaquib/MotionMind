import { APPROACH_IDS, APPROACHES, type ApproachId } from '@motionmind/shared';
import { cn } from '../lib/cn';

/** How the reel explains its topic: shapes both the research and the script prompt. */
export function ApproachPicker({ value, onChange }: { value: ApproachId; onChange: (a: ApproachId) => void }) {
  return (
    <fieldset className="card p-4">
      <legend className="sr-only">How should the reel explain it?</legend>
      <div className="text-sm font-semibold">How should the reel explain it?</div>
      <p className="mt-0.5 text-xs text-ink-400">Used by the research and the script prompt. Pick it before you copy the prompt.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5" role="radiogroup">
        {APPROACH_IDS.map((id) => {
          const a = APPROACHES[id];
          const on = id === value;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(id)}
              className={cn('rounded-xl border p-3 text-left transition', on ? 'border-mint-500/60 bg-mint-500/10 ring-1 ring-mint-500/30' : 'border-line/10 hover:border-line/25 hover:bg-line/[0.04]')}
            >
              <div className={cn('text-sm font-semibold', on && 'text-accent')}>{a.label}</div>
              <div className="mt-1 text-xs leading-snug text-ink-400">{a.hint}</div>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
