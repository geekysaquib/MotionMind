import { observer } from 'mobx-react-lite';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ChevronRight, Compass, FolderClosed, FolderOpen, BarChart3, LayoutDashboard, LogOut, Plus, Scissors, Settings } from 'lucide-react';
import { useStores } from '../stores/RootStore';
import { Logo } from '../components/Logo';
import { DemoBanner } from '../components/DemoBanner';
import { ProgressRing, useParallax } from '../components/motion';
import { ChannelAvatar } from '../components/ChannelAvatar';
import { progressOf, STAGE_INFO } from '../lib/progress';
import { cn } from '../lib/cn';

const NAV = [
  { to: '/app', label: 'Home', icon: LayoutDashboard, end: true },
  { to: '/app/library', label: 'Projects', icon: FolderOpen },
  { to: '/app/discover', label: 'Discover', icon: Compass },
  { to: '/app/footage', label: 'Raw footage', icon: Scissors },
  { to: '/app/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/app/settings', label: 'Settings', icon: Settings },
];

const SETTINGS_TABS: Record<string, string> = { connections: 'Connections', account: 'Account', diagnostics: 'Diagnostics' };

/** Where you are, as a short trail for the top bar: Projects / <reel> / <step>. */
function useCrumbs(): { label: string; to?: string }[] {
  const { pathname } = useLocation();
  const { projects } = useStores();
  const parts = pathname.replace(/^\/app\/?/, '').split('/').filter(Boolean);
  if (parts.length === 0) return [{ label: 'Home' }];
  if (parts[0] === 'library') return [{ label: 'Projects' }];
  if (parts[0] === 'discover') return [{ label: 'Discover' }];
  if (parts[0] === 'analytics') return [{ label: 'Analytics' }];
  if (parts[0] === 'footage') return parts[1] ? [{ label: 'Raw footage', to: '/app/footage' }, { label: 'Edit' }] : [{ label: 'Raw footage' }];
  if (parts[0] === 'settings') return [{ label: 'Settings', to: '/app/settings' }, { label: parts[1] ? (SETTINGS_TABS[parts[1]] ?? parts[1]) : 'Profile & handle' }];
  if (parts[0] === 'projects' && parts[1]) {
    const p = projects.byId(parts[1]);
    const stage = STAGE_INFO.find((s) => s.path === (parts[2] ?? ''));
    return [{ label: 'Projects', to: '/app/library' }, { label: p?.title ?? 'Project', to: `/app/projects/${parts[1]}` }, ...(stage ? [{ label: stage.label }] : [])];
  }
  return [{ label: 'Home' }];
}

