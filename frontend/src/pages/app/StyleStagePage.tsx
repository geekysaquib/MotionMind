import { ArrowRight, Check, Palette, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Link, useOutletContext } from 'react-router-dom';
import { STYLES, suggestStyles, type Project, type StyleId } from '@motionmind/shared';
import { useStores } from '../../stores/RootStore';
import { Alert, Badge, Card, Spinner } from '../../components/ui';
import { errorText } from '../../lib/format';
import { log } from '../../lib/logger';
import { cn } from '../../lib/cn';
import { pickedStyle, rememberStyle } from '../../lib/pickedStyle';

/**
 * Style stage: which rulebook Claude follows when it animates the reel. Nothing is drawn by Motion Mind itself:
 * the style only tells Claude the look, colours, type, motion and native moves to design with.
 * The best fit for the topic is marked, and styles used by the channel's last reels go last.
 */
export const StyleStagePage = observer(function StyleStagePage() {
  const project = useOutletContext<Project>();
  const { projects, services, auth } = useStores();
  const [busy, setBusy] = useState<StyleId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const script = project.script;
  const [local, setLocal] = useState(() => pickedStyle(project));
  const current = script?.style ?? local;
  const recent = useMemo(
    () => projects.items.filter((p) => p.id !== project.id && p.script?.style).slice(0, 3).map((p) => p.script!.style!),
    [projects.items, project.id],
  );
  const order = useMemo(() => suggestStyles(script ?? { title: project.topic ?? project.title, beats: [] }, recent), [script, recent, project.topic, project.title]);

  async function pick(id: StyleId) {
    setBusy(id);
    setError(null);
    try {
      rememberStyle(project.id, id);
      setLocal(id);
      if (script) projects.upsert(await services.claude(() => auth.session?.accessToken ?? null).saveStyle(project.id, id));
      log.info('style', 'Style picked', { projectId: project.id, style: id });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="flex items-center gap-2 font-semibold">
          <Palette className="h-4 w-4 text-accent" /> Pick a style
        </h2>
        <p className="mt-1 text-sm text-ink-400">
          The style is the rulebook Claude animates your reel with: its look, colours, type, motion and signature moves. Claude designs every scene for your topic in that style; there are no templates.
        </p>
        {current && (
          <div className="mt-3">
            <Link to={`/app/projects/${project.id}/${script ? 'animate' : 'script'}`} className="inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline">
              {script ? 'Animate it in this style' : 'Next: write the script'} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
        {error && <div className="mt-3"><Alert>{error}</Alert></div>}
      </Card>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
              className={cn('group overflow-hidden rounded-2xl border bg-ink-900 text-left transition hover:shadow-soft disabled:opacity-70', selected ? 'border-accent ring-2 ring-accent/40' : 'border-line/10')}
            >
              <div className="relative flex h-36 items-end p-4" style={{ background: st.swatch[0] }}>
                <div className="absolute right-4 top-4 h-10 w-10 rounded-full" style={{ background: st.swatch[1] }} />
                <span className="text-2xl font-black tracking-tight" style={{ color: st.swatch[1] === '#FFD60A' || st.swatch[0].startsWith('#F') ? '#0B0B0C' : '#F2F4F8' }}>
                  {st.name}
                </span>
                <div className="absolute left-3 top-3 flex gap-2">
                  {rank === 0 && !recent.includes(id) && (
                    <Badge tone="mint">
                      <Sparkles className="mr-1 inline h-3 w-3" /> Best fit
                    </Badge>
                  )}
                  {recent.includes(id) && <Badge>Used recently</Badge>}
                </div>
                {selected && (
                  <div className="absolute bottom-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-accent text-white">
                    <Check className="h-5 w-5" />
                  </div>
                )}
              </div>
              <div className="p-4">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{st.tagline}</span>
                  {busy === id && <Spinner label="" />}
                </div>
                <p className="mt-2 text-xs text-ink-400">{st.description}</p>
                <p className="mt-2 text-xs text-ink-400">
                  <span className="font-semibold">Best for:</span> {st.bestFor}
                </p>
              </div>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-ink-400">Whiteboard, Dark Keynote, Transit Map and Newsroom use style rulebooks from lemo-opuscar by LemoLab (MIT licence). Live Map is Motion Mind's own.</p>
    </div>
  );
});
