import { useMemo, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Download, Image as ImageIcon } from 'lucide-react';
import { exportFileName, normalizeCover, type Project } from '@motionmind/shared';
import { useStores } from '../stores/RootStore';
import { config } from '../config';
import { Alert, Button, Card } from './ui';
import { errorText } from '../lib/format';
import { log } from '../lib/logger';
import { cn } from '../lib/cn';

const inputCls = 'w-full rounded-lg border border-line/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-accent';

/**
 * The cover (thumbnail): a frame of Claude's own animation, taken late in the scene you pick, once everything
 * in it has come in. Rendered on this machine by HyperFrames, the same way as the video.
 */
export const CoverMaker = observer(function CoverMaker({ project }: { project: Project }) {
  const { services, auth, projects } = useStores();
  const api = services.claude(() => auth.session?.accessToken ?? null);
  const script = project.script!;
  const saved = useMemo(() => normalizeCover(script.cover, script), [script]);
  const [scene, setScene] = useState(saved.scene);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);

  async function make() {
    setBusy(true);
    setError(null);
    try {
      const cover = { ...saved, scene };
      projects.upsert(await api.saveCover(project.id, cover));
      const r = await api.renderCover(project.id, cover);
      setUrl(`${config.apiUrl}${r.url}`);
      log.info('cover', 'Cover made', { projectId: project.id, scene });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <h2 className="flex items-center gap-2 font-semibold">
        <ImageIcon className="h-4 w-4 text-accent" /> Cover
      </h2>
      <p className="mt-1 text-sm text-ink-400">A frame of your animation as the reel's cover. Pick the scene that sums up the reel best.</p>
      {!script.animation ? (
        <div className="mt-3">
          <Alert tone="info">Make the animation first, on the Animate step.</Alert>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="block text-xs text-ink-400">
            Scene
            <select aria-label="Scene" className={cn(inputCls, 'mt-1 min-w-[260px]')} value={scene} onChange={(e) => setScene(Number(e.target.value))}>
              {script.beats.map((b, i) => (
                <option key={b.id} value={i}>
                  {i + 1}. {b.card.headline.replace(/\*/g, '')}
                </option>
              ))}
            </select>
          </label>
          <Button loading={busy} onClick={() => void make()}>
            Make the cover
          </Button>
          {url && (
            <a className="inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline" href={`${url}?name=${encodeURIComponent(exportFileName(script.title, null, 'png'))}`}>
              <Download className="h-4 w-4" /> Download PNG
            </a>
          )}
        </div>
      )}
      {busy && <p className="mt-3 text-sm text-ink-400">Taking the picture with HyperFrames. This takes about half a minute.</p>}
      {error && <div className="mt-3"><Alert>{error}</Alert></div>}
      {url && <img src={url} alt="Reel cover" className="mt-4 w-48 rounded-xl border border-line/10" />}
    </Card>
  );
});
