import { observer } from 'mobx-react-lite';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { ClipboardCopy, Compass, FolderOpen, KeyRound, LayoutDashboard, LogOut, Settings, Plus } from 'lucide-react';
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
  const { profile, auth, aiMode } = useStores();
  const nav = useNavigate();
  const p = profile.profile;
  const initials = (p?.displayName ?? p?.handle ?? '?').slice(0, 2).toUpperCase();
  return (
    <div className="flex h-full flex-col">
      <DemoBanner />
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-64 shrink-0 flex-col border-r border-line/[0.07] bg-ink-900 p-4 md:flex">
          <div className="px-2 py-2">
            <Logo size="sm" animated />
          </div>
          <button
            onClick={() => nav('/app?new=1')}
            className="group relative mt-6 flex items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-mint-600 to-mint-500 px-3 py-2.5 text-sm font-semibold text-white shadow-glow transition hover:-translate-y-0.5"
          >
            <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" aria-hidden />
            <Plus className="relative h-4 w-4 transition group-hover:rotate-90" /> <span className="relative">New reel</span>
          </button>
          <nav className="mt-6 flex flex-col gap-1" aria-label="Main">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition',
                    isActive ? 'bg-gradient-to-r from-mint-400/15 to-transparent text-ink-100' : 'text-ink-400 hover:translate-x-0.5 hover:bg-line/[0.04] hover:text-ink-100',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span className={cn('absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-gradient-to-b from-mint-400 to-violet-500 transition-all duration-300', isActive ? 'opacity-100' : 'h-0 opacity-0')} aria-hidden />
                    <Icon className={cn('h-4 w-4 transition', isActive ? 'text-accent' : 'group-hover:scale-110')} /> {label}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
          <NavLink to="/app/settings/connectors" className="mt-auto flex items-center gap-2 rounded-xl border border-line/[0.07] px-3 py-2 text-xs text-ink-400 transition hover:border-mint-400/40 hover:text-ink-100" title="Change how you work with AI">
            {aiMode.paste ? <ClipboardCopy className="h-3.5 w-3.5 text-accent" /> : <KeyRound className="h-3.5 w-3.5 text-violet-600" />}
            <span>
              AI: <span className="font-semibold text-ink-100">{aiMode.paste ? 'Copy and paste' : 'API keys'}</span>
            </span>
          </NavLink>
          <div className="mt-3 rounded-2xl border border-line/[0.06] bg-ink-900 p-3">
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
          <main className="relative min-h-0 flex-1 overflow-y-auto">
            <div className="orb right-10 top-0 h-80 w-80 bg-mint-400/20" aria-hidden />
            <div className="orb -left-10 top-80 h-72 w-72 bg-violet-500/15" style={{ animationDelay: '-7s' }} aria-hidden />
            <div className="relative">
              <Outlet />
            </div>
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
        <h1 className="animate-fade-up font-display text-3xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 animate-fade-up text-sm text-ink-400 [animation-delay:80ms]">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}
