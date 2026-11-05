import { useMemo, useState } from 'react';
import { Check, Sparkles, WandSparkles } from 'lucide-react';
import { planGraphics, scoreScene, type PlanMode } from '@motionmind/reel-engine';
import type { ReelScript } from '@motionmind/shared';
import { Button, Card } from './ui';
import { cn } from '../lib/cn';

type Beats = Parameters<typeof planGraphics>[0];

/** How a score reads: the colour and the word. */
export function scoreTone(score: number): { label: string; cls: string } {
  if (score >= 80) return { label: 'Strong', cls: 'bg-emerald-400/15 text-emerald-700' };
  if (score >= 60) return { label: 'Good', cls: 'bg-mint-400/15 text-accent' };
  return { label: 'Weak', cls: 'bg-amber-400/15 text-amber-700' };
}

/** A small badge with a scene's graphics score. */
export function ScoreBadge({ score }: { score: number }) {
  const t = scoreTone(score);
  return (
    <span title="How well the objects in this scene cover what its words talk about" className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold', t.cls)}>
      <Sparkles className="h-3 w-3" aria-hidden /> {t.label} · {score}
    </span>
  );
}

const MODES: { id: PlanMode; label: string; text: string }[] = [
  { id: 'fill', label: 'Fill empty scenes', text: 'Only scenes with no objects get designed. Your scenes stay as they are.' },
  { id: 'improve', label: 'Improve weak scenes', text: 'Scenes that fit their words badly are redesigned; scenes that already fit are kept.' },
  { id: 'redesign', label: 'Redesign every scene', text: 'Every scene is designed again from its words (never replaced by a lower-scoring one).' },
];

/** Designs the 3D scenes from the script's words, and rates each scene. Nothing is saved until the storyboard is saved. */
export function GraphicsDesigner({ script, onChange }: { script: ReelScript; onChange: (next: ReelScript) => void }) {
  const [mode, setMode] = useState<PlanMode>('improve');
  const [last, setLast] = useState<{ changed: number; total: number; theme: string } | null>(null);
  const ctx = useMemo(() => ({ glossary: script.glossary, brands: script.brands }), [script.glossary, script.brands]);
  const scores = useMemo(() => script.beats.map((b) => scoreScene(b as never, b.scene as never, ctx)), [script.beats, ctx]);
  const avg = scores.length ? Math.round(scores.reduce((n, s) => n + s, 0) / scores.length) : 0;

  function run() {
    const plan = planGraphics(script.beats as unknown as Beats, ctx, mode);
    const changed = plan.beats.filter((b, i) => b !== (script.beats as unknown as Beats)[i]).length;
    // Companies it found become part of the script, so their logos show on the cards too.
    const brands = [...(script.brands ?? [])];
    for (const b of plan.brands) if (!brands.some((x) => x.domain === b.domain || x.name.toLowerCase() === b.name.toLowerCase())) brands.push(b);
    onChange({ ...script, beats: plan.beats as unknown as ReelScript['beats'], brands });
    setLast({ changed, total: plan.beats.length, theme: plan.theme });
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-semibold">
            <WandSparkles className="h-4 w-4 text-accent" /> Design the graphics from the words
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-ink-400">
            Reads every scene's headline, narration, short forms and company names, picks the best 3D objects and company logos for each, orders them the way the narration mentions them, and links them with what moves between.
          </p>
        </div>
        <div className="text-right text-xs text-ink-400">
          Graphics score
          <div className="font-display text-2xl font-bold text-ink-100">{avg}</div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2" role="radiogroup" aria-label="How much to design">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={mode === m.id}
            onClick={() => setMode(m.id)}
            className={cn('rounded-lg border px-3 py-1.5 text-sm font-medium transition', mode === m.id ? 'border-mint-500/60 bg-mint-400/10 text-accent' : 'border-line/[0.12] text-ink-300 hover:bg-ink-800')}
          >
            {m.label}
          </button>
        ))}
        <Button className="ml-auto" icon={<WandSparkles className="h-4 w-4" />} onClick={run}>
          Design graphics
        </Button>
      </div>
      <p className="mt-2 text-xs text-ink-400">{MODES.find((m) => m.id === mode)!.text}</p>
      {last && (
        <p role="status" className="mt-3 flex items-center gap-1.5 text-sm text-emerald-700">
          <Check className="h-4 w-4" aria-hidden />
          {last.changed === 0 ? 'Every scene already fits its words, so nothing changed.' : `Designed ${last.changed} of ${last.total} scenes.`} The words suggest the “{last.theme}” world. Save the storyboard to keep this, or Undo changes to go back.
        </p>
      )}
    </Card>
  );
}
