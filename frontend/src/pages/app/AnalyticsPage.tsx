import { useCallback, useEffect, useMemo, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Link } from 'react-router-dom';
import { BarChart3, ExternalLink, RefreshCw } from 'lucide-react';
import { ANALYTICS_RANGES, engagementRate, type AnalyticsRange, type AnalyticsSummary, type PostStat, type SocialAccount, type SocialPlatform } from '@motionmind/shared';
import { useStores } from '../../stores/RootStore';
import { PageHeader } from '../../layout/AppShell';
import { EmptyState } from '../../components/EmptyState';
import { Alert, Button, Card, Spinner } from '../../components/ui';
import { PlatformIcon } from '../../components/BrandIcons';
import { errorText, timeAgo } from '../../lib/format';
import { cn } from '../../lib/cn';
import { ServiceError } from '../../services/types';

const LABEL: Record<SocialPlatform, string> = { instagram: 'Instagram', youtube: 'YouTube' };

/** 1234 → 1.2K, 1234567 → 1.2M; small numbers as they are. Null → a dash. */
export function formatCount(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '–';
  const a = Math.abs(n);
  if (a < 10_000) return n.toLocaleString('en-IN');
  if (a < 1_000_000) return `${(n / 1000).toFixed(a < 100_000 ? 1 : 0).replace(/\.0$/, '')}K`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
}

