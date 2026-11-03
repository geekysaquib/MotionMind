import { observer } from 'mobx-react-lite';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Compass, FolderOpen, LayoutDashboard, LogOut, Settings, Plus } from 'lucide-react';
import { useStores } from '../stores/RootStore';
import { Logo } from '../components/Logo';
import { DemoBanner } from '../components/DemoBanner';
import { cn } from '../lib/cn';

const NAV = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/discover', label: 'Discover topics', icon: Compass },
  { to: '/app/library', label: 'Project library', icon: FolderOpen },
  { to: '/app/settings', label: 'Settings', icon: Settings },
];

export const AppShell = observer(function AppShell() {
  const { profile, auth } = useStores();
  const nav = useNavigate();
  const p = profile.profile;
  const initials = (p?.displayName ?? p?.handle ?? '?').slice(0, 2).toUpperCase();
  return (
    <div className="flex h-full flex-col">
      <DemoBanner />
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-64 shrink-0 flex-col border-r border-line/[0.07] bg-ink-900 p-4 md:flex">
          <div className="px-2 py-2">
            <Logo size="sm" />
          </div>
          <button
            onClick={() => nav('/app?new=1')}
            className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-mint-600 px-3 py-2.5 text-sm font-semibold text-white shadow-glow transition hover:bg-mint-700"
          >
            <Plus className="h-4 w-4" /> New reel
          </button>
          <nav className="mt-6 flex flex-col gap-1" aria-label="Main">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition',
                    isActive ? 'bg-line/[0.07] text-ink-100' : 'text-ink-400 hover:bg-line/[0.04] hover:text-ink-100',
                  )
                }
              >
                <Icon className="h-4 w-4" /> {label}
              </NavLink>
            ))}
          </nav>
          <div className="mt-auto rounded-2xl border border-line/[0.06] bg-ink-900 p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-mint-400 to-violet-500 text-xs font-bold text-white">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{p?.displayName ?? 'Creator'}</div>
                <div className="truncate text-xs text-ink-400">@{p?.handle}</div>
              </div>
              <button onClick={() => void auth.signOut()} className="rounded-lg p-1.5 text-ink-400 hover:bg-line/5 hover:text-ink-100" aria-label="Sign out" title="Sign out">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-line/[0.06] px-4 py-3 md:hidden">
            <Logo size="sm" />
            <nav className="flex gap-1" aria-label="Main mobile">
              {NAV.map(({ to, label, icon: Icon, end }) => (
                <NavLink key={to} to={to} end={end} aria-label={label} className={({ isActive }) => cn('rounded-lg p-2', isActive ? 'bg-line/10 text-ink-100' : 'text-ink-400')}>
                  <Icon className="h-4 w-4" />
                </NavLink>
              ))}
            </nav>
          </header>
          <main className="min-h-0 flex-1 overflow-y-auto bg-[radial-gradient(1200px_600px_at_80%_-10%,rgba(45,212,191,0.07),transparent),radial-gradient(900px_500px_at_0%_0%,rgba(139,92,246,0.06),transparent)]">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
});

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-400">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}
