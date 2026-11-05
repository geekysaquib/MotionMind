import { useMemo, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Link } from 'react-router-dom';
import { ArrowRight, Search } from 'lucide-react';
import type { ProjectStatus } from '@motionmind/shared';
import { useStores } from '../../stores/RootStore';
import { PageHeader } from '../../layout/AppShell';
import { Spinner } from '../../components/ui';
import { StageBadge, StatusBadge } from './ProjectBadges';
import { PlatformIcons } from '../../components/BrandIcons';
import { timeAgo } from '../../lib/format';
import { cn } from '../../lib/cn';
import { ProgressRing, Reveal } from '../../components/motion';
import { ProjectCover } from '../../components/ProjectCover';
import { nextStage, progressOf } from '../../lib/progress';

/** A stable pair of hues per project, so every cover looks different but never changes. */
function hues(id: string): [number, number] {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return [250 + (h % 70), 190 + ((h * 7) % 120)]; // violet to sky to pink, so covers fit the palette
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
        <div className="flex rounded-lg bg-ink-700/70 p-1 text-sm">
          {FILTERS.map((f) => (
            <button key={f.id} onClick={() => setFilter(f.id)} aria-pressed={filter === f.id} className={cn('rounded-md px-3 py-1.5 font-medium transition', filter === f.id ? 'bg-ink-900 text-ink-100 shadow-sm' : 'text-ink-400 hover:text-ink-100')}>
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
        <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((p, i) => {
            const [h1] = hues(p.id);
            return (
              <Reveal key={p.id} delay={(i % 3) * 70}>
                <Link to={`/app/projects/${p.id}`} className="card card-hover group block overflow-hidden">
                  <ProjectCover project={p} tint={`hsl(${h1} 70% 92%)`}>
                    <div className="absolute inset-x-3 top-3 flex items-start justify-between">
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-white/90 px-2 py-0.5 text-xs font-semibold text-ink-100 shadow-sm">
                        {p.durationSec}s <PlatformIcons list={p.platforms} />
                      </span>
                      <ProgressRing value={progressOf(p)} size={40} stroke={5} className="rounded-full bg-white/90 text-ink-100 shadow-sm">
                        <span className="text-[9px]">{Math.round(progressOf(p) * 100)}%</span>
                      </ProgressRing>
                    </div>
                  </ProjectCover>
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
