import { NavLink, Outlet } from 'react-router-dom';
import { PageHeader } from '../../layout/AppShell';
import { cn } from '../../lib/cn';

const TABS = [
  { to: '/app/settings', label: 'Profile & handle', end: true },
  { to: '/app/settings/connectors', label: 'AI & connectors' },
  { to: '/app/settings/account', label: 'Account' },
  { to: '/app/settings/diagnostics', label: 'Diagnostics' },
];

export function SettingsPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6 md:p-10">
      <PageHeader title="Settings" subtitle="Your profile, how you work with AI, and your account." />
      <nav className="inline-flex gap-1 rounded-lg bg-ink-700/70 p-1" aria-label="Settings">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => cn('rounded-md px-3 py-1.5 text-sm font-medium transition', isActive ? 'bg-ink-900 text-ink-100 shadow-sm' : 'text-ink-400 hover:text-ink-100')}>
            {t.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
