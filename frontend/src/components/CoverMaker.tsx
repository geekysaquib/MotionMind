import { useMemo, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Download, Image as ImageIcon } from 'lucide-react';
import { exportFileName, MAX_COVER_HEADLINE, normalizeCover, normalizePlatforms, PLATFORMS, type Platform, type Project } from '@motionmind/shared';
import { PlatformIcon } from './BrandIcons';
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
  const [headline, setHeadline] = useState(saved.headline ?? script.title);
  const [text, setText] = useState(saved.text !== false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // One cover per platform: each has its own layout, and is kept until it is made again.
  const platforms = normalizePlatforms(project.platforms);
  const [platform, setPlatform] = useState<Platform>(platforms[0]!);
  const active = platforms.includes(platform) ? platform : platforms[0]!;
  const [urls, setUrls] = useState<Partial<Record<Platform, string>>>({});
  const url = urls[active] ?? null;
  const ideas = script.post?.[active]?.covers ?? [];

  async function make() {
    setBusy(true);
    setError(null);
    try {
      const words = headline.trim();
      const cover = { scene, ...(words && words !== script.title ? { headline: words } : {}), ...(text ? {} : { text: false }) };
      projects.upsert(await api.saveCover(project.id, cover));
      const r = await api.renderCover(project.id, cover, active);
      setUrls((u) => ({ ...u, [active]: `${config.apiUrl}${r.url}` }));
      log.info('cover', 'Cover made', { projectId: project.id, scene, platform: active });
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
      <p className="mt-1 text-sm text-ink-400">A short hook set huge over a frame of your animation, with the key words highlighted, a badge and your handle. Pick the scene that sums up the reel best, and edit the words if you like. Put *stars* around words to colour them.</p>
      {!script.animation ? (
        <div className="mt-3">
          <Alert tone="info">Make the animation first, on the Animate step.</Alert>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-end gap-3">
          {platforms.length > 1 && (
            <div className="w-full">
              <div className="inline-flex gap-1 rounded-xl bg-line/[0.06] p-1" role="tablist" aria-label="Platform for the cover">
                {platforms.map((p) => (
                  <button
                    key={p}
                    type="button"
                    role="tab"
                    aria-selected={p === active}
                    onClick={() => setPlatform(p)}
                    className={cn('inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition', p === active ? 'bg-ink-900 text-ink-100 shadow-sm' : 'text-ink-400 hover:text-ink-100')}
                  >
                    <PlatformIcon platform={p} className="h-4 w-4" /> {PLATFORMS[p].label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <p className="w-full text-xs text-ink-400">
            {active === 'youtube'
              ? 'YouTube Shorts lays its own title and buttons over the bottom of the cover, so the words sit near the top.'
              : 'Instagram crops the cover to its middle on your profile grid, so the words sit in the middle band.'}
          </p>
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
          <label className="block min-w-[260px] flex-1 text-xs text-ink-400">
            Words on the cover
            <input aria-label="Words on the cover" className={cn(inputCls, 'mt-1')} maxLength={MAX_COVER_HEADLINE} disabled={!text} value={headline} onChange={(e) => setHeadline(e.target.value)} />
          </label>
          {ideas.length > 0 && text && (
            <div className="w-full">
              <span className="text-xs text-ink-400">Catchy lines from Claude (tap to use):</span>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {ideas.map((idea) => (
                  <button key={idea} type="button" onClick={() => setHeadline(idea)} className={cn('rounded-full border px-3 py-1.5 text-sm transition', headline === idea ? 'border-accent bg-mint-500/15 text-ink-100' : 'border-line/15 text-ink-300 hover:border-line/30')}>
                    {idea.replace(/\*/g, '')}
                  </button>
                ))}
              </div>
            </div>
          )}
          {ideas.length === 0 && text && <p className="w-full text-xs text-ink-400">Tip: make the caption and hashtags below first. Claude also writes three catchy cover lines, and they show up here to pick from.</p>}
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input type="checkbox" checked={text} onChange={(e) => setText(e.target.checked)} /> Show the words
          </label>
          <Button loading={busy} onClick={() => void make()}>
            {platforms.length > 1 ? `Make the ${PLATFORMS[active].short} cover` : 'Make the cover'}
          </Button>
          {url && (
            <a className="inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline" href={`${url}?name=${encodeURIComponent(exportFileName(`${script.title} cover`, active, 'png'))}`}>
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
