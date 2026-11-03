import { observer } from 'mobx-react-lite';
import { NavLink, Outlet, useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useStores } from '../../stores/RootStore';
import { Spinner } from '../../components/ui';
import { StatusBadge } from './ProjectBadges';
import { cn } from '../../lib/cn';

export const PROJECT_TABS = [
  { path: '', label: 'Topic' },
  { path: 'research', label: 'Research' },
  { path: 'script', label: 'Script' },
  { path: 'storyboard', label: 'Storyboard' },
  { path: 'graphics', label: 'Graphics' },
  { path: 'voice', label: 'Voice' },
  { path: 'editor', label: 'Reel editor' },
  { path: 'export', label: 'Export' },
] as const;

export const ProjectLayout = observer(function ProjectLayout() {
  const { id = '' } = useParams();
  const { projects } = useStores();
  const p = projects.byId(id);
  if (!projects.loaded) return <div className="p-10"><Spinner /></div>;
  if (!p)
    return (
      <div className="p-10 text-sm text-ink-400">
        This project doesn't exist or isn't yours. <Link to="/app/library" className="text-accent hover:underline">Back to the library</Link>
      </div>
    );
  return (
    <div className="mx-auto max-w-6xl p-6 md:p-10">
      <Link to="/app/library" className="inline-flex items-center gap-1 text-sm text-ink-400 hover:text-ink-100">
        <ChevronLeft className="h-4 w-4" /> Library
      </Link>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-bold tracking-tight">{p.title}</h1>
        <StatusBadge status={p.status} />
      </div>
      <nav className="mt-6 flex gap-1 overflow-x-auto border-b border-line/[0.06]" aria-label="Project stages">
        {PROJECT_TABS.map((t, i) => (
          <NavLink
            key={t.path}
            to={t.path ? `/app/projects/${p.id}/${t.path}` : `/app/projects/${p.id}`}
            end
            className={({ isActive }) =>
              cn('flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition', isActive ? 'border-mint-400 text-ink-100' : 'border-transparent text-ink-400 hover:text-ink-100')
            }
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-line/[0.06] text-[10px]">{i + 1}</span>
            {t.label}
          </NavLink>
        ))}
      </nav>
      <div className="mt-8">
        <Outlet context={p} />
      </div>
    </div>
  );
});
