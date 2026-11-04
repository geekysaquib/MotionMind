import { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Link, useOutletContext } from 'react-router-dom';
import { Download, Film, Clapperboard } from 'lucide-react';
import type { Project } from '@motionmind/shared';
import { useStores } from '../../stores/RootStore';
import { EmptyState } from '../../components/EmptyState';
import { CoverMaker } from '../../components/CoverMaker';
import { config } from '../../config';
import { Alert, Button, Card, Spinner } from '../../components/ui';
import { errorText } from '../../lib/format';
import { log } from '../../lib/logger';
import type { RenderJob } from '../../services/claudeHttp';

const POLL_MS = 2000;

/** Export stage: renders the final 1080x1920 MP4 with Remotion on the machine running the API. */
export const ExportStagePage = observer(function ExportStagePage() {
  const project = useOutletContext<Project>();
  const { services, auth } = useStores();
  const api = services.claude(() => auth.session?.accessToken ?? null);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [job, setJob] = useState<RenderJob | null>(null);
  const [withVoice, setWithVoice] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const running = job?.status === 'bundling' || job?.status === 'rendering';

  async function poll() {
    try {
      const res = await api.exportStatus(project.id);
      setAvailable(res.available);
      setJob(res.job);
      if (res.job?.status === 'done') log.info('export', 'MP4 ready', { projectId: project.id });
      if (res.job?.status === 'failed') log.error('export', `Render failed: ${res.job.error}`, { projectId: project.id });
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
  }, [job, running]);

  async function start() {
    setError(null);
    try {
      const res = await api.startExport(project.id);
      setJob(res.job);
      setWithVoice(res.withVoice);
      log.info('export', 'Render started', { projectId: project.id, withVoice: res.withVoice });
    } catch (e) {
      setError(errorText(e));
    }
  }

  if (!project.script) {
    return (
      <EmptyState icon={<Clapperboard className="h-6 w-6" />} title="No script yet" text="Write the script and give it a voice first. Then you can render the video here." to={`/app/projects/${project.id}/script`} action="Go to Script" />
    );
  }

  const videoUrl = job?.status === 'done' && job.file ? `${config.apiUrl}/api/renders/${job.file}` : null;

  return (
    <div className="space-y-8">
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
      <Card>
        <h2 className="flex items-center gap-2 font-semibold">
          <Film className="h-4 w-4 text-accent" /> Export the reel
        </h2>
        <p className="mt-1 text-sm text-ink-400">1080 × 1920 H.264 MP4 at 30 fps, ready for Instagram Reels. Uses the voiceover if it matches the script.</p>

        {available === null && <div className="mt-4"><Spinner label="Checking" /></div>}
        {available === false && (
          <div className="mt-4">
            <Alert tone="info">Export runs on your PC for now. Open Motion Mind from your computer with npm run dev, then export here.</Alert>
          </div>
        )}
        {available && (
          <div className="mt-5">
            <Button icon={<Film className="h-4 w-4" />} loading={running} disabled={running} onClick={() => void start()}>
              {job?.status === 'done' ? 'Export again' : 'Export MP4'}
            </Button>
            {running && (
              <div className="mt-4">
                <div className="h-2 overflow-hidden rounded-full bg-line/10" role="progressbar" aria-valuenow={Math.round((job?.progress ?? 0) * 100)} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-full bg-accent transition-all" style={{ width: `${Math.round((job?.progress ?? 0) * 100)}%` }} />
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
        {error && <div className="mt-4"><Alert>{error}</Alert></div>}
      </Card>

      <div>
        {videoUrl ? (
          <div className="space-y-3">
            <video src={videoUrl} controls className="aspect-[9/16] w-full rounded-2xl border border-line/10 bg-black" />
            <a href={videoUrl} download={`${project.title.slice(0, 40) || 'reel'}.mp4`} className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-ink-950">
              <Download className="h-4 w-4" /> Download MP4
            </a>
          </div>
        ) : (
          <div className="flex aspect-[9/16] items-center justify-center rounded-2xl border border-dashed border-line/15 p-6 text-center text-sm text-ink-400">
            The finished video shows here.
          </div>
        )}
      </div>
    </div>
    <CoverMaker project={project} />
    </div>
  );
});
