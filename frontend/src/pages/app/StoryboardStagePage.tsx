import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
import { observer } from 'mobx-react-lite';
import { useOutletContext } from 'react-router-dom';
import { ArrowDown, ArrowUp, Plus, Trash2, Layers3 } from 'lucide-react';
import { DEFAULT_TEMPLATE, reelWorld, TEMPLATES, WORLD_THEMES, type Project, type ReelBeat, type ReelScript, type ReelTone, type WorldTheme } from '@motionmind/shared';
import { useStores } from '../../stores/RootStore';
import { EmptyState } from '../../components/EmptyState';
import { Alert, Button, Card, Spinner } from '../../components/ui';
import { errorText } from '../../lib/format';
import { brandFor, specFromScript } from '../../components/reelSpec';
import { cn } from '../../lib/cn';
import { SceneEditor } from '../../components/SceneEditor';
import { TemplatePicker } from '../../components/TemplatePicker';
import { TermsEditor } from '../../components/TermsEditor';

const THEME_LABELS: Record<WorldTheme, string> = { city: 'City (apps, payments, services)', nature: 'Nature (food, biology, outdoors)', lab: 'Lab (science, chips, AI)', plain: 'Plain (anything abstract)', night: 'Night (security, space, late-night tech)', sunset: 'Sunset (stories, culture, travel)', ocean: 'Ocean (water, ships, climate)', desert: 'Desert (energy, mining, history)' };

const ReelPreview = lazy(() => import('../../components/ReelPreview'));

const TONES: { id: ReelTone; label: string; swatch: string }[] = [
  { id: 'teal', label: 'Teal', swatch: 'bg-[#14B8A6]' },
  { id: 'blue', label: 'Blue', swatch: 'bg-[#3B82F6]' },
  { id: 'purple', label: 'Purple', swatch: 'bg-[#8B5CF6]' },
  { id: 'amber', label: 'Amber', swatch: 'bg-[#F59E0B]' },
  { id: 'red', label: 'Red', swatch: 'bg-[#E5484D]' },
];

const inputCls = 'w-full rounded-lg border border-line/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-accent';

/** Keeps caption highlights only for words still in the narration. */
function cleanKeywords(b: ReelBeat): ReelBeat {
  const words = new Set(b.narration.toLowerCase().split(/\s+/));
  return { ...b, keywords: b.keywords.filter((k) => words.has(k.toLowerCase())) };
}

