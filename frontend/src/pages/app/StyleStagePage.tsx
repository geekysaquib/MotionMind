import { Check, Palette, Sparkles } from 'lucide-react';
import { lazy, Suspense, useMemo, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Link, useOutletContext } from 'react-router-dom';
import { DEFAULT_STYLE, STYLE_IDS, STYLES, suggestStyles, type Project, type StyleId } from '@motionmind/shared';
import { useStores } from '../../stores/RootStore';
import { EmptyState } from '../../components/EmptyState';
import { Alert, Badge, Card, Spinner } from '../../components/ui';
import { errorText } from '../../lib/format';
import { log } from '../../lib/logger';
import { cn } from '../../lib/cn';
import { brandFor, specFromScript } from '../../components/reelSpec';

const ReelPreview = lazy(() => import('../../components/ReelPreview'));
const StyleThumb = lazy(() => import('../../components/StyleThumb'));

/**
 * Style stage: the look the whole reel is drawn in. Each card shows this reel's own scene in that style,
 * the best fit for the topic is marked, and styles used by the channel's last reels are pushed down.
 */
export const StyleStagePage = observer(function StyleStagePage() {
  const project = useOutletContext<Project>();
  const { profile, projects, services, auth } = useStores();
  const [busy, setBusy] = useState<StyleId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const script = project.script;
  const current = script?.style ?? null;
  const recent = useMemo(
    () => projects.items.filter((p) => p.id !== project.id && p.script?.style).slice(0, 3).map((p) => p.script!.style!),
    [projects.items, project.id],
  );
  const order = useMemo(() => (script ? suggestStyles(script, recent) : [...STYLE_IDS]), [script, recent]);
  const shown = current ?? order[0] ?? DEFAULT_STYLE;
  const brand = brandFor(profile.profile);
  const spec = useMemo(() => (script ? specFromScript(script, brand, undefined, undefined, undefined, shown) : null), [script, brand, shown]);

  if (!script || !spec) {
    return <EmptyState icon={<Palette className="h-6 w-6" />} title="No script yet" text="Styles draw your own script, so write it first." to={`/app/projects/${project.id}/script`} action="Go to Script" />;
  }

  async function pick(id: StyleId) {
    setBusy(id);
    setError(null);
    try {
      projects.upsert(await services.claude(() => auth.session?.accessToken ?? null).saveStyle(project.id, id));
      log.info('style', 'Style picked', { projectId: project.id, style: id });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-4">
        <Card>
          <h2 className="flex items-center gap-2 font-semibold">
            <Palette className="h-4 w-4 text-accent" /> Pick a style
          </h2>
          <p className="mt-1 text-sm text-ink-400">
            The style draws every scene: the headline, the scene picture (steps, numbers, items, notes), the captions and the end card. Each card below is your own reel. To change what a scene shows, edit its picture in the{' '}
            <Link to={`/app/projects/${project.id}/storyboard`} className="text-accent hover:underline">
              Storyboard
            </Link>
            .
          </p>
          {!current && <p className="mt-2 text-sm text-ink-400">Nothing picked yet: the preview shows the best fit for this topic.</p>}
          {error && <div className="mt-3"><Alert>{error}</Alert></div>}
        </Card>
        <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
          {order.map((id, rank) => {
            const st = STYLES[id];
            const selected = current === id;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={selected}
                aria-label={`Use the ${st.name} style`}
                disabled={busy !== null}
                onClick={() => void pick(id)}
                className={cn('group overflow-hidden rounded-2xl border bg-white text-left transition hover:shadow-soft disabled:opacity-70 dark:bg-ink-900', selected ? 'border-accent ring-2 ring-accent/40' : 'border-line/10')}
              >
                <div className="relative bg-ink-800">
                  <Suspense fallback={<div className="flex aspect-[9/16] items-center justify-center"><Spinner label="" /></div>}>
                    <StyleThumb spec={{ ...spec, style: id }} />
                  </Suspense>
                  <div className="absolute left-3 top-3 flex gap-2">
                    {rank === 0 && !recent.includes(id) && (
                      <Badge tone="mint">
                        <Sparkles className="mr-1 inline h-3 w-3" /> Best fit
                      </Badge>
                    )}
                    {recent.includes(id) && <Badge>Used recently</Badge>}
                  </div>
                  {selected && (
                    <div className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-accent text-white">
                      <Check className="h-5 w-5" />
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded-full border border-line/20" style={{ background: st.swatch[0] }} />
                    <span className="h-4 w-4 rounded-full" style={{ background: st.swatch[1] }} />
                    <span className="font-semibold">{st.name}</span>
                    {busy === id && <Spinner label="" />}
                  </div>
                  <p className="mt-1 text-sm font-medium text-ink-300">{st.tagline}</p>
                  <p className="mt-2 text-xs text-ink-400">{st.description}</p>
                  <p className="mt-2 text-xs text-ink-400">
                    <span className="font-semibold">Best for:</span> {st.bestFor}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-ink-400">Whiteboard, Dark Keynote, Transit Map and Newsroom are written from style rulebooks in lemo-opuscar by LemoLab (MIT licence). Live Map is Motion Mind's own.</p>
      </div>
      <div className="xl:sticky xl:top-6 xl:self-start">
        <h3 className="mb-3 text-sm font-semibold text-ink-400">
          {STYLES[shown].name} {current ? '' : <span className="text-amber-600">(not picked yet)</span>}
        </h3>
        <Suspense fallback={<Spinner label="Loading the reel engine" />}>
          <ReelPreview spec={spec} />
        </Suspense>
      </div>
    </div>
  );
});