const shortDate = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** A small area chart of one value by day. */
function DayChart({ points, label, level = false }: { points: { date: string; value: number }[]; label: string; level?: boolean }) {
  const W = 640;
  const Hh = 180;
  if (points.length < 2) return <p className="py-10 text-center text-sm text-ink-400">Not enough days of {label.toLowerCase()} yet.</p>;
  const max = Math.max(1, ...points.map((p) => p.value));
  // A level (followers) is shown around its own range, so growth is visible; a count by day starts at zero.
  const lo = Math.min(...points.map((p) => p.value));
  const min = level ? lo - Math.max(1, (max - lo) * 0.15) : Math.min(0, lo);
  const x = (i: number) => (i / (points.length - 1)) * W;
  const y = (v: number) => Hh - 10 - ((v - min) / (max - min || 1)) * (Hh - 30);
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const best = points.reduce((b, p) => (p.value > b.value ? p : b), points[0]!);
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${Hh}`} className="h-44 w-full" role="img" aria-label={`${label} by day, highest ${formatCount(best.value)} on ${shortDate(best.date)}`}>
        <defs>
          <linearGradient id="mm-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgb(var(--accent))" stopOpacity="0.35" />
            <stop offset="100%" stopColor="rgb(var(--accent))" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1="0" x2={W} y1={Hh * f} y2={Hh * f} stroke="rgb(var(--line))" strokeOpacity="0.08" />
        ))}
        <path d={`${line} L${W},${Hh} L0,${Hh} Z`} fill="url(#mm-area)" />
        <path d={line} fill="none" stroke="rgb(var(--accent))" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(points.indexOf(best))} cy={y(best.value)} r="4.5" fill="rgb(var(--accent))" />
      </svg>
      <figcaption className="mt-1 flex justify-between text-xs text-ink-400">
        <span>{shortDate(points[0]!.date)}</span>
        {!level && (
          <span>
            Best day: {formatCount(best.value)} on {shortDate(best.date)}
          </span>
        )}
        <span>{shortDate(points[points.length - 1]!.date)}</span>
      </figcaption>
    </figure>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-ink-400">{label}</div>
      <div className="mt-1.5 font-display text-2xl font-bold tracking-tight">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-ink-400">{sub}</div>}
    </div>
  );
}

function PostRow({ p, platform }: { p: PostStat; platform: SocialPlatform }) {
  return (
    <tr className="border-t border-line/[0.07] align-middle">
      <td className="py-2.5 pr-3">
        <a href={p.url} target="_blank" rel="noreferrer" className="group flex items-center gap-3">
          {p.thumbnailUrl ? <img src={p.thumbnailUrl} alt="" className="h-14 w-10 shrink-0 rounded-md object-cover" loading="lazy" /> : <div className="h-14 w-10 shrink-0 rounded-md bg-line/[0.07]" />}
          <span className="min-w-0">
            <span className="line-clamp-2 text-sm font-medium group-hover:text-accent">{p.title}</span>
            <span className="text-xs text-ink-400">
              {p.kind === 'short' ? 'Short' : p.kind === 'reel' ? 'Reel' : p.kind === 'video' ? 'Video' : 'Post'} · {timeAgo(p.publishedAt)} <ExternalLink className="inline h-3 w-3" />
            </span>
          </span>
        </a>
      </td>
      <td className="px-2 text-right tabular-nums">{formatCount(p.views)}</td>
      {platform === 'instagram' && <td className="px-2 text-right tabular-nums">{formatCount(p.reach)}</td>}
      <td className="px-2 text-right tabular-nums">{formatCount(p.likes)}</td>
      <td className="px-2 text-right tabular-nums">{formatCount(p.comments)}</td>
      {platform === 'instagram' && <td className="px-2 text-right tabular-nums">{formatCount(p.shares)}</td>}
      {platform === 'instagram' && <td className="px-2 text-right tabular-nums">{formatCount(p.saves)}</td>}
      <td className="pl-2 text-right tabular-nums">{p.avgWatchSec === null ? '–' : `${p.avgWatchSec}s`}</td>
    </tr>
  );
}

/** Phase 2: the creator's own Instagram and YouTube numbers. */
export const AnalyticsPage = observer(function AnalyticsPage() {
  const { services, auth } = useStores();
  const api = services.claude(() => auth.session?.accessToken ?? null);
  const [accounts, setAccounts] = useState<SocialAccount[] | null>(null);
  const [platform, setPlatform] = useState<SocialPlatform | null>(null);
  const [range, setRange] = useState<AnalyticsRange>(28);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ text: string; code?: string } | null>(null);
  const [sort, setSort] = useState<'recent' | 'views'>('recent');

  useEffect(() => {
    Promise.resolve()
      .then(() => api.socialAccounts())
      .then((r) => {
        setAccounts(r.accounts);
        setPlatform(r.accounts[0]?.platform ?? null);
      })
      .catch((e) => {
        setAccounts([]);
        setError({ text: errorText(e), code: e instanceof ServiceError ? e.code : undefined });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(
    async (fresh = false) => {
      if (!platform) return;
      setLoading(true);
      setError(null);
      try {
        setSummary((await api.analytics(platform, range, fresh)).summary);
      } catch (e) {
        setSummary(null);
        setError({ text: errorText(e), code: e instanceof ServiceError ? e.code : undefined });
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [platform, range],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const posts = useMemo(() => {
    const list = [...(summary?.posts ?? [])];
    return sort === 'views' ? list.sort((a, b) => (b.views ?? -1) - (a.views ?? -1)) : list;
  }, [summary, sort]);

  if (!accounts) return <div className="p-8"><Spinner label="Loading" /></div>;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <PageHeader
        title="Analytics"
        subtitle="How your reels and Shorts are doing, from your own Instagram and YouTube accounts."
        actions={
          platform ? (
            <Button variant="secondary" icon={<RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />} disabled={loading} onClick={() => void load(true)}>
              Refresh
            </Button>
          ) : undefined
        }
      />

      {accounts.length === 0 ? (
        error?.code === 'needs_migration' ? (
          <Alert tone="info">{error.text}</Alert>
        ) : (
          <EmptyState icon={<BarChart3 className="h-6 w-6" />} title="Connect your accounts" text="Connect your Instagram and YouTube accounts to see followers, views and how each reel performed." to="/app/settings/connections" action="Go to Connections" />
        )
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex gap-1 rounded-xl bg-line/[0.06] p-1" role="tablist" aria-label="Platform">
              {accounts.map((a) => (
                <button key={a.platform} type="button" role="tab" aria-selected={a.platform === platform} onClick={() => setPlatform(a.platform)} className={cn('inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition', a.platform === platform ? 'bg-ink-900 text-ink-100 shadow-sm' : 'text-ink-400 hover:text-ink-100')}>
                  <PlatformIcon platform={a.platform} className="h-4 w-4" /> {LABEL[a.platform]} <span className="text-xs text-ink-400">{a.handle}</span>
                </button>
              ))}
            </div>
            <div className="inline-flex gap-1 rounded-xl bg-line/[0.06] p-1" role="tablist" aria-label="Range">
              {ANALYTICS_RANGES.map((r) => (
                <button key={r} type="button" role="tab" aria-selected={r === range} onClick={() => setRange(r)} className={cn('rounded-lg px-3 py-1.5 text-sm font-medium transition', r === range ? 'bg-ink-900 text-ink-100 shadow-sm' : 'text-ink-400 hover:text-ink-100')}>
                  {r} days
                </button>
              ))}
            </div>
          </div>

          {error && (
            <Alert>
              {error.text}{' '}
              {(error.code === 'reconnect' || error.code === 'not_connected') && (
                <Link to="/app/settings/connections" className="font-semibold underline">
                  Open Connections
                </Link>
              )}
            </Alert>
          )}
          {loading && !summary && <Spinner label={`Asking ${platform ? LABEL[platform] : ''} for your numbers`} />}

          {summary && (
            <>
              {summary.notes.map((n) => (
                <Alert key={n} tone="info">
                  {n}
                </Alert>
              ))}
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                <Kpi label={summary.platform === 'youtube' ? 'Subscribers' : 'Followers'} value={formatCount(summary.account.followers)} sub={summary.totals.followersGained === null ? undefined : `${summary.totals.followersGained >= 0 ? '+' : ''}${formatCount(summary.totals.followersGained)} in ${range} days`} />
                <Kpi label="Views" value={formatCount(summary.totals.views)} sub={`${range} days`} />
                {summary.platform === 'youtube' ? <Kpi label="Watch time" value={summary.totals.watchHours === null ? '–' : `${formatCount(Math.round(summary.totals.watchHours))} h`} /> : <Kpi label="Accounts reached" value={formatCount(summary.totals.reach)} />}
                <Kpi label="Engagement" value={engagementRate(summary.totals) === null ? '–' : `${engagementRate(summary.totals)}%`} sub="likes, comments, shares, saves per view" />
                <Kpi label="Likes" value={formatCount(summary.totals.likes)} />
                <Kpi label={summary.platform === 'instagram' ? 'Shares · saves' : 'Comments · shares'} value={summary.platform === 'instagram' ? `${formatCount(summary.totals.shares)} · ${formatCount(summary.totals.saves)}` : `${formatCount(summary.totals.comments)} · ${formatCount(summary.totals.shares)}`} />
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <Card>
                  <h2 className="font-semibold">
                    {summary.dailyLabel} by day <span className="text-sm font-normal text-ink-400">· {shortDate(summary.from)} to {shortDate(summary.to)}</span>
                  </h2>
                  <div className="mt-3">
                    <DayChart points={summary.daily} label={summary.dailyLabel} />
                  </div>
                </Card>
                <Card>
                  <h2 className="font-semibold">{summary.platform === 'youtube' ? 'Subscribers' : 'Followers'} over time</h2>
                  <div className="mt-3">
                    <DayChart points={summary.followerHistory.map((d) => ({ date: d.date, value: d.followers }))} label={summary.platform === 'youtube' ? 'Subscribers' : 'Followers'} level />
                  </div>
                  <p className="mt-2 text-xs text-ink-400">Motion Mind saves the count every day you open this page, so this line grows from today.</p>
                  {summary.shortsShare && summary.shortsShare.shorts + summary.shortsShare.other > 0 && (
                    <div className="mt-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-ink-400">Views from Shorts</div>
                      <div className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-line/[0.08]">
                        <div className="bg-brand" style={{ width: `${(summary.shortsShare.shorts / (summary.shortsShare.shorts + summary.shortsShare.other)) * 100}%` }} />
                      </div>
                      <div className="mt-1.5 text-sm">
                        {Math.round((summary.shortsShare.shorts / (summary.shortsShare.shorts + summary.shortsShare.other)) * 100)}% of views came from Shorts ({formatCount(summary.shortsShare.shorts)} of {formatCount(summary.shortsShare.shorts + summary.shortsShare.other)})
                      </div>
                    </div>
                  )}
                </Card>
              </div>

              <Card>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-semibold">Your latest {summary.platform === 'youtube' ? 'videos and Shorts' : 'reels and posts'}</h2>
                  <div className="inline-flex gap-1 rounded-lg bg-line/[0.06] p-1 text-xs">
                    {(['recent', 'views'] as const).map((s) => (
                      <button key={s} type="button" aria-pressed={sort === s} onClick={() => setSort(s)} className={cn('rounded-md px-2.5 py-1 font-medium', sort === s ? 'bg-ink-900 text-ink-100' : 'text-ink-400')}>
                        {s === 'recent' ? 'Newest' : 'Most viewed'}
                      </button>
                    ))}
                  </div>
                </div>
                {posts.length === 0 ? (
                  <p className="mt-4 text-sm text-ink-400">No posts yet.</p>
                ) : (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full min-w-[640px] text-sm">
                      <thead className="text-xs uppercase tracking-wide text-ink-400">
                        <tr>
                          <th className="pb-2 text-left font-semibold">Post</th>
                          <th className="px-2 pb-2 text-right font-semibold">Views</th>
                          {summary.platform === 'instagram' && <th className="px-2 pb-2 text-right font-semibold">Reach</th>}
                          <th className="px-2 pb-2 text-right font-semibold">Likes</th>
                          <th className="px-2 pb-2 text-right font-semibold">Comments</th>
                          {summary.platform === 'instagram' && <th className="px-2 pb-2 text-right font-semibold">Shares</th>}
                          {summary.platform === 'instagram' && <th className="px-2 pb-2 text-right font-semibold">Saves</th>}
                          <th className="pl-2 pb-2 text-right font-semibold">Avg watch</th>
                        </tr>
                      </thead>
                      <tbody>
                        {posts.map((p) => (
                          <PostRow key={p.id} p={p} platform={summary.platform} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>

              <p className="text-xs text-ink-400">
                Updated {timeAgo(summary.fetchedAt)}. Numbers come straight from {LABEL[summary.platform]} and can lag a day behind the app.
              </p>
            </>
          )}
        </>
      )}
    </div>
  );
});
