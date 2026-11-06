import { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, CircleAlert, Clapperboard, Scissors, Upload } from 'lucide-react';
import { FOOTAGE_LIMITS, keptRanges, rangesDuration } from '@motionmind/shared';
import { useStores } from '../../stores/RootStore';
import { Alert, Badge, Button, Card, Spinner } from '../../components/ui';
import { errorText, timeAgo } from '../../lib/format';
import { log } from '../../lib/logger';
import type { FootageTools, FootageView } from '../../services/footageHttp';

/** 74.3 -> "1:14" */
export function clock(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const TOOL_LABELS: { key: keyof FootageTools; name: string; use: string }[] = [
  { key: 'ffmpeg', name: 'FFmpeg', use: 'cuts the pauses and exports the reel' },
  { key: 'whisper', name: 'whisper.cpp', use: 'writes down the words for captions' },
  { key: 'ytDlp', name: 'yt-dlp', use: 'downloads reference videos (coming next)' },
];

function ToolsCard({ tools }: { tools: FootageTools }) {
  return (
    <Card>
      <h2 className="font-semibold">Tools on this computer</h2>
      <ul className="mt-3 space-y-2.5">
        {TOOL_LABELS.map(({ key, name, use }) => {
          const t = tools[key];
          return (
            <li key={key} className="flex items-start gap-2.5 text-sm">
              {t.ready ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-label="Ready" /> : <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-label="Not ready" />}
              <div className="min-w-0">
                <div>
                  <span className="font-semibold">{name}</span> <span className="text-ink-400">{use}</span>
                </div>
                <div className="truncate text-xs text-ink-400" title={t.detail}>
                  {t.detail}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function statusOf(v: FootageView): { label: string; tone: 'neutral' | 'mint' | 'coral' | 'amber' } {
  const { edit } = v;
  if (edit.job?.status === 'running') return { label: edit.job.kind === 'export' ? 'Exporting' : 'Analyzing', tone: 'amber' };
  if (edit.job?.status === 'failed') return { label: 'Needs attention', tone: 'coral' };
  if (edit.output) return { label: 'Exported', tone: 'mint' };
  if (edit.approvedAt) return { label: 'Approved', tone: 'mint' };
  return { label: 'Review the cut', tone: 'neutral' };
}

/** Edit raw footage: upload a clip you filmed, and Motion Mind cuts the pauses, adds captions and exports a reel. */
export const FootagePage = observer(function FootagePage() {
  const { services, auth } = useStores();
  const api = services.footage(() => auth.session?.accessToken ?? null);
  const nav = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  const [tools, setTools] = useState<FootageTools | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [edits, setEdits] = useState<FootageView[] | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .list()
      .then((r) => {
        if (!alive) return;
        setAvailable(r.available);
        setEdits(r.edits);
      })
      .catch((e) => alive && setError(errorText(e)));
    api
      .tools()
      .then((r) => alive && setTools(r.tools))
      .catch((e) => log.warn('footage', `Couldn't check the tools: ${errorText(e)}`));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function upload(file: File) {
    setError(null);
    if (file.size > FOOTAGE_LIMITS.maxBytes) {
      setError('That clip is over 1 GB. Trim it or export it smaller first.');
      return;
    }
    setUploading(file.name);
    log.info('footage', 'Uploading a raw clip', { bytes: file.size, type: file.type });
    try {
      const v = await api.upload(file, file.name);
      nav(`/app/footage/${v.edit.id}`);
    } catch (e) {
      setError(errorText(e));
      setUploading(null);
    }
  }

  const ffmpegMissing = tools && !tools.ffmpeg.ready;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold">
          <Scissors className="h-6 w-6 text-accent" /> Edit raw footage
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-400">
          Upload a clip you filmed. Motion Mind cuts every pause, writes captions from what you say, and shows you the cut as a storyboard. Approve it and the 1080 × 1920 reel is exported on this computer.
        </p>
      </div>

      {error && <Alert>{error}</Alert>}
      {available === false && <Alert tone="info">Raw footage editing runs on your PC: start Motion Mind with npm run dev.</Alert>}

      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <div
            className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-line/15 px-6 py-10 text-center"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              if (f) void upload(f);
            }}
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-mint-500/10 text-accent">
              <Clapperboard className="h-6 w-6" />
            </span>
            <h2 className="mt-3 font-semibold">{uploading ? `Uploading ${uploading}…` : 'Drop a raw clip here'}</h2>
            <p className="mt-1 text-sm text-ink-400">MP4, MOV, WebM, MKV or AVI, up to 1 GB and 20 minutes.</p>
            <input
              ref={input}
              type="file"
              accept="video/*,.mkv,.mov"
              className="hidden"
              aria-label="Choose a video"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload(f);
                e.target.value = '';
              }}
            />
            <Button className="mt-4" icon={<Upload className="h-4 w-4" />} loading={Boolean(uploading)} disabled={available === false || Boolean(ffmpegMissing)} onClick={() => input.current?.click()}>
              Choose a video
            </Button>
            {ffmpegMissing && <p className="mt-3 text-xs text-amber-700">FFmpeg isn't installed on this computer yet, so clips can't be cut.</p>}
          </div>
        </Card>
        {tools ? <ToolsCard tools={tools} /> : <Card><Spinner label="Checking the tools" /></Card>}
      </div>

      <section>
        <h2 className="mb-3 font-semibold">Your edits</h2>
        {edits === null ? (
          !error && <Spinner />
        ) : edits.length === 0 ? (
          <p className="text-sm text-ink-400">No clips yet. Upload one above.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {edits.map((v) => {
              const s = statusOf(v);
              const cut = rangesDuration(keptRanges(v.edit.segments));
              return (
                <li key={v.edit.id}>
                  <Link to={`/app/footage/${v.edit.id}`} className="card block p-4 transition hover:border-mint-500/40">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-semibold">{v.edit.name}</span>
                      <Badge tone={s.tone}>{s.label}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-ink-400">
                      {v.edit.source?.durationSec ? `${clock(v.edit.source.durationSec)} raw` : 'Reading the clip'}
                      {cut > 0 && ` → ${clock(cut)} cut`} · {timeAgo(v.edit.updatedAt)}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
});
