import { useEffect, useMemo, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Download, Film, Play, RefreshCw, Save, Trash2 } from 'lucide-react';
import {
  FOOTAGE_LIMITS,
  carryChoices,
  keptRanges,
  rangesDuration,
  speechSegments,
  wordsIn,
  type FootageSegment,
  type FootageSettings,
} from '@motionmind/shared';
import { useStores } from '../../stores/RootStore';
import { Alert, Badge, Button, Card, Spinner } from '../../components/ui';
import { config } from '../../config';
import { cn } from '../../lib/cn';
import { errorText } from '../../lib/format';
import { log } from '../../lib/logger';
import type { FootageView } from '../../services/footageHttp';
import { clock } from './FootagePage';

const POLL_MS = 1500;

const sec = (n: number) => `${n.toFixed(1)} s`;

/** The video plays only the kept takes: whenever it reaches a dropped stretch it jumps to the next kept one. */
function useCutPreview(video: React.RefObject<HTMLVideoElement>, segments: FootageSegment[], on: boolean) {
  const kept = useMemo(() => keptRanges(segments), [segments]);
  useEffect(() => {
    const el = video.current;
    if (!el || !on) return;
    const onTime = () => {
      const t = el.currentTime;
      if (kept.some((r) => t >= r.start && t < r.end - 0.02)) return;
      const next = kept.find((r) => r.start > t - 0.02);
      if (next) el.currentTime = next.start;
      else el.pause();
    };
    el.addEventListener('timeupdate', onTime);
    return () => el.removeEventListener('timeupdate', onTime);
  }, [video, kept, on]);
}

