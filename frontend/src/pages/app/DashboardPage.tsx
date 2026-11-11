import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Circle, Clapperboard, Lightbulb, Play, Rocket } from 'lucide-react';
import { useStores } from '../../stores/RootStore';
import { Spinner } from '../../components/ui';
import { CountUp, ProgressRing, Reveal } from '../../components/motion';
import { NewReelForm } from './NewReelForm';
import { StatusBadge } from './ProjectBadges';
import { PlatformIcons } from '../../components/BrandIcons';
import { timeAgo } from '../../lib/format';
import { nextStage, progressOf } from '../../lib/progress';
import { cn } from '../../lib/cn';

function greeting(d = new Date()) {
  const h = d.getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

const TIPS = [
  { title: 'Ask “how does it work?”', text: 'Questions make better reels than subjects. “How does a Soundbox know the money arrived?” beats “UPI”.' },
  { title: 'Approve the research first', text: 'The script is written from the research you approve, so check the facts marked “estimate” before you move on.' },
  { title: 'Pick a different style', text: 'On the Style step, try a look you have not used lately: Live Map, Whiteboard, Dark Keynote, Transit Map or Newsroom.' },
  { title: 'Leave a pause between scenes', text: 'When you record, stop for a breath between scenes. Motion Mind uses those pauses to find where each scene starts.' },
  { title: 'A quiet room beats editing', text: 'A clean recording lets the auto-fit hear every word, so the animation lands exactly when you say it.' },
];

/** Home: start a reel, pick up where you left off, and see all your reels at a glance. */
export const DashboardPage = observer(function DashboardPage() {
  const { profile, projects } = useStores();
  const [params] = useSearchParams();
  const [tip, setTip] = useState(0);
  const s = projects.stats;
  const name = profile.profile?.displayName?.split(' ')[0] ?? 'creator';
  const active = projects.items.filter((p) => p.status !== 'archived');
  const resume = active.find((p) => p.status !== 'completed');
  const rows = active.slice(0, 8);

  useEffect(() => {
    const id = setInterval(() => setTip((t) => (t + 1) % TIPS.length), 7000);
    return () => clearInterval(id);
  }, []);

  const setup = [
    { done: Boolean(profile.profile?.handle), label: `Claim your handle${profile.profile?.handle ? ` (@${profile.profile.handle})` : ''}`, to: '/app/settings' },
    { done: s.total > 0, label: 'Create your first reel', to: '/app?new=1' },
    { done: active.some((p) => p.script), label: 'Get a script written', to: resume ? `/app/projects/${resume.id}/script` : '/app?new=1' },
    { done: active.some((p) => p.editor?.upload), label: 'Add a voice to a reel', to: resume ? `/app/projects/${resume.id}/voice` : '/app?new=1' },
    { done: s.completed > 0, label: 'Export your first reel', to: resume ? `/app/projects/${resume.id}/export` : '/app?new=1' },
  ];
  const doneCount = setup.filter((x) => x.done).length;

  const stats = [
    { label: 'Reels', value: s.total },
    { label: 'In progress', value: s.inProgress + s.drafts },
    { label: 'Finished', value: s.completed },
  ];

  return (
    <div className="w-full space-y-6 p-4 md:p-8">
      <Reveal className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-ink-400">{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1 className="mt-0.5 font-display text-3xl font-bold tracking-tight">
            {greeting()}, {name}
          </h1>
        </div>
        <dl className="flex gap-2">
          {stats.map((st) => (
            <div key={st.label} className="min-w-[88px] rounded-xl border border-line/[0.09] bg-ink-900 px-4 py-2 shadow-soft">
              <dd className="font-display text-xl font-bold leading-none">{projects.loaded ? <CountUp to={st.value} /> : <span className="skeleton inline-block h-5 w-6 align-middle" />}</dd>
              <dt className="mt-1 text-xs text-ink-400">{st.label}</dt>
            </div>
          ))}
        </dl>
      </Reveal>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <Reveal>
            <section aria-label="Start a new reel" className={cn('rounded-2xl p-5 md:p-6', params.get('new') ? 'bg-mint-500/[0.07] ring-1 ring-mint-500/30' : 'bg-mint-500/[0.05]')}>
              <h2 className="font-display text-lg font-bold">What should your next reel explain?</h2>
              <p className="mb-4 mt-1 text-sm text-ink-400">Type a question. Research, the script and the style follow, and you approve each step.</p>
              <NewReelForm autoFocus={Boolean(params.get('new'))} initialTopic={params.get('topic') ?? ''} />
            </section>
          </Reveal>

          <Reveal delay={80}>
            <section aria-label="Your reels" className="card overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4">
                <h2 className="font-display text-lg font-bold">Your reels</h2>
                <Link to="/app/library" className="group inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline">
                  View all <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </Link>
              </div>
              {!projects.loaded ? (
                <div className="px-5 pb-6">
                  <Spinner />
                </div>
              ) : rows.length === 0 ? (
                <div className="mx-5 mb-5 rounded-xl border border-dashed border-line/15 p-8 text-center">
                  <Clapperboard className="mx-auto h-8 w-8 animate-float text-accent" />
                  <p className="mt-3 text-sm text-ink-400">No reels yet. Type a question above and your first one starts here.</p>
                </div>
              ) : (
                <div role="table" aria-label="Reels">
                  <div role="row" className="grid grid-cols-[minmax(0,1fr)_96px] gap-3 border-y border-line/[0.08] bg-ink-800/60 px-5 py-2 text-[11px] font-semibold uppercase tracking-wider text-ink-400 md:grid-cols-[minmax(0,1fr)_130px_140px_84px]">
                    <span role="columnheader">Reel</span>
                    <span role="columnheader" className="hidden md:block">Next step</span>
                    <span role="columnheader">Progress</span>
                    <span role="columnheader" className="hidden text-right md:block">Updated</span>
                  </div>
                  {rows.map((p, i) => {
                    const pr = progressOf(p);
                    return (
                      <Link
                        key={p.id}
                        role="row"
                        style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}
                        to={`/app/projects/${p.id}`}
                        className="group grid animate-fade-up grid-cols-[minmax(0,1fr)_96px] items-center gap-3 border-b border-line/[0.06] px-5 py-3 text-sm transition last:border-b-0 hover:bg-ink-800/70 md:grid-cols-[minmax(0,1fr)_130px_140px_84px]"
                      >
                        <span role="cell" className="min-w-0">
                          <span className="block truncate font-medium group-hover:text-accent">{p.title}</span>
                          <span className="mt-1 flex items-center gap-2 text-xs text-ink-400">
                            <StatusBadge status={p.status} /> {p.durationSec}s <PlatformIcons list={p.platforms} />
                          </span>
                        </span>
                        <span role="cell" className="hidden items-center gap-1 text-ink-300 md:flex">
                          {nextStage(p).label}
                          <ArrowRight className="h-3.5 w-3.5 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
                        </span>
                        <span role="cell" className="flex items-center gap-2">
                          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-line/10">
                            <span className="block h-full rounded-full bg-mint-500 transition-[width] duration-700" style={{ width: `${Math.round(pr * 100)}%` }} />
                          </span>
                          <span className="w-8 text-right text-xs font-semibold text-ink-300">{Math.round(pr * 100)}%</span>
                        </span>
                        <span role="cell" className="hidden text-right text-xs text-ink-400 md:block">
                          {timeAgo(p.updatedAt)}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>
          </Reveal>
        </div>

        <aside className="space-y-6">
          {resume && (
            <Reveal delay={60}>
              <Link to={`/app/projects/${resume.id}/${nextStage(resume).path}`} className="card card-hover group block p-5">
                <div className="text-xs font-semibold uppercase tracking-wider text-accent">Continue where you left off</div>
                <div className="mt-3 flex items-center gap-4">
                  <ProgressRing value={progressOf(resume)} size={60} stroke={7}>
                    {Math.round(progressOf(resume) * 100)}%
                  </ProgressRing>
                  <div className="min-w-0">
                    <div className="line-clamp-2 font-display font-bold leading-snug">{resume.title}</div>
                    <div className="mt-1 text-xs text-ink-400">Next: {nextStage(resume).title}</div>
                  </div>
                </div>
                <span className="mt-4 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-brand text-sm font-semibold text-white shadow-glow transition group-hover:brightness-110">
                  <Play className="h-4 w-4" /> Continue
                </span>
              </Link>
            </Reveal>
          )}

          <Reveal delay={120}>
            <section className="card p-5">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-display font-bold">
                  <Rocket className="h-4 w-4 text-accent" /> Getting started
                </h2>
                <span className="text-xs font-semibold text-ink-400">
                  {doneCount}/{setup.length}
                </span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line/10">
                <div className="h-full rounded-full bg-mint-500 transition-[width] duration-1000 ease-out" style={{ width: `${(doneCount / setup.length) * 100}%` }} />
              </div>
              <ul className="mt-3 space-y-0.5">
                {setup.map((it) => (
                  <li key={it.label}>
                    <Link to={it.to} className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm transition hover:bg-ink-800">
                      {it.done ? <CheckCircle2 className="h-4 w-4 shrink-0 animate-pop text-accent" /> : <Circle className="h-4 w-4 shrink-0 text-ink-600" />}
                      <span className={it.done ? 'text-ink-400 line-through decoration-line/20' : 'text-ink-100'}>{it.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          </Reveal>

          <Reveal delay={180}>
            <section className="card p-5">
              <h2 className="flex items-center gap-2 font-display font-bold">
                <Lightbulb className="h-4 w-4 text-amber-500" /> Tip
              </h2>
              <div key={tip} className="mt-3 min-h-[104px] animate-fade-up">
                <div className="text-sm font-semibold">{TIPS[tip]!.title}</div>
                <p className="mt-1 text-sm leading-relaxed text-ink-400">{TIPS[tip]!.text}</p>
              </div>
              <div className="mt-3 flex gap-1.5" role="tablist" aria-label="Tips">
                {TIPS.map((t, i) => (
                  <button key={t.title} role="tab" aria-selected={i === tip} aria-label={t.title} onClick={() => setTip(i)} className={cn('h-1.5 rounded-full transition-all duration-300', i === tip ? 'w-8 bg-accent' : 'w-3 bg-line/15 hover:bg-line/30')} />
                ))}
              </div>
            </section>
          </Reveal>
        </aside>
      </div>
    </div>
  );
});
