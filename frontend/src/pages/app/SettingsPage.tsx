import { NavLink, Outlet } from 'react-router-dom';
import { PageHeader } from '../../layout/AppShell';
import { cn } from '../../lib/cn';

const TABS = [
  { to: '/app/settings', label: 'Profile & handle', end: true },
  { to: '/app/settings/keys', label: 'API keys' },
  { to: '/app/settings/account', label: 'Account' },
];

export function SettingsPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6 md:p-10">
      <PageHeader title="Settings" subtitle="Your profile, AI providers and account." />
      <nav className="flex gap-1 border-b border-line/[0.06]" aria-label="Settings">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => cn('border-b-2 px-3 py-2.5 text-sm font-medium', isActive ? 'border-mint-400 text-ink-100' : 'border-transparent text-ink-400 hover:text-ink-100')}>
            {t.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
