import { observer } from 'mobx-react-lite';
import { Link, NavLink, Outlet, useLocation, useParams } from 'react-router-dom';
import { ArrowRight, Check, Palette, Wand2, Clapperboard, FileText, LayoutGrid, Lightbulb, Mic, PenLine, Scissors, Search, type LucideIcon } from 'lucide-react';
import { useStores } from '../../stores/RootStore';
import { Spinner } from '../../components/ui';
import { ProgressRing } from '../../components/motion';
import { StatusBadge } from './ProjectBadges';
import { nextStage, progressOf, stageDone, STAGE_INFO } from '../../lib/progress';
import { cn } from '../../lib/cn';

/** A small icon for each step. */
export const STAGE_ICONS: Record<string, LucideIcon> = { '': PenLine, research: Search, script: FileText, storyboard: LayoutGrid, graphics: Palette, animate: Wand2, voice: Mic, editor: Scissors, export: Clapperboard };

export const PROJECT_TABS = STAGE_INFO.map(({ path, label }) => ({ path, label }));

export const ProjectLayout = observer(function ProjectLayout() {
  const { id = '' } = useParams();
  const { projects } = useStores();
  const { pathname } = useLocation();
  const p = projects.byId(id);
  if (!projects.loaded) return <div className="p-10"><Spinner /></div>;
  if (!p)
    return (
      <div className="p-10 text-sm text-ink-400">
        This project doesn't exist or isn't yours. <Link to="/app/library" className="text-accent hover:underline">Back to the library</Link>
      </div>
    );

  const done = stageDone(p);
  const progress = progressOf(p);
  const current = Math.max(0, STAGE_INFO.findIndex((s) => (s.path ? pathname.endsWith(`/${s.path}`) : pathname.replace(/\/$/, '').endsWith(p.id))));
  const info = STAGE_INFO[current]!;
  const next = nextStage(p);
  const doneCount = done.filter(Boolean).length;
  const href = (path: string) => (path ? `/app/projects/${p.id}/${path}` : `/app/projects/${p.id}`);

  return (
    <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-5 p-4 md:p-6 lg:grid-cols-[216px_minmax(0,1fr)]">
      <aside className="min-w-0 lg:sticky lg:top-6 lg:self-start">
        <div className="card p-4">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="line-clamp-3 font-display text-base font-bold leading-snug">{p.title}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StatusBadge status={p.status} />
                <span className="text-xs text-ink-400">
                  Step {current + 1} of {STAGE_INFO.length}
                </span>
              </div>
            </div>
            <ProgressRing value={progress} size={44} stroke={5}>
              <span className="text-[10px]">{Math.round(progress * 100)}%</span>
            </ProgressRing>
          </div>

          <ol className="-mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1 pb-1 lg:mx-0 lg:mt-4 lg:block lg:space-y-0.5 lg:overflow-visible lg:px-0 lg:pb-0" aria-label="Project steps">
            {STAGE_INFO.map((t, i) => {
              const isCurrent = i === current;
              const StepIcon = STAGE_ICONS[t.path] ?? PenLine;
              return (
                <li key={t.path} ref={isCurrent ? (el) => el?.scrollIntoView?.({ inline: 'center', block: 'nearest' }) : undefined} className="relative shrink-0 lg:shrink">
                  {i < STAGE_INFO.length - 1 && <span className="absolute left-[19px] top-9 hidden h-[calc(100%-1.5rem)] w-px bg-line/10 lg:block" aria-hidden>
                      <span className={cn('block h-full w-full origin-top bg-mint-500/60 transition-transform duration-700 ease-out', done[i] ? 'scale-y-100' : 'scale-y-0')} />
                    </span>}
                  <NavLink
                    to={href(t.path)}
                    end
                    aria-current={isCurrent ? 'step' : undefined}
                    className={cn('group relative flex items-center gap-2 rounded-full border px-2.5 py-1.5 transition lg:gap-3 lg:rounded-lg lg:border-0 lg:px-2 lg:py-2', isCurrent ? 'border-mint-500/40 bg-mint-500/[0.08]' : 'border-line/[0.12] hover:bg-ink-800')}
                  >
                    <span
                      className={cn(
                        'relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-bold transition',
                        isCurrent ? 'border-mint-600 bg-ink-900 text-accent' : done[i] ? 'border-mint-600 bg-mint-600 text-white' : 'border-line/20 bg-ink-900 text-ink-400',
                      )}
                    >
                      {isCurrent && <span className="absolute inset-[-5px] animate-ping-soft rounded-full border border-mint-500/50" aria-hidden />}
                      {done[i] && !isCurrent ? <Check className="h-3.5 w-3.5 animate-pop" strokeWidth={3} /> : isCurrent ? <span className="h-2 w-2 rounded-full bg-mint-600" /> : i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn('flex items-center gap-1.5 truncate text-sm', isCurrent ? 'font-semibold' : done[i] ? 'text-ink-100' : 'text-ink-300')}>
                        <StepIcon className={cn('h-3.5 w-3.5 shrink-0 transition group-hover:scale-110', isCurrent ? 'text-accent' : 'text-ink-400')} aria-hidden />
                        {t.label}
                      </span>
                      {isCurrent && <span className="hidden truncate text-xs text-ink-400 lg:block">{t.title}</span>}
                    </span>
                  </NavLink>
                </li>
              );
            })}
          </ol>

          <div className="mt-3 flex flex-col gap-1 border-t border-line/[0.08] pt-3 text-xs text-ink-400 lg:mt-4">
            <span>
              {doneCount} of {STAGE_INFO.length} steps done
            </span>
            <Link to={href(next.path)} className="inline-flex items-center gap-1 font-semibold text-accent hover:underline">
              Next: {next.label} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <div key={info.path} className="mb-5 flex animate-fade-up flex-wrap items-start justify-between gap-4 rounded-xl border border-line/[0.09] bg-ink-900 p-5 shadow-soft">
          <div className="flex min-w-[240px] flex-1 items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 animate-pop items-center justify-center rounded-xl bg-mint-600 text-white shadow-glow">
              {(() => {
                const HeroIcon = STAGE_ICONS[info.path] ?? PenLine;
                return <HeroIcon className="h-5 w-5" aria-hidden />;
              })()}
            </span>
            <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-accent">{info.label}</div>
            <h2 className="mt-1 font-display text-xl font-bold">{info.title}</h2>
            <p className="mt-1 max-w-2xl text-sm text-ink-400">{info.why}</p>
            </div>
          </div>
          <p className="flex max-w-xs items-start gap-2 rounded-lg bg-ink-800 p-3 text-xs text-ink-300">
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" /> {info.tip}
          </p>
        </div>
        <div key={pathname} className="animate-fade-up">
          <Outlet context={p} />
        </div>
      </div>
    </div>
  );
});
