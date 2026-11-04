import { observer } from 'mobx-react-lite';
import { Link, NavLink, Outlet, useLocation, useParams } from 'react-router-dom';
import { Check, ChevronLeft, Lightbulb } from 'lucide-react';
import { useStores } from '../../stores/RootStore';
import { Spinner } from '../../components/ui';
import { ProgressRing } from '../../components/motion';
import { StatusBadge } from './ProjectBadges';
import { progressOf, stageDone, STAGE_INFO } from '../../lib/progress';
import { cn } from '../../lib/cn';

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
  const fill = Math.max(0, Math.min(1, current / (STAGE_INFO.length - 1)));

  return (
    <div className="mx-auto max-w-6xl p-6 md:p-10">
      <Link to="/app/library" className="inline-flex items-center gap-1 text-sm text-ink-400 transition hover:-translate-x-0.5 hover:text-ink-100">
        <ChevronLeft className="h-4 w-4" /> Library
      </Link>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <ProgressRing value={progress} size={52}>
          {Math.round(progress * 100)}%
        </ProgressRing>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-3xl font-bold tracking-tight">{p.title}</h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-ink-400">
            <StatusBadge status={p.status} />
            <span>
              {done.filter(Boolean).length} of {STAGE_INFO.length} steps done
            </span>
          </div>
        </div>
      </div>

      <nav className="relative mt-8 overflow-x-auto pb-2" aria-label="Project stages">
        <ol className="relative flex min-w-[720px] justify-between">
          <span className="absolute left-5 right-5 top-5 h-0.5 bg-line/10" aria-hidden />
          <span className="absolute left-5 top-5 h-0.5 bg-gradient-to-r from-mint-400 to-violet-500 transition-[width] duration-700 ease-out" style={{ width: `calc((100% - 2.5rem) * ${fill})` }} aria-hidden />
          {STAGE_INFO.map((t, i) => (
            <li key={t.path} className="relative z-10">
              <NavLink to={t.path ? `/app/projects/${p.id}/${t.path}` : `/app/projects/${p.id}`} end className="group flex w-20 flex-col items-center gap-1.5 text-center">
                <span
                  className={cn(
                    'relative flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-bold transition duration-300 group-hover:scale-110',
                    i === current
                      ? 'border-mint-400 bg-mint-600 text-white shadow-glow'
                      : done[i]
                        ? 'border-mint-400/60 bg-mint-400/15 text-accent'
                        : 'border-line/15 bg-ink-900 text-ink-400',
                  )}
                >
                  {i === current && <span className="absolute inset-0 animate-ping-soft rounded-full bg-mint-400/40" aria-hidden />}
                  {done[i] && i !== current ? <Check className="h-4 w-4 animate-pop" /> : i + 1}
                </span>
                <span className={cn('text-xs font-medium transition', i === current ? 'text-ink-100' : 'text-ink-400 group-hover:text-ink-100')}>{t.label}</span>
              </NavLink>
            </li>
          ))}
        </ol>
      </nav>

      <div key={info.path} className="mt-6 flex animate-fade-up flex-wrap items-start justify-between gap-4 rounded-2xl border border-line/[0.07] bg-gradient-to-r from-mint-400/[0.08] via-transparent to-violet-500/[0.08] p-5">
        <div className="min-w-[240px] flex-1">
          <div className="text-xs font-semibold uppercase tracking-wider text-accent">
            Step {current + 1} of {STAGE_INFO.length}
          </div>
          <h2 className="mt-1 font-display text-xl font-bold">{info.title}</h2>
          <p className="mt-1 max-w-2xl text-sm text-ink-400">{info.why}</p>
        </div>
        <p className="flex max-w-xs items-start gap-2 rounded-xl bg-ink-900/70 p-3 text-xs text-ink-300">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" /> {info.tip}
        </p>
      </div>

      <div key={pathname} className="mt-8 animate-fade-up">
        <Outlet context={p} />
      </div>
    </div>
  );
});
