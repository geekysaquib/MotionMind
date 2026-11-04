import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Circle, Clapperboard, FileClock, Film, Layers, Lightbulb, Play, Plus, Rocket } from 'lucide-react';
import { useStores } from '../../stores/RootStore';
import { Card, Spinner } from '../../components/ui';
import { CountUp, ProgressRing, Reveal } from '../../components/motion';
import { NewReelForm } from './NewReelForm';
import { StageBadge, StatusBadge } from './ProjectBadges';
import { timeAgo } from '../../lib/format';
import { nextStage, progressOf, stageDone } from '../../lib/progress';
import { cn } from '../../lib/cn';

function greeting(d = new Date()) {
  const h = d.getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

const TIPS = [
  { title: 'Ask “how does it work?”', text: 'Questions make better reels than subjects. “How does a Soundbox know the money arrived?” beats “UPI”.' },
  { title: 'Approve the research first', text: 'The script is written from the research you approve, so check the facts marked “estimate” before you move on.' },
  { title: 'Make any object appear', text: 'In the storyboard, pick “Anything else” for an object, give it an emoji and a shape, and it shows up in the 3D scene.' },
  { title: 'Slow down the hard scenes', text: 'In the reel editor you can set the pace of one scene, so a busy card stays on screen a little longer.' },
  { title: 'Translate the voice script', text: 'On the Voice step, switch the script to Hindi or English, copy it into your text-to-speech tool, and upload the recording.' },
];

export const DashboardPage = observer(function DashboardPage() {
  const { profile, projects } = useStores();
  const [params] = useSearchParams();
  const [tip, setTip] = useState(0);
  const s = projects.stats;
  const name = profile.profile?.displayName?.split(' ')[0] ?? 'creator';
  const active = projects.items.filter((p) => p.status !== 'archived');
  const resume = active.find((p) => p.status !== 'completed');

  useEffect(() => {
    const id = setInterval(() => setTip((t) => (t + 1) % TIPS.length), 7000);
    return () => clearInterval(id);
  }, []);

  const stats = [
    { label: 'Total projects', value: s.total, icon: Layers, tone: 'bg-violet-500/10 text-violet-600' },
    { label: 'Completed reels', value: s.completed, icon: Film, tone: 'bg-emerald-500/10 text-emerald-600' },
    { label: 'In progress', value: s.inProgress, icon: Clapperboard, tone: 'bg-sky-500/10 text-sky-600' },
    { label: 'Drafts', value: s.drafts, icon: FileClock, tone: 'bg-amber-500/10 text-amber-600' },
  ];

  const setup = [
    { done: Boolean(profile.profile?.handle), label: `Claim your handle${profile.profile?.handle ? ` (@${profile.profile.handle})` : ''}`, to: '/app/settings' },
    { done: s.total > 0, label: 'Create your first reel project', to: '/app?new=1' },
    { done: active.some((p) => p.script), label: 'Get a script written', to: resume ? `/app/projects/${resume.id}/script` : '/app?new=1' },
    { done: active.some((p) => p.editor?.upload || p.voice), label: 'Add a voice to a reel', to: resume ? `/app/projects/${resume.id}/voice` : '/app?new=1' },
    { done: s.completed > 0, label: 'Export your first reel', to: resume ? `/app/projects/${resume.id}/export` : '/app?new=1' },
  ];
  const doneCount = setup.filter((x) => x.done).length;

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6 md:p-10">
      <Reveal className="card relative overflow-hidden p-7 md:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(520px_220px_at_100%_0%,rgba(124,58,237,0.10),transparent),radial-gradient(420px_200px_at_0%_100%,rgba(14,165,233,0.08),transparent)]" aria-hidden />
        <div className="relative flex flex-wrap items-center justify-between gap-6">
          <div>
            <p className="text-sm font-medium text-ink-400">{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
            <h1 className="mt-1 animate-fade-up font-display text-3xl font-bold tracking-tight">
              {greeting()}, {name}
            </h1>
            <p className="mt-2 max-w-md text-sm text-ink-400">
              {s.total === 0 ? 'Start your first reel: type a question below and the studio takes it from there.' : `You have ${s.inProgress + s.drafts} reel${s.inProgress + s.drafts === 1 ? '' : 's'} on the go and ${s.completed} finished.`}
            </p>
          </div>
          <Link to="/app?new=1" className="group inline-flex items-center gap-2 rounded-lg bg-ink-100 px-4 py-2.5 text-sm font-semibold text-ink-950 transition hover:opacity-90">
            <Plus className="h-4 w-4 transition group-hover:rotate-90" /> New reel
          </Link>
        </div>
      </Reveal>

      {resume && (
        <Reveal delay={60}>
          <Link to={`/app/projects/${resume.id}/${nextStage(resume).path}`} className="card card-hover group flex flex-wrap items-center gap-5 p-5">
            <ProgressRing value={progressOf(resume)} size={64} stroke={7}>
              {Math.round(progressOf(resume) * 100)}%
            </ProgressRing>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold uppercase tracking-wider text-accent">Continue where you left off</div>
              <div className="mt-0.5 truncate font-display text-lg font-bold">{resume.title}</div>
              <div className="text-sm text-ink-400">
                Next: {nextStage(resume).title} · updated {timeAgo(resume.updatedAt)}
              </div>
            </div>
            <span className="inline-flex items-center gap-2 rounded-xl bg-mint-600 px-4 py-2 text-sm font-semibold text-white shadow-glow transition group-hover:bg-mint-700">
              <Play className="h-4 w-4" /> Continue
            </span>
          </Link>
        </Reveal>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, tone }, i) => (
          <Reveal key={label} delay={i * 70} className="card card-hover relative overflow-hidden p-5">
            <div className="relative">
              <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', tone)}>
                <Icon className="h-4 w-4" />
              </span>
              <div className="mt-4 font-display text-3xl font-bold">{projects.loaded ? <CountUp to={value} /> : <span className="skeleton inline-block h-9 w-10 align-middle" />}</div>
              <div className="mt-1 text-sm text-ink-400">{label}</div>
            </div>
          </Reveal>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Reveal>
          <Card className={cn('h-full', params.get('new') && 'ring-2 ring-mint-400/50')}>
            <h2 className="font-display text-lg font-semibold">Quick create</h2>
            <p className="mb-5 mt-1 text-sm text-ink-400">Start from a topic. Research, script and visuals follow step by step, with your approval at each stage.</p>
            <NewReelForm autoFocus={Boolean(params.get('new'))} initialTopic={params.get('topic') ?? ''} />
          </Card>
        </Reveal>
        <Reveal delay={90}>
          <Card className="h-full">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
                <Rocket className="h-5 w-5 text-accent" /> Getting started
              </h2>
              <span className="text-xs font-semibold text-ink-400">
                {doneCount}/{setup.length}
              </span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line/10">
              <div className="h-full rounded-full bg-gradient-to-r from-mint-400 to-violet-500 transition-[width] duration-1000 ease-out" style={{ width: `${(doneCount / setup.length) * 100}%` }} />
            </div>
            <ul className="mt-4 space-y-1">
              {setup.map((it) => (
                <li key={it.label}>
                  <Link to={it.to} className="flex items-center gap-3 rounded-xl px-2 py-1.5 text-sm transition hover:bg-line/5">
                    {it.done ? <CheckCircle2 className="h-5 w-5 shrink-0 animate-pop text-accent" /> : <Circle className="h-5 w-5 shrink-0 text-ink-600" />}
                    <span className={it.done ? 'text-ink-400 line-through decoration-line/20' : 'text-ink-100'}>{it.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </Reveal>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Reveal>
          <Card className="h-full">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">Recent projects</h2>
              <Link to="/app/library" className="group inline-flex items-center gap-1 text-sm text-accent hover:underline">
                View all <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </Link>
            </div>
            <div className="mt-4">
              {!projects.loaded ? (
                <Spinner />
              ) : projects.recent.length === 0 ? (
                <div className="rounded-xl border border-dashed border-line/15 p-8 text-center">
                  <Clapperboard className="mx-auto h-8 w-8 animate-float text-accent" />
                  <p className="mt-3 text-sm text-ink-400">No projects yet. Type a question above and your first reel starts here.</p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {projects.recent.map((p) => (
                    <li key={p.id}>
                      <Link to={`/app/projects/${p.id}`} className="group flex items-center gap-4 rounded-xl p-2 transition hover:bg-line/[0.04]">
                        <ProgressRing value={progressOf(p)} size={44} stroke={5}>
                          <span className="text-[10px]">{stageDone(p).filter(Boolean).length}/8</span>
                        </ProgressRing>
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{p.title}</div>
                          <div className="text-xs text-ink-400">
                            Next: {nextStage(p).label} · {timeAgo(p.updatedAt)}
                          </div>
                        </div>
                        <StageBadge stage={p.stage} />
                        <StatusBadge status={p.status} />
                        <ArrowRight className="h-4 w-4 text-ink-400 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        </Reveal>
        <Reveal delay={90}>
          <Card className="h-full overflow-hidden">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
              <Lightbulb className="h-5 w-5 text-amber-500" /> Tips
            </h2>
            <div key={tip} className="mt-4 min-h-[110px] animate-fade-up">
              <div className="font-semibold">{TIPS[tip]!.title}</div>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-400">{TIPS[tip]!.text}</p>
            </div>
            <div className="mt-4 flex gap-1.5" role="tablist" aria-label="Tips">
              {TIPS.map((t, i) => (
                <button key={t.title} role="tab" aria-selected={i === tip} aria-label={t.title} onClick={() => setTip(i)} className={cn('h-1.5 rounded-full transition-all duration-300', i === tip ? 'w-8 bg-accent' : 'w-3 bg-line/15 hover:bg-line/30')} />
              ))}
            </div>
          </Card>
        </Reveal>
      </div>
    </div>
  );
});
