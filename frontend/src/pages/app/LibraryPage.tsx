import { useMemo, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Link } from 'react-router-dom';
import { ArrowRight, Search } from 'lucide-react';
import type { ProjectStatus } from '@motionmind/shared';
import { useStores } from '../../stores/RootStore';
import { PageHeader } from '../../layout/AppShell';
import { Spinner } from '../../components/ui';
import { StatusBadge } from './ProjectBadges';
import { PlatformIcons } from '../../components/BrandIcons';
import { timeAgo } from '../../lib/format';
import { cn } from '../../lib/cn';
import { ProgressRing } from '../../components/motion';
import { ProjectThumb } from '../../components/ProjectThumb';
import { nextStage, progressOf } from '../../lib/progress';

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
    <div className="page">
      <PageHeader eyebrow="Library" title="Your reels" subtitle="Every reel you've started, saved as you go. The cover you make on the Export step becomes its thumbnail." />
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
        <ul className="stagger grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-7">
          {list.map((p) => {
            const pr = progressOf(p);
            return (
              <li key={p.id}>
                <Link to={`/app/projects/${p.id}`} className="card card-hover group block overflow-hidden">
                  <div className="relative aspect-[4/5] overflow-hidden bg-ink-800">
                    <ProjectThumb project={p} className="transition duration-500 group-hover:scale-[1.04]" />
                    <div className="absolute inset-x-2 top-2 flex items-start justify-between">
                      <span className="inline-flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        {p.durationSec}s <PlatformIcons list={p.platforms} />
                      </span>
                      <ProgressRing value={pr} size={30} stroke={4} className="rounded-full bg-black/60 text-white">
                        <span className="text-[8px] font-semibold">{Math.round(pr * 100)}</span>
                      </ProgressRing>
                    </div>
                  </div>
                  <div className="space-y-1.5 p-3">
                    <div className="truncate text-sm font-semibold transition group-hover:text-accent" title={p.title}>{p.title}</div>
                    <div className="flex items-center gap-1 text-[11px] text-ink-400">
                      Next: {nextStage(p).label} <ArrowRight className="h-3 w-3 transition group-hover:translate-x-0.5" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <StatusBadge status={p.status} />
                      <span className="ml-auto text-[11px] text-ink-400">{timeAgo(p.updatedAt)}</span>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
});
