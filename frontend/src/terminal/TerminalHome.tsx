import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, LogOut, Plus } from 'lucide-react';
import { PLATFORMS, type Platform } from '@motionmind/shared';
import { useStores } from '../stores/RootStore';
import { nextStage, progressOf } from '../lib/progress';
import { errorText } from '../lib/format';
import { log } from '../lib/logger';
import { cn } from '../lib/cn';
import { ProjectThumb } from '../components/ProjectThumb';
import { TBrand } from './TerminalLayout';
import { TButton, TNote, TStepHead } from './parts';

/** The Terminal's home: your reels, newest first, each opening at its next step; and a new reel. */
export const TerminalHome = observer(function TerminalHome() {
  const { projects, auth, profile } = useStores();
  const nav = useNavigate();
  const list = projects.items.filter((p) => p.status !== 'archived');
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <TBrand />
        <button type="button" aria-label="Sign this phone out" className="p-2 text-ink-400" onClick={() => void auth.signOut()}>
          <LogOut className="h-5 w-5" />
        </button>
      </div>
      <TStepHead title={`Hi ${profile.profile?.displayName?.split(' ')[0] ?? 'creator'}`} help={list.length ? 'Pick up a reel where you left it, or start a new one.' : 'Start your first reel. Your PC does the rendering.'} />
      <TButton main icon={<Plus className="h-5 w-5" />} onClick={() => nav('/t/new')}>
        New reel
      </TButton>
      {!projects.loaded ? (
        <p className="font-mono text-sm text-ink-400">loading reels…</p>
      ) : (
        <ul className="space-y-2.5">
          {list.map((p) => {
            const pr = progressOf(p);
            return (
              <li key={p.id}>
                <Link to={`/t/p/${p.id}`} className="flex items-center gap-3 rounded-2xl border border-line/10 bg-line/[0.03] p-3 active:bg-line/[0.07]">
                  <span className="h-16 w-12 shrink-0 overflow-hidden rounded-lg bg-ink-800">
                    <ProjectThumb project={p} className="!p-1 [&>span]:hidden" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold">{p.title}</span>
                    <span className="mt-1 block font-mono text-xs text-ink-400">
                      {Math.round(pr * 100)}% · next: {nextStage(p).label.toLowerCase()}
                    </span>
                    <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-line/10">
                      <span className="block h-full rounded-full bg-mint-500" style={{ width: `${Math.round(pr * 100)}%` }} />
                    </span>
                  </span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-ink-400" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
});

const LENGTHS = [15, 30, 45, 60, 90] as const;

/** A new reel: the question, its length and where it goes. */
export const TerminalNew = observer(function TerminalNew() {
  const { projects } = useStores();
  const nav = useNavigate();
  const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const [topic, setTopic] = useState(params.get('topic') ?? '');
  const [duration, setDuration] = useState<number>(60);
  const [platforms, setPlatforms] = useState<Platform[]>(['instagram', 'youtube']);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    const t = topic.trim();
    if (!t) return;
    setBusy(true);
    setError(null);
    try {
      const p = await projects.create({ title: t.length > 80 ? `${t.slice(0, 77)}…` : t, topic: t, durationSec: duration, qualityTier: 'standard', platforms });
      log.info('terminal', 'Reel created', { projectId: p.id, durationSec: duration });
      nav(`/t/p/${p.id}/research`, { replace: true });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const toggle = (pl: Platform) => setPlatforms((ps) => (ps.includes(pl) ? (ps.length > 1 ? ps.filter((x) => x !== pl) : ps) : [...ps, pl]));

  return (
    <div className="space-y-6">
      <TBrand />
      <TStepHead title="What should the reel explain?" help="A question works best: “How does a UPI Soundbox know the money arrived?”" />
      <textarea aria-label="Topic" className="field min-h-[120px] text-base" maxLength={500} placeholder="Type or dictate the question" value={topic} onChange={(e) => setTopic(e.target.value)} />
      <div>
        <div className="mb-2 font-mono text-xs uppercase tracking-[0.14em] text-ink-400">length</div>
        <div className="flex flex-wrap gap-2">
          {LENGTHS.map((s) => (
            <button key={s} type="button" aria-pressed={duration === s} onClick={() => setDuration(s)} className={cn('min-h-[44px] rounded-xl border px-4 font-mono text-sm', duration === s ? 'border-mint-500 bg-mint-500/15 text-ink-100' : 'border-line/15 text-ink-300')}>
              {s}s
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-2 font-mono text-xs uppercase tracking-[0.14em] text-ink-400">for</div>
        <div className="flex flex-wrap gap-2">
          {(['instagram', 'youtube'] as const).map((pl) => (
            <button key={pl} type="button" aria-pressed={platforms.includes(pl)} onClick={() => toggle(pl)} className={cn('min-h-[44px] rounded-xl border px-4 text-sm font-semibold', platforms.includes(pl) ? 'border-mint-500 bg-mint-500/15 text-ink-100' : 'border-line/15 text-ink-300')}>
              {PLATFORMS[pl].label}
            </button>
          ))}
        </div>
      </div>
      {error && <TNote tone="error">{error}</TNote>}
      <TButton main busy={busy} disabled={!topic.trim()} onClick={() => void create()}>
        Create reel
      </TButton>
      <Link to="/t" className="block text-center text-sm text-ink-400">
        Cancel
      </Link>
    </div>
  );
});