/** One edit: watch the clip, review the takes left after cutting the pauses, approve, export. */
export const FootageEditPage = observer(function FootageEditPage() {
  const { id = '' } = useParams();
  const { services, auth, toasts } = useStores();
  const api = services.footage(() => auth.session?.accessToken ?? null);
  const nav = useNavigate();
  const video = useRef<HTMLVideoElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [view, setView] = useState<FootageView | null>(null);
  const [segments, setSegments] = useState<FootageSegment[]>([]);
  const [settings, setSettings] = useState<FootageSettings | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewCut, setPreviewCut] = useState(true);

  const edit = view?.edit ?? null;
  const running = edit?.job?.status === 'running';

  /** Takes the server's copy; the page's own unsaved changes are kept unless `reset`. */
  function adopt(v: FootageView, reset: boolean) {
    setView(v);
    if (reset || !dirty) {
      setSegments(v.edit.segments);
      setSettings(v.edit.settings);
      setDirty(false);
    }
  }

  async function poll(reset = false) {
    try {
      adopt(await api.get(id), reset);
    } catch (e) {
      setError(errorText(e));
    }
  }

  useEffect(() => {
    void poll(true);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // While a job runs, follow it; when it finishes, take its result.
  useEffect(() => {
    if (!running) return;
    timer.current = setTimeout(() => void poll(true), POLL_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, running]);

  useCutPreview(video, segments, previewCut);

  const kept = useMemo(() => keptRanges(segments), [segments]);
  const cutLength = rangesDuration(kept);

  function change(next: Partial<FootageSettings>) {
    if (!settings || !edit) return;
    const merged = { ...settings, ...next };
    setSettings(merged);
    // A new pause length or pad re-cuts at once from the pauses FFmpeg already found.
    if ((next.minPause !== undefined || next.padSec !== undefined) && edit.silences && edit.source) {
      setSegments(carryChoices(speechSegments(edit.silences, edit.source.durationSec, merged), segments));
    }
    setDirty(true);
  }

  function toggle(i: number) {
    setSegments(segments.map((s, j) => (j === i ? { ...s, keep: !s.keep } : s)));
    setDirty(true);
  }

  function play(s: FootageSegment) {
    const el = video.current;
    if (!el) return;
    el.currentTime = s.start;
    void el.play().catch(() => undefined);
  }

  async function save(approved: boolean) {
    if (!settings) return;
    setBusy(approved ? 'approve' : 'save');
    setError(null);
    try {
      const v = await api.save(id, { settings: { minPause: settings.minPause, padSec: settings.padSec, captions: settings.captions, captionPosition: settings.captionPosition }, segments, approved });
      adopt(v, true);
      log.info('footage', approved ? 'Storyboard approved' : 'Edit saved', { editId: id, takes: segments.filter((s) => s.keep).length });
      if (!approved) toasts.push('success', 'Saved.');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  async function run(kind: 'analyze' | 'retranscribe' | 'export', noiseDb?: number) {
    setBusy(kind);
    setError(null);
    try {
      const v = kind === 'export' ? await api.exportReel(id) : await api.analyze(id, { noiseDb, retranscribe: kind === 'retranscribe' });
      adopt(v, true);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!window.confirm('Delete this edit, its clip and its exports from this computer?')) return;
    try {
      await api.remove(id);
      nav('/app/footage');
    } catch (e) {
      setError(errorText(e));
    }
  }

  if (!view || !edit || !settings) {
    return <div className="p-8">{error ? <Alert>{error}</Alert> : <Spinner />}</div>;
  }

  const src = view.sourceUrl ? `${config.apiUrl}${view.sourceUrl}` : null;
  const out = view.outputUrl ? `${config.apiUrl}${view.outputUrl}` : null;
  const approved = Boolean(edit.approvedAt) && !dirty;
  const analyzed = Boolean(edit.silences);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to="/app/footage" className="inline-flex items-center gap-1 text-sm text-ink-400 hover:text-ink-100">
            <ArrowLeft className="h-4 w-4" /> Raw footage
          </Link>
          <h1 className="mt-1 truncate font-display text-2xl font-bold">{edit.name}</h1>
          <p className="text-sm text-ink-400">
            {edit.source?.durationSec ? `${clock(edit.source.durationSec)} raw · ${edit.source.width} × ${edit.source.height}` : 'Reading the clip'}
            {analyzed && ` · ${clock(cutLength)} after the cut, ${segments.filter((s) => s.keep).length} takes`}
          </p>
        </div>
        <Button variant="ghost" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={() => void remove()} disabled={running}>
          Delete
        </Button>
      </div>

      {error && <Alert>{error}</Alert>}
      {running && (
        <Card>
          <div className="h-2 overflow-hidden rounded-full bg-line/10" role="progressbar" aria-label="Progress" aria-valuenow={Math.round((edit.job?.progress ?? 0) * 100)} aria-valuemin={0} aria-valuemax={100}>
            <div className="bar-live h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(4, Math.round((edit.job?.progress ?? 0) * 100))}%` }} />
          </div>
          <p className="mt-2 text-sm text-ink-400">{edit.job?.step}…</p>
        </Card>
      )}
      {edit.job?.status === 'failed' && (
        <Alert>
          {edit.job.kind === 'export' ? 'The export failed' : 'The analysis failed'}: {edit.job.error}{' '}
          <Link to="/app/settings/diagnostics" className="font-semibold underline">
            See the log
          </Link>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="space-y-4">
          {src ? (
            <video ref={video} src={src} controls playsInline className="aspect-[9/16] w-full rounded-2xl border border-line/10 bg-black object-contain" />
          ) : (
            <div className="flex aspect-[9/16] items-center justify-center rounded-2xl border border-dashed border-line/15 text-sm text-ink-400">Reading the clip…</div>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={previewCut} onChange={(e) => setPreviewCut(e.target.checked)} />
            Play only the kept takes
          </label>

          <Card>
            <h2 className="font-semibold">Cut</h2>
            <label className="mt-3 block text-sm">
              <span className="flex justify-between">
                <span>Cut pauses longer than</span> <span className="font-semibold">{sec(settings.minPause)}</span>
              </span>
              <input type="range" className="w-full" aria-label="Shortest pause to cut" min={FOOTAGE_LIMITS.minPause[0]} max={FOOTAGE_LIMITS.minPause[1]} step={0.05} value={settings.minPause} disabled={!analyzed || running} onChange={(e) => change({ minPause: Number(e.target.value) })} />
            </label>
            <label className="mt-2 block text-sm">
              <span className="flex justify-between">
                <span>Breathing room at each cut</span> <span className="font-semibold">{sec(settings.padSec)}</span>
              </span>
              <input type="range" className="w-full" aria-label="Breathing room" min={FOOTAGE_LIMITS.padSec[0]} max={FOOTAGE_LIMITS.padSec[1]} step={0.01} value={settings.padSec} disabled={!analyzed || running} onChange={(e) => change({ padSec: Number(e.target.value) })} />
            </label>
            <label className="mt-2 block text-sm">
              <span>What counts as silence</span>
              <select
                className="mt-1 w-full rounded-lg border border-line/15 bg-ink-900 px-2 py-1.5 text-sm"
                aria-label="What counts as silence"
                value={settings.noiseDb}
                disabled={running}
                onChange={(e) => void run('analyze', Number(e.target.value))}
              >
                <option value={-45}>Very quiet room (-45 dB)</option>
                <option value={-35}>Normal (-35 dB)</option>
                <option value={-28}>Some background noise (-28 dB)</option>
                <option value={-22}>Noisy place (-22 dB)</option>
              </select>
              <span className="mt-1 block text-xs text-ink-400">Changing this finds the pauses again.</span>
            </label>
          </Card>

          <Card>
            <h2 className="font-semibold">Captions</h2>
            {edit.words ? (
              <>
                <label className="mt-3 flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={settings.captions} disabled={running} onChange={(e) => change({ captions: e.target.checked })} />
                  Burn in word-by-word captions
                </label>
                <div className="mt-2 flex gap-2" role="group" aria-label="Caption position">
                  {(['lower', 'middle'] as const).map((p) => (
                    <button key={p} type="button" disabled={running || !settings.captions} onClick={() => change({ captionPosition: p })} className={cn('rounded-lg border px-3 py-1 text-sm', settings.captionPosition === p ? 'border-mint-500 bg-mint-500/10 font-semibold' : 'border-line/15')}>
                      {p === 'lower' ? 'Lower third' : 'Middle'}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="mt-2 text-sm text-ink-400">{edit.transcriptNote ?? 'The words are being written down.'}</p>
            )}
            {analyzed && edit.source?.hasAudio && (
              <Button className="mt-3" size="sm" variant="secondary" icon={<RefreshCw className="h-3.5 w-3.5" />} disabled={running} loading={busy === 'retranscribe'} onClick={() => void run('retranscribe')}>
                {edit.words ? 'Write the words again' : 'Try again'}
              </Button>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">Storyboard</h2>
                <p className="text-sm text-ink-400">Every take left after the pauses are cut. Untick any take you don't want, then approve.</p>
              </div>
              {approved ? <Badge tone="mint">Approved</Badge> : dirty ? <Badge tone="amber">Unsaved changes</Badge> : null}
            </div>

            {!analyzed ? (
              <div className="mt-6">{running ? <Spinner label="Finding the pauses" /> : <p className="text-sm text-ink-400">No analysis yet.</p>}</div>
            ) : (
              <ol className="mt-4 space-y-2">
                {segments.map((s, i) => {
                  const words = wordsIn(edit.words, s);
                  return (
                    <li key={`${s.start}-${s.end}`} className={cn('flex items-start gap-3 rounded-xl border p-3 transition', s.keep ? 'border-line/10 bg-ink-900' : 'border-dashed border-line/10 opacity-50')}>
                      <input type="checkbox" className="mt-1" checked={s.keep} disabled={running} onChange={() => toggle(i)} aria-label={`Keep take ${i + 1}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-xs text-ink-400">
                          <span className="font-semibold text-ink-100">Take {i + 1}</span>
                          <span>
                            {clock(s.start)}–{clock(s.end)} · {sec(s.end - s.start)}
                          </span>
                        </div>
                        {edit.words && <p className={cn('mt-0.5 text-sm', !s.keep && 'line-through')}>{words || <span className="text-ink-400">No words in this take.</span>}</p>}
                      </div>
                      <button type="button" className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-800 hover:text-ink-100" onClick={() => play(s)} aria-label={`Play take ${i + 1}`}>
                        <Play className="h-4 w-4" />
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}

            {analyzed && (
              <div className="mt-4 flex flex-wrap gap-2 border-t border-line/10 pt-4">
                <Button variant="secondary" icon={<Save className="h-4 w-4" />} disabled={!dirty || running} loading={busy === 'save'} onClick={() => void save(false)}>
                  Save
                </Button>
                <Button icon={<Check className="h-4 w-4" />} disabled={approved || running || !kept.length} loading={busy === 'approve'} onClick={() => void save(true)}>
                  Approve storyboard
                </Button>
                <Button variant="dark" icon={<Film className="h-4 w-4" />} disabled={!approved || running} loading={busy === 'export'} onClick={() => void run('export')}>
                  {edit.output ? 'Export again' : 'Export reel'}
                </Button>
              </div>
            )}
          </Card>

          {out && (
            <Card>
              <div className="grid gap-4 sm:grid-cols-[200px_minmax(0,1fr)]">
                <video src={out} controls playsInline className="aspect-[9/16] w-full rounded-2xl border border-line/10 bg-black" />
                <div>
                  <h2 className="font-semibold">Your reel</h2>
                  <p className="mt-1 text-sm text-ink-400">
                    1080 × 1920 H.264 MP4 at 30 fps, {clock(edit.output!.durationSec)} long{edit.settings.captions && edit.words ? ', with captions' : ''}. Sound levelled for Instagram.
                  </p>
                  <a href={`${out}?download`} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-ink-950">
                    <Download className="h-4 w-4" /> Download MP4
                  </a>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
});