/** Storyboard stage: edit the script beat by beat (words, card, colour, order) with the reel playing alongside. */
export const StoryboardStagePage = observer(function StoryboardStagePage() {
  const project = useOutletContext<Project>();
  const { projects, profile } = useStores();
  const [draft, setDraft] = useState<ReelScript | null>(project.script);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // A new script from the Script tab replaces the draft.
  useEffect(() => setDraft(project.script), [project.script]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(project.script);
  const spec = useMemo(() => (draft && draft.beats.length ? specFromScript(draft, brandFor(profile.profile)) : null), [draft, profile.profile]);

  if (!draft) {
    return (
      <EmptyState icon={<Layers3 className="h-6 w-6" />} title="No script yet" text="Write the script first, then shape it scene by scene here." to={`/app/projects/${project.id}/script`} action="Go to Script" />
    );
  }

  const update = (i: number, patch: Partial<ReelBeat> | ((b: ReelBeat) => ReelBeat)) =>
    setDraft((d) => d && { ...d, beats: d.beats.map((b, j) => (j === i ? (typeof patch === 'function' ? patch(b) : { ...b, ...patch }) : b)) });
  const updateCard = (i: number, patch: Partial<ReelBeat['card']>) => update(i, (b) => ({ ...b, card: { ...b.card, ...patch } }));
  const move = (i: number, by: -1 | 1) =>
    setDraft((d) => {
      if (!d) return d;
      const beats = [...d.beats];
      const j = i + by;
      if (j < 0 || j >= beats.length) return d;
      [beats[i], beats[j]] = [beats[j]!, beats[i]!];
      return { ...d, beats };
    });
  const remove = (i: number) => setDraft((d) => d && { ...d, beats: d.beats.filter((_, j) => j !== i) });
  const add = (i: number) =>
    setDraft((d) => {
      if (!d) return d;
      const prev = d.beats[i];
      const beat: ReelBeat = {
        id: `beat-${Date.now().toString(36)}`,
        narration: 'New line of narration.',
        keywords: [],
        chapter: prev?.chapter ?? 1,
        card: { eyebrow: prev?.card.eyebrow ?? 'New scene', headline: 'New *headline*', tone: prev?.card.tone ?? 'teal', rows: [] },
      };
      const beats = [...d.beats];
      beats.splice(i + 1, 0, beat);
      return { ...d, beats };
    });

  async function save() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      await projects.saveScript(project.id, { ...draft, glossary: draft.glossary?.filter((g) => g.short.trim() && g.full.trim()), brands: draft.brands?.filter((b) => b.name.trim() && b.domain.trim()), beats: draft.beats.map(cleanKeywords) });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-4">
        <Card>
          <h2 className="flex items-center gap-2 font-semibold">
            <Layers3 className="h-4 w-4 text-accent" /> Choose a template
          </h2>
          <p className="mt-1 mb-4 text-sm text-ink-400">The look of the reel: the world, the header, the cards and the captions. The preview on the right updates as you pick. You can still edit every scene below.</p>
          <TemplatePicker
            value={draft.template ?? DEFAULT_TEMPLATE}
            onChange={(id) => setDraft({ ...draft, template: id, ...(reelWorld(draft) === 'iso' ? { theme: TEMPLATES[id].theme } : {}) })}
          />
        </Card>
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-[220px] flex-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-ink-400" htmlFor="sb-title">
                Reel title
              </label>
              <input id="sb-title" className={cn(inputCls, 'mt-1 font-semibold')} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" disabled={!dirty || saving} onClick={() => setDraft(project.script)}>
                Undo changes
              </Button>
              <Button loading={saving} disabled={!dirty} onClick={() => void save()}>
                {saved ? 'Saved' : 'Save storyboard'}
              </Button>
            </div>
          </div>
          {reelWorld(draft) === 'iso' && (
            <label className="mt-4 block text-xs text-ink-400">
              Look of the 3D world
              <select className={cn(inputCls, 'mt-1 max-w-xs')} value={draft.theme ?? 'city'} onChange={(e) => setDraft({ ...draft, theme: e.target.value as WorldTheme })}>
                {WORLD_THEMES.map((t) => (
                  <option key={t} value={t}>
                    {THEME_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="mt-4">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">Header steps</span>
            <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {draft.steps.map((s, i) => (
                <input
                  key={i}
                  aria-label={`Step ${i + 1}`}
                  className={inputCls}
                  value={s}
                  onChange={(e) => setDraft({ ...draft, steps: draft.steps.map((x, j) => (j === i ? e.target.value : x)) })}
                />
              ))}
            </div>
          </div>
          <TermsEditor script={draft} onChange={setDraft} />
          {error && <div className="mt-4"><Alert>{error}</Alert></div>}
        </Card>

        {draft.beats.map((b, i) => (
          <Card key={b.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold">Scene {i + 1}</span>
              <div className="flex items-center gap-1">
                <IconButton label={`Move scene ${i + 1} up`} disabled={i === 0} onClick={() => move(i, -1)} icon={<ArrowUp className="h-4 w-4" />} />
                <IconButton label={`Move scene ${i + 1} down`} disabled={i === draft.beats.length - 1} onClick={() => move(i, 1)} icon={<ArrowDown className="h-4 w-4" />} />
                <IconButton label={`Add a scene after ${i + 1}`} onClick={() => add(i)} icon={<Plus className="h-4 w-4" />} />
                <IconButton label={`Delete scene ${i + 1}`} disabled={draft.beats.length === 1} onClick={() => remove(i)} icon={<Trash2 className="h-4 w-4" />} />
              </div>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr]">
              <label className="block text-xs text-ink-400">
                Small label
                <input className={cn(inputCls, 'mt-1')} value={b.card.eyebrow} onChange={(e) => updateCard(i, { eyebrow: e.target.value })} />
              </label>
              <label className="block text-xs text-ink-400">
                Step
                <select className={cn(inputCls, 'mt-1')} value={b.chapter} onChange={(e) => update(i, { chapter: Number(e.target.value) })}>
                  <option value={0}>Intro</option>
                  {draft.steps.map((s, j) => (
                    <option key={j} value={j + 1}>
                      {j + 1}. {s}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="mt-3 block text-xs text-ink-400">
              Headline on the card (wrap words in *stars* to highlight them)
              <input className={cn(inputCls, 'mt-1 font-semibold')} value={b.card.headline} onChange={(e) => updateCard(i, { headline: e.target.value })} />
            </label>
            <label className="mt-3 block text-xs text-ink-400">
              Narration (what the voice says)
              <textarea className={cn(inputCls, 'mt-1 min-h-[64px]')} value={b.narration} onChange={(e) => update(i, { narration: e.target.value })} />
            </label>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-400">
              Colour
              {TONES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  aria-label={`${t.label} for scene ${i + 1}`}
                  aria-pressed={b.card.tone === t.id}
                  onClick={() => updateCard(i, { tone: t.id })}
                  className={cn('h-6 w-6 rounded-full border-2', t.swatch, b.card.tone === t.id ? 'border-ink-100' : 'border-transparent')}
                />
              ))}
            </div>
            {reelWorld(draft) === 'iso' && (
              <SceneEditor
                beat={b}
                index={i}
                known={knownProps(draft, i)}
                previous={draft.beats[i - 1]?.scene}
                onChange={(scene) => update(i, (x) => ({ ...x, scene }))}
              />
            )}
          </Card>
        ))}
      </div>

      <div className="xl:sticky xl:top-6 xl:self-start">
        <h3 className="mb-3 text-sm font-semibold text-ink-400">Preview {dirty && <span className="text-amber-600">(unsaved changes)</span>}</h3>
        {spec && (
          <Suspense fallback={<Spinner label="Loading the reel engine" />}>
            <ReelPreview spec={spec} />
          </Suspense>
        )}
      </div>
    </div>
  );
});

/** Objects the other scenes use, once each, so a scene can reuse one and the camera stays in one world. */
function knownProps(script: ReelScript, except: number) {
  const seen = new Map<string, NonNullable<ReelBeat['scene']>['props'][number]>();
  script.beats.forEach((b, j) => {
    if (j !== except) for (const p of b.scene?.props ?? []) if (!seen.has(p.id)) seen.set(p.id, p);
  });
  return [...seen.values()];
}

function IconButton({ label, icon, onClick, disabled }: { label: string; icon: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className="rounded-lg p-1.5 text-ink-400 hover:bg-line/[0.06] hover:text-ink-100 disabled:opacity-30">
      {icon}
    </button>
  );
}
