import { useMemo, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Link } from 'react-router-dom';
import { ArrowRight, Search } from 'lucide-react';
import type { ProjectStatus } from '@motionmind/shared';
import { useStores } from '../../stores/RootStore';
import { PageHeader } from '../../layout/AppShell';
import { Spinner } from '../../components/ui';
import { StageBadge, StatusBadge } from './ProjectBadges';
import { timeAgo } from '../../lib/format';
import { cn } from '../../lib/cn';
import { ProgressRing, Reveal } from '../../components/motion';
import { nextStage, progressOf } from '../../lib/progress';

/** A stable pair of hues per project, so every cover looks different but never changes. */
function hues(id: string): [number, number] {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return [h % 360, (h * 7 + 140) % 360];
}

const FILTERS: { id: 'all' | ProjectStatus; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'draft', label: 'Drafts' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'completed', label: 'Completed' },
  { id: 'archived', label: 'Archived' },
];

export const LibraryPage = observer(function LibraryPage() {
  const { projects } = useStores();
  const [filter, setFilter] = useState<'all' | ProjectStatus>('all');
  const [q, setQ] = useState('');
  const list = useMemo(
    () =>
      projects.items.filter(
        (p) => (filter === 'all' ? p.status !== 'archived' : p.status === filter) && (!q || `${p.title} ${p.topic ?? ''}`.toLowerCase().includes(q.toLowerCase())),
      ),
    [projects.items, filter, q],
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 md:p-10">
      <PageHeader title="Project library" subtitle="Every reel you've started, saved automatically." />
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-xl border border-line/10 bg-ink-900 p-1 text-sm">
          {FILTERS.map((f) => (
            <button key={f.id} onClick={() => setFilter(f.id)} aria-pressed={filter === f.id} className={cn('rounded-lg px-3 py-1.5 font-medium', filter === f.id ? 'bg-line/10 text-ink-100' : 'text-ink-400 hover:text-ink-100')}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative ml-auto w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input aria-label="Search projects" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search projects" className="field pl-9" />
        </div>
      </div>
      {!projects.loaded ? (
        <Spinner />
      ) : list.length === 0 ? (
        <p className="card p-10 text-center text-sm text-ink-400">{projects.items.length ? 'Nothing matches this filter.' : 'No projects yet. Use "New reel" to start one.'}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((p, i) => {
            const [h1, h2] = hues(p.id);
            return (
              <Reveal key={p.id} delay={(i % 3) * 70}>
                <Link to={`/app/projects/${p.id}`} className="card card-hover group block overflow-hidden">
                  <div
                    className="relative flex aspect-[16/9] items-end justify-between overflow-hidden p-4"
                    style={{ backgroundImage: `radial-gradient(circle at 25% 20%, hsl(${h1} 80% 70% / .55), transparent 60%), radial-gradient(circle at 85% 85%, hsl(${h2} 75% 65% / .5), transparent 60%)` }}
                  >
                    <div className="absolute -right-6 -top-6 h-28 w-28 rotate-12 rounded-3xl border border-white/30 bg-white/20 transition duration-500 group-hover:rotate-[24deg] group-hover:scale-110" aria-hidden />
                    <span className="relative rounded-md bg-white/85 px-2 py-0.5 text-xs font-semibold text-ink-100">{p.durationSec}s · {p.qualityTier}</span>
                    <ProgressRing value={progressOf(p)} size={40} stroke={5} className="relative rounded-full bg-white/85 text-ink-100">
                      <span className="text-[9px]">{Math.round(progressOf(p) * 100)}%</span>
                    </ProgressRing>
                  </div>
                  <div className="p-4">
                    <div className="line-clamp-2 font-medium transition group-hover:text-accent">{p.title}</div>
                    <div className="mt-1 flex items-center gap-1 text-xs text-ink-400">
                      Next: {nextStage(p).label} <ArrowRight className="h-3 w-3 transition group-hover:translate-x-1" />
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <StageBadge stage={p.stage} />
                      <StatusBadge status={p.status} />
                      <span className="ml-auto text-xs text-ink-400">{timeAgo(p.updatedAt)}</span>
                    </div>
                  </div>
                </Link>
              </Reveal>
            );
          })}
        </div>
      )}
    </div>
  );
});
