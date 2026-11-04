import { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Link, useOutletContext } from 'react-router-dom';
import { Download, Film, Clapperboard } from 'lucide-react';
import { PLATFORMS, normalizePlatforms, type Platform, type Project } from '@motionmind/shared';
import { useStores } from '../../stores/RootStore';
import { EmptyState } from '../../components/EmptyState';
import { PlatformIcon } from '../../components/BrandIcons';
import { CoverMaker } from '../../components/CoverMaker';
import { config } from '../../config';
import { Alert, Button, Card, Spinner } from '../../components/ui';
import { errorText } from '../../lib/format';
import { log } from '../../lib/logger';
import type { RenderJob } from '../../services/claudeHttp';

const POLL_MS = 2000;

const isRunning = (j: RenderJob | null | undefined) => j?.status === 'bundling' || j?.status === 'rendering';

/** One platform's export: its own button, progress, preview and download. */
function PlatformCard({ platform, project, job, withVoice, available, onStart }: { platform: Platform; project: Project; job: RenderJob | null; withVoice: boolean | null; available: boolean | null; onStart: () => void }) {
  const meta = PLATFORMS[platform];
  const several = normalizePlatforms(project.platforms).length > 1;
  const running = isRunning(job);
  const videoUrl = job?.status === 'done' && job.file ? `${config.apiUrl}/api/renders/${job.file}` : null;
  const label = job?.status === 'done' ? (several ? `Export ${meta.short} again` : 'Export again') : several ? `Export for ${meta.short}` : 'Export MP4';
  return (
    <Card>
      <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_200px]">
        <div>
          <h3 className="flex items-center gap-2 font-semibold">
            <PlatformIcon platform={platform} className="h-5 w-5" /> {meta.label}
          </h3>
          <p className="mt-1 text-sm text-ink-400">
            1080 × 1920 H.264 MP4 at 30 fps. {platform === 'youtube' ? 'Text keeps clear of the Shorts title and buttons, and the end card says subscribe.' : 'The end card says follow.'} Uses the voiceover if it matches the script.
          </p>
          {available && (
            <div className="mt-4">
              <Button icon={<Film className="h-4 w-4" />} loading={running} disabled={running} onClick={onStart}>
                {label}
              </Button>
              {running && (
                <div className="mt-4">
                  <div className="h-2 overflow-hidden rounded-full bg-line/10" role="progressbar" aria-label={`${meta.short} progress`} aria-valuenow={Math.round((job?.progress ?? 0) * 100)} aria-valuemin={0} aria-valuemax={100}>
                    <div className="bar-live h-full rounded-full transition-all duration-500" style={{ width: `${Math.round((job?.progress ?? 0) * 100)}%` }} />
                  </div>
                  <p className="mt-2 text-sm text-ink-400">
                    {job?.status === 'bundling' ? 'Preparing the engine. The very first export also downloads a headless Chrome, which takes a few minutes.' : `Rendering… ${Math.round((job?.progress ?? 0) * 100)}%`}
                  </p>
                </div>
              )}
              {withVoice === false && running && <p className="mt-2 text-xs text-amber-700">No matching voiceover, so this export is silent. Make the voiceover on the Voice tab first if you want sound.</p>}
              {job?.status === 'failed' && (
                <div className="mt-4">
                  <Alert>
                    The render failed: {job.error}{' '}
                    <Link to="/app/settings/diagnostics" className="font-semibold underline">
                      See the log
                    </Link>
                  </Alert>
                </div>
              )}
            </div>
          )}
        </div>
        <div>
          {videoUrl ? (
            <div className="space-y-3">
              <video src={videoUrl} controls className="aspect-[9/16] w-full rounded-2xl border border-line/10 bg-black" />
              <a href={videoUrl} download={`${project.title.slice(0, 40) || 'reel'}-${platform === 'youtube' ? 'shorts' : 'instagram'}.mp4`} className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-ink-950">
                <Download className="h-4 w-4" /> Download MP4
              </a>
            </div>
          ) : (
            <div className="flex aspect-[9/16] items-center justify-center rounded-2xl border border-dashed border-line/15 p-4 text-center text-sm text-ink-400">The finished video shows here.</div>
          )}
        </div>
      </div>
    </Card>
  );
}

/** Export stage: renders the final 1080x1920 MP4 for each chosen platform with Remotion on the machine running the API. */
export const ExportStagePage = observer(function ExportStagePage() {
  const project = useOutletContext<Project>();
  const { services, auth } = useStores();
  const api = services.claude(() => auth.session?.accessToken ?? null);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [jobs, setJobs] = useState<Partial<Record<Platform, RenderJob | null>>>({});
  const [withVoice, setWithVoice] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const platforms = normalizePlatforms(project.platforms);
  const running = platforms.some((p) => isRunning(jobs[p]));

  async function poll() {
    try {
      const res = await api.exportStatus(project.id);
      setAvailable(res.available);
      setJobs(res.jobs ?? { [platforms[0]!]: res.job });
      for (const p of platforms) {
        const j = res.jobs?.[p] ?? (p === platforms[0] ? res.job : null);
        if (j?.status === 'done') log.info('export', 'MP4 ready', { projectId: project.id, platform: p });
        if (j?.status === 'failed') log.error('export', `Render failed: ${j.error}`, { projectId: project.id, platform: p });
      }
    } catch (e) {
      setError(errorText(e));
    }
  }

  useEffect(() => {
    void poll();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  useEffect(() => {
    if (!running) return;
    timer.current = setTimeout(() => void poll(), POLL_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs, running]);

  async function start(platform: Platform) {
    setError(null);
    try {
      const res = await api.startExport(project.id, platform);
      setJobs((j) => ({ ...j, [platform]: res.job }));
      setWithVoice(res.withVoice);
      log.info('export', 'Render started', { projectId: project.id, withVoice: res.withVoice, platform });
    } catch (e) {
      setError(errorText(e));
    }
  }

  async function startAll() {
    for (const p of platforms) if (!isRunning(jobs[p])) await start(p);
  }

  if (!project.script) {
    return (
      <EmptyState icon={<Clapperboard className="h-6 w-6" />} title="No script yet" text="Write the script and give it a voice first. Then you can render the video here." to={`/app/projects/${project.id}/script`} action="Go to Script" />
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        {available === null && <Spinner label="Checking" />}
        {available === false && <Alert tone="info">Export runs on your PC for now. Open Motion Mind from your computer with npm run dev, then export here.</Alert>}
        {available && platforms.length > 1 && (
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-ink-400">This reel is for Instagram Reels and YouTube Shorts. Each gets its own video.</p>
              <Button variant="secondary" icon={<Film className="h-4 w-4" />} disabled={running} onClick={() => void startAll()}>
                Export both
              </Button>
            </div>
          </Card>
        )}
        <div className={platforms.length > 1 ? 'grid gap-4 2xl:grid-cols-2' : ''}>
          {platforms.map((p) => (
            <PlatformCard key={p} platform={p} project={project} job={jobs[p] ?? null} withVoice={withVoice} available={available} onStart={() => void start(p)} />
          ))}
        </div>
        {error && <Alert>{error}</Alert>}
      </div>
      <CoverMaker project={project} />
    </div>
  );
});
