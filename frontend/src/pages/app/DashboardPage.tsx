import { observer } from 'mobx-react-lite';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Circle, Clapperboard, FileClock, Film, KeyRound, Layers, Compass } from 'lucide-react';
import { useEffect } from 'react';
import { useStores } from '../../stores/RootStore';
import { PageHeader } from '../../layout/AppShell';
import { Card, Spinner } from '../../components/ui';
import { NewReelForm } from './NewReelForm';
import { StageBadge, StatusBadge } from './ProjectBadges';
import { timeAgo } from '../../lib/format';
import { cn } from '../../lib/cn';

function greeting(d = new Date()) {
  const h = d.getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export const DashboardPage = observer(function DashboardPage() {
  const { profile, projects, keys } = useStores();
  const [params] = useSearchParams();
  useEffect(() => {
    if (!keys.loaded) void keys.load();
  }, [keys]);
  const s = projects.stats;
  const name = profile.profile?.displayName?.split(' ')[0] ?? 'creator';

  const stats = [
    { label: 'Total projects', value: s.total, icon: Layers, tone: 'from-mint-400/20' },
    { label: 'Completed reels', value: s.completed, icon: Film, tone: 'from-violet-500/20' },
    { label: 'In progress', value: s.inProgress, icon: Clapperboard, tone: 'from-coral-500/20' },
    { label: 'Drafts', value: s.drafts, icon: FileClock, tone: 'from-amber-400/20' },
  ];

  const setup = [
    { done: Boolean(profile.profile?.handle), label: `Claim your handle${profile.profile?.handle ? ` (@${profile.profile.handle})` : ''}`, to: '/app/settings' },
    { done: keys.configuredCount > 0, label: keys.configuredCount > 0 ? `${keys.configuredCount} API key${keys.configuredCount > 1 ? 's' : ''} saved` : 'Add your AI provider keys', to: '/app/settings/keys' },
    { done: s.total > 0, label: 'Create your first reel project', to: '/app?new=1' },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6 md:p-10">
      <PageHeader title={`${greeting()}, ${name}`} subtitle="Here's what's happening in your studio." />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className={cn('card relative overflow-hidden p-5')}>
            <div className={cn('absolute inset-0 bg-gradient-to-br to-transparent opacity-60', tone)} />
            <div className="relative">
              <Icon className="h-5 w-5 text-ink-300" />
              <div className="mt-4 font-display text-4xl font-bold">{projects.loaded ? value : '–'}</div>
              <div className="mt-1 text-sm text-ink-400">{label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card className={cn(params.get('new') && 'ring-2 ring-mint-400/40')}>
          <h2 className="font-display text-lg font-semibold">Quick create</h2>
          <p className="mb-5 mt-1 text-sm text-ink-400">Start from a topic. Research, script and visuals follow step by step, with your approval at each stage.</p>
          <NewReelForm autoFocus={Boolean(params.get('new'))} />
        </Card>
        <Card>
          <h2 className="font-display text-lg font-semibold">Studio setup</h2>
          <ul className="mt-4 space-y-3">
            {setup.map((it) => (
              <li key={it.label}>
                <Link to={it.to} className="flex items-center gap-3 rounded-xl px-2 py-1.5 text-sm hover:bg-line/5">
                  {it.done ? <CheckCircle2 className="h-5 w-5 text-accent" /> : <Circle className="h-5 w-5 text-ink-600" />}
                  <span className={it.done ? 'text-ink-300' : 'text-ink-100'}>{it.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Recent projects</h2>
            <Link to="/app/library" className="inline-flex items-center gap-1 text-sm text-accent hover:underline">
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-4">
            {!projects.loaded ? (
              <Spinner />
            ) : projects.recent.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line/10 p-8 text-center text-sm text-ink-400">No projects yet. Create one above.</p>
            ) : (
              <ul className="divide-y divide-line/[0.06]">
                {projects.recent.map((p) => (
                  <li key={p.id}>
                    <Link to={`/app/projects/${p.id}`} className="flex items-center gap-4 py-3 hover:opacity-90">
                      <div className="flex h-12 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-b from-mint-400/30 to-violet-500/30 text-[10px] font-bold">{p.durationSec}s</div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{p.title}</div>
                        <div className="text-xs text-ink-400">Updated {timeAgo(p.updatedAt)}</div>
                      </div>
                      <StageBadge stage={p.stage} />
                      <StatusBadge status={p.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-2">
            <Compass className="h-5 w-5 text-violet-600" />
            <h2 className="font-display text-lg font-semibold">Topic recommendations</h2>
          </div>
          <p className="mt-3 text-sm text-ink-400">
            Live topic ideas come from web research, which is the next module we build. It will use your Tavily or Exa key.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link to="/app/discover" className="inline-flex items-center gap-1 rounded-xl bg-line/[0.06] px-3 py-2 text-sm font-medium hover:bg-line/10">
              About Discover <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/app/settings/keys" className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-medium text-accent hover:bg-line/5">
              <KeyRound className="h-4 w-4" /> Add a research key
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
});
