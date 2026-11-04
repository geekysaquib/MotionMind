import { observer } from 'mobx-react-lite';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ChevronRight, Compass, FolderClosed, FolderOpen, LayoutDashboard, LogOut, Plus, Settings } from 'lucide-react';
import { useStores } from '../stores/RootStore';
import { FloatingIcons } from '../components/FloatingIcons';
import { ClaudeIcon } from '../components/BrandIcons';
import { Logo } from '../components/Logo';
import { DemoBanner } from '../components/DemoBanner';
import { ProgressRing } from '../components/motion';
import { progressOf, STAGE_INFO } from '../lib/progress';
import { cn } from '../lib/cn';

const NAV = [
  { to: '/app', label: 'Home', icon: LayoutDashboard, end: true },
  { to: '/app/library', label: 'Projects', icon: FolderOpen },
  { to: '/app/discover', label: 'Discover', icon: Compass },
  { to: '/app/settings', label: 'Settings', icon: Settings },
];

const SETTINGS_TABS: Record<string, string> = { connectors: 'AI & connectors', account: 'Account', diagnostics: 'Diagnostics', claude: 'AI & connectors' };

/** Where you are, as a short trail for the top bar: Projects / <reel> / <step>. */
function useCrumbs(): { label: string; to?: string }[] {
  const { pathname } = useLocation();
  const { projects } = useStores();
  const parts = pathname.replace(/^\/app\/?/, '').split('/').filter(Boolean);
  if (parts.length === 0) return [{ label: 'Home' }];
  if (parts[0] === 'library') return [{ label: 'Projects' }];
  if (parts[0] === 'discover') return [{ label: 'Discover' }];
  if (parts[0] === 'settings') return [{ label: 'Settings', to: '/app/settings' }, { label: parts[1] ? (SETTINGS_TABS[parts[1]] ?? parts[1]) : 'Profile & handle' }];
  if (parts[0] === 'projects' && parts[1]) {
    const p = projects.byId(parts[1]);
    const stage = STAGE_INFO.find((s) => s.path === (parts[2] ?? ''));
    return [{ label: 'Projects', to: '/app/library' }, { label: p?.title ?? 'Project', to: `/app/projects/${parts[1]}` }, ...(stage ? [{ label: stage.label }] : [])];
  }
  return [{ label: 'Home' }];
}

export const AppShell = observer(function AppShell() {
  const { profile, auth, aiMode, projects } = useStores();
  const nav = useNavigate();
  const crumbs = useCrumbs();
  const { pathname } = useLocation();
  const p = profile.profile;
  const initials = (p?.displayName ?? p?.handle ?? '?').slice(0, 2).toUpperCase();
  const total = projects.stats.total;

  return (
    <div className="flex h-full flex-col bg-ink-900">
      <DemoBanner />
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-56 shrink-0 flex-col border-r border-line/[0.08] bg-ink-900 p-3 md:flex">
          <div className="flex items-center justify-between px-2 py-2">
            <Link to="/app" aria-label="Home">
              <Logo size="sm" animated />
            </Link>
          </div>

          <div className="mt-3 flex gap-2">
            <button
              onClick={() => nav('/app?new=1')}
              className="group flex h-9 flex-1 items-center gap-2 rounded-lg border border-line/[0.14] bg-ink-900 px-3 text-sm font-semibold shadow-sm transition hover:bg-ink-800"
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
                  cn('icon-hover flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium transition', isActive ? 'bg-ink-700/70 text-ink-100' : 'text-ink-300 hover:bg-ink-800 hover:text-ink-100')
                }
              >
                <Icon className="h-4 w-4 shrink-0 text-ink-400" />
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
                      cn('flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm transition', isActive ? 'bg-ink-700/70 font-medium text-ink-100' : 'text-ink-300 hover:bg-ink-800 hover:text-ink-100')
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

          <NavLink to="/app/settings/connectors" className="mt-3 block rounded-xl border border-line/[0.09] bg-ink-800/60 p-3 transition hover:border-mint-500/40" title="Change how you work with AI">
            <div className="flex items-center gap-2 text-xs font-semibold text-ink-300">
              <ClaudeIcon className="h-3.5 w-3.5" /> AI mode
            </div>
            <div className="mt-1.5 font-display text-base font-bold">{aiMode.paste ? 'Copy and paste' : 'API keys'}</div>
            <div className="mt-0.5 flex items-center justify-between text-xs text-ink-400">
              <span>{aiMode.paste ? 'Uses your Claude subscription' : 'One click, server keys'}</span>
              <span className="font-semibold text-accent">Change</span>
            </div>
          </NavLink>

          <div className="mt-3 flex items-center gap-2.5 border-t border-line/[0.08] px-1 pt-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-400 to-violet-600 text-[11px] font-bold text-white">{initials}</div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold leading-tight">{p?.displayName ?? 'Creator'}</div>
              <div className="truncate text-xs text-ink-400">{auth.session?.email ?? (p?.handle ? `@${p.handle}` : '')}</div>
            </div>
            <button onClick={() => void auth.signOut()} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-800 hover:text-ink-100" aria-label="Sign out" title="Sign out">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line/[0.08] bg-ink-900 px-4 md:px-6">
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
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-mint-600 px-3.5 text-sm font-semibold text-white shadow-glow transition hover:bg-mint-700"
              >
                <Plus className="h-4 w-4" /> New reel
              </button>
            </div>
          </header>
          <div className="app-wash relative flex min-h-0 flex-1 flex-col bg-ink-800/70">
          <FloatingIcons />
          <main className="relative min-h-0 flex-1 overflow-y-auto">
            <div key={pathname.split("/").slice(0, 3).join("/")} className="animate-fade-up">
              <Outlet />
            </div>
          </main>
          </div>
        </div>
      </div>
    </div>
  );
});

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="animate-fade-up font-display text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 animate-fade-up text-sm text-ink-400 [animation-delay:80ms]">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}