export const AppShell = observer(function AppShell() {
  const { profile, auth, projects } = useStores();
  const nav = useNavigate();
  const crumbs = useCrumbs();
  const { pathname } = useLocation();
  const p = profile.profile;
  const total = projects.stats.total;

  return (
    <div className="flex h-full flex-col bg-ink-950">
      <DemoBanner />
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-60 shrink-0 flex-col border-r border-line/[0.07] bg-ink-950 p-3 md:flex">
          <div className="flex items-center justify-between px-2 py-2">
            <Link to="/app" aria-label="Home">
              <Logo size="sm" animated />
            </Link>
          </div>

          <div className="mt-3 flex gap-2">
            <button
              onClick={() => nav('/app?new=1')}
              className="group flex h-10 flex-1 items-center gap-2 rounded-xl bg-brand px-3.5 text-sm font-semibold text-white shadow-glow transition hover:brightness-110"
            >
              <Plus className="h-4 w-4 transition group-hover:rotate-90" /> New reel
            </button>
          </div>

          <nav className="mt-4 flex flex-col gap-0.5" aria-label="Main">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn('icon-hover flex h-10 items-center gap-2.5 rounded-xl px-3 text-sm font-medium transition', isActive ? 'bg-mint-500/15 text-ink-100 ring-1 ring-mint-500/25' : 'text-ink-300 hover:bg-line/[0.06] hover:text-ink-100')
                }
              >
                <Icon className="h-4 w-4 shrink-0 opacity-80" />
                <span className="flex-1">{label}</span>
                {label === 'Projects' && total > 0 && <span className="text-xs font-semibold text-ink-400">{total}</span>}
              </NavLink>
            ))}
          </nav>

          <div className="mt-5 min-h-0 flex-1 overflow-y-auto">
            <div className="px-2.5 text-[11px] font-semibold uppercase tracking-wider text-ink-400">Recent</div>
            <ul className="mt-1.5 space-y-0.5">
              {projects.recent.length === 0 && <li className="px-2.5 py-2 text-xs text-ink-400">Your reels show up here.</li>}
              {projects.recent.map((r) => (
                <li key={r.id}>
                  <NavLink
                    to={`/app/projects/${r.id}`}
                    className={({ isActive }) =>
                      cn('flex h-9 items-center gap-2.5 rounded-xl px-3 text-sm transition', isActive ? 'bg-line/[0.08] font-medium text-ink-100' : 'text-ink-300 hover:bg-line/[0.06] hover:text-ink-100')
                    }
                  >
                    <FolderClosed className="h-4 w-4 shrink-0 text-ink-400" />
                    <span className="min-w-0 flex-1 truncate">{r.title}</span>
                    <ProgressRing value={progressOf(r)} size={16} stroke={3} />
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-3 flex items-center gap-2.5 border-t border-line/[0.08] px-1 pt-3">
            <ChannelAvatar size={34} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold leading-tight">{p?.channelName || p?.displayName || 'Creator'}</div>
              <div className="truncate text-xs text-ink-400">{p?.handle ? `@${p.handle}` : auth.session?.email}</div>
            </div>
            <button onClick={() => void auth.signOut()} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-800 hover:text-ink-100" aria-label="Sign out" title="Sign out">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line/[0.07] bg-ink-950 px-4 md:px-6">
            <div className="md:hidden">
              <Logo size="sm" />
            </div>
            <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1.5 text-sm md:flex">
              {crumbs.map((c, i) => (
                <span key={`${c.label}-${i}`} className="flex min-w-0 items-center gap-1.5">
                  {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-600" />}
                  {c.to && i < crumbs.length - 1 ? (
                    <Link to={c.to} className="max-w-[16rem] truncate text-ink-400 hover:text-ink-100">
                      {c.label}
                    </Link>
                  ) : (
                    <span className={cn('max-w-[22rem] truncate', i === crumbs.length - 1 ? 'font-semibold' : 'text-ink-400')}>{c.label}</span>
                  )}
                </span>
              ))}
            </nav>
            <nav className="ml-auto flex items-center gap-1 md:hidden" aria-label="Main mobile">
              {NAV.map(({ to, label, icon: Icon, end }) => (
                <NavLink key={to} to={to} end={end} aria-label={label} className={({ isActive }) => cn('rounded-lg p-2', isActive ? 'bg-ink-700 text-ink-100' : 'text-ink-400')}>
                  <Icon className="h-4 w-4" />
                </NavLink>
              ))}
            </nav>
            <div className="ml-auto hidden items-center gap-2 md:flex">
              <button
                onClick={() => nav('/app?new=1')}
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-brand px-4 text-sm font-semibold text-white shadow-glow transition hover:brightness-110"
              >
                <Plus className="h-4 w-4" /> New reel
              </button>
            </div>
          </header>
          <div className="canvas-glow relative flex min-h-0 flex-1 flex-col rounded-tl-3xl border-l border-t border-line/[0.07] bg-ink-800">
            <main data-scroll-root className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {/* A new section of the app fades in; moving between steps of one project keeps its frame still. */}
              <div key={pathname.split('/').slice(0, 4).join('/')} className="page-enter">
                <Outlet />
              </div>
            </main>
          </div>
        </div>
      </div>
    </div>
  );
});

/** The top of a page, like a product site's section: a small eyebrow, a big title, a line under it and the page's actions. */
export function PageHeader({ title, subtitle, eyebrow, actions }: { title: React.ReactNode; subtitle?: string; eyebrow?: string; actions?: React.ReactNode }) {
  const glow = useParallax<HTMLDivElement>(0.35);
  return (
    <header className="relative isolate flex flex-wrap items-end justify-between gap-4 pb-2">
      <div ref={glow} aria-hidden className="pointer-events-none absolute -left-10 -top-24 -z-10 h-56 w-[36rem] max-w-full rounded-full bg-mint-500/10 blur-3xl" />
      <div className="min-w-0">
        {eyebrow && <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">{eyebrow}</div>}
        <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">{title}</h1>
        {subtitle && <p className="mt-2 max-w-2xl text-sm text-ink-400 md:text-base">{subtitle}</p>}
      </div>
      {actions}
    </header>
  );
}
