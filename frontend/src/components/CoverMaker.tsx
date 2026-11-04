import { lazy, Suspense, useMemo, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Download, Image as ImageIcon, Save } from 'lucide-react';
import { COVER_SIZES, COVER_STYLES, MAX_HEADLINE, MAX_KICKER, normalizeCover, type CoverSettings, type CoverSize, type CoverStyle, type Project, type ReelTone } from '@motionmind/shared';
import { useStores } from '../stores/RootStore';
import { config } from '../config';
import { Alert, Button, Card, Spinner } from './ui';
import { brandFor, specFromScript } from './reelSpec';
import { errorText } from '../lib/format';
import { log } from '../lib/logger';
import { cn } from '../lib/cn';
import type { CoverSpec } from '@motionmind/reel-engine';

const CoverPreview = lazy(() => import('./CoverPreview'));

const STYLE_LABELS: Record<CoverStyle, string> = { bold: 'Bold text', center: 'Card', split: 'Top panel' };
const TONES: { id: ReelTone | null; label: string; swatch: string }[] = [
  { id: null, label: 'Scene colour', swatch: 'bg-gradient-to-br from-mint-400 to-sky-400' },
  { id: 'teal', label: 'Teal', swatch: 'bg-[#14B8A6]' },
  { id: 'blue', label: 'Blue', swatch: 'bg-[#3B82F6]' },
  { id: 'purple', label: 'Purple', swatch: 'bg-[#8B5CF6]' },
  { id: 'amber', label: 'Amber', swatch: 'bg-[#F59E0B]' },
  { id: 'red', label: 'Red', swatch: 'bg-[#E5484D]' },
];
const inputCls = 'w-full rounded-lg border border-line/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-accent';

/** Where Instagram crops a 9:16 cover for the profile grid (4:5) and for a square, as fractions of the height. */
const GUIDES = [
  { label: '4:5 grid', top: (1920 - 1350) / 2 / 1920, height: 1350 / 1920 },
  { label: '1:1', top: (1920 - 1080) / 2 / 1920, height: 1080 / 1920 },
];

function Seg<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { id: T; text: string }[]; onChange: (v: T) => void }) {
  return (
    <div role="group" aria-label={label}>
      <div className="mb-1 text-xs text-ink-400">{label}</div>
      <div className="inline-flex flex-wrap gap-1 rounded-lg bg-ink-700/70 p-1 text-sm">
        {options.map((o) => (
          <button key={o.id} type="button" aria-pressed={value === o.id} onClick={() => onChange(o.id)} className={cn('rounded-md px-3 py-1.5 font-medium transition', value === o.id ? 'bg-ink-900 text-ink-100 shadow-sm' : 'text-ink-400 hover:text-ink-100')}>
            {o.text}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * The cover (thumbnail) maker: pick a scene of the 3D world, write the headline, choose a layout and size,
 * see it live, and download it as an image rendered by the same engine as the video.
 */
export const CoverMaker = observer(function CoverMaker({ project }: { project: Project }) {
  const { services, auth, profile, projects, toasts } = useStores();
  const api = services.claude(() => auth.session?.accessToken ?? null);
  const script = project.script!;
  const saved = useMemo(() => normalizeCover(script.cover, script), [script]);
  const [cover, setCover] = useState<CoverSettings>(saved);
  const [guides, setGuides] = useState(false);
  const [busy, setBusy] = useState<'save' | 'png' | 'jpeg' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const dirty = JSON.stringify(cover) !== JSON.stringify(saved);
  const set = (p: Partial<CoverSettings>) => setCover((c) => ({ ...c, ...p }));

  const spec = useMemo(() => ({ ...specFromScript(script, brandFor(profile.profile)), cover: { ...cover, tone: cover.tone ?? null } }) as unknown as CoverSpec, [script, profile.profile, cover]);

  async function save() {
    setBusy('save');
    setError(null);
    try {
      projects.upsert(await api.saveCover(project.id, cover));
      toasts.push('success', 'Cover settings saved.');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  async function download(format: 'png' | 'jpeg') {
    setBusy(format);
    setError(null);
    try {
      const r = await api.renderCover(project.id, cover, format);
      const a = document.createElement('a');
      a.href = `${config.apiUrl}${r.url}`;
      a.download = `${project.title.slice(0, 40) || 'cover'}-cover.${format === 'jpeg' ? 'jpg' : 'png'}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      log.info('cover', 'Cover rendered', { projectId: project.id, style: cover.style, size: cover.size, format });
      toasts.push('success', 'Cover ready. Your download should start.');
    } catch (e) {
      const msg = errorText(e);
      if (/runs on your PC/.test(msg)) setUnavailable(true);
      setError(msg);
    } finally {
      setBusy(null);
    }
  }

  const dims = COVER_SIZES[cover.size];
  return (
    <Card>
      <h2 className="flex items-center gap-2 font-semibold">
        <ImageIcon className="h-4 w-4 text-accent" /> Cover image
      </h2>
      <p className="mt-1 text-sm text-ink-400">One scene of your 3D world with a big headline: a thumbnail for the reel, the profile grid or a post.</p>

      <div className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
        <div className="space-y-4">
          <label className="block text-xs text-ink-400">
            Headline (wrap words in *stars* to highlight them)
            <textarea aria-label="Headline" rows={2} maxLength={MAX_HEADLINE} className={cn(inputCls, 'mt-1 resize-none text-base font-semibold')} value={cover.headline} onChange={(e) => set({ headline: e.target.value })} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs text-ink-400">
              Small label
              <input aria-label="Small label" maxLength={MAX_KICKER} className={cn(inputCls, 'mt-1')} value={cover.kicker} onChange={(e) => set({ kicker: e.target.value })} />
            </label>
            <label className="block text-xs text-ink-400">
              Picture from
              <select aria-label="Scene" className={cn(inputCls, 'mt-1')} value={cover.scene} onChange={(e) => set({ scene: Number(e.target.value) })}>
                {script.beats.map((b, i) => (
                  <option key={b.id} value={i}>
                    Scene {i + 1} · {b.card.eyebrow}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <Seg<CoverStyle> label="Layout" value={cover.style} options={COVER_STYLES.map((s) => ({ id: s, text: STYLE_LABELS[s] }))} onChange={(style) => set({ style })} />
          <Seg<CoverSize> label="Size" value={cover.size} options={(Object.keys(COVER_SIZES) as CoverSize[]).map((s) => ({ id: s, text: COVER_SIZES[s].label }))} onChange={(size) => set({ size })} />
          <div>
            <div className="mb-1 text-xs text-ink-400">Highlight colour</div>
            <div className="flex flex-wrap items-center gap-2">
              {TONES.map((t) => (
                <button
                  key={t.label}
                  type="button"
                  aria-label={t.label}
                  aria-pressed={(cover.tone ?? null) === t.id}
                  title={t.label}
                  onClick={() => set({ tone: t.id })}
                  className={cn('h-7 w-7 rounded-full border-2', t.swatch, (cover.tone ?? null) === t.id ? 'border-ink-100' : 'border-transparent')}
                />
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-5 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={cover.brand} onChange={(e) => set({ brand: e.target.checked })} /> Show the channel name and handle
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={guides} onChange={(e) => setGuides(e.target.checked)} /> Show Instagram crop guides
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-line/[0.08] pt-4">
            <Button loading={busy === 'png'} disabled={busy !== null || unavailable} icon={<Download className="h-4 w-4" />} onClick={() => void download('png')}>
              Download PNG
            </Button>
            <Button variant="secondary" loading={busy === 'jpeg'} disabled={busy !== null || unavailable} icon={<Download className="h-4 w-4" />} onClick={() => void download('jpeg')}>
              Download JPG
            </Button>
            <Button variant="ghost" loading={busy === 'save'} disabled={!dirty || busy !== null} icon={<Save className="h-4 w-4" />} onClick={() => void save()}>
              {dirty ? 'Save settings' : 'Saved'}
            </Button>
            <span className="text-xs text-ink-400">
              {dims.width} × {dims.height}
            </span>
          </div>
          {busy === 'png' || busy === 'jpeg' ? <p className="text-sm text-ink-400">Making the image. The first one takes longer while the engine gets ready.</p> : null}
          {unavailable && <Alert tone="info">Making the image runs on your PC. Open Motion Mind from your computer with npm run dev.</Alert>}
          {error && !unavailable && <Alert>{error}</Alert>}
        </div>

        <div>
          <div className="relative overflow-hidden rounded-xl border border-line/10 bg-ink-800 shadow-soft">
            <Suspense fallback={<div className="p-6"><Spinner label="Drawing the cover" /></div>}>
              <CoverPreview spec={spec} />
            </Suspense>
            {guides && cover.size === 'reel' && GUIDES.map((g) => (
              <div key={g.label} className="pointer-events-none absolute left-0 right-0 border-y-2 border-dashed border-rose-500/80" style={{ top: `${g.top * 100}%`, height: `${g.height * 100}%` }}>
                <span className="absolute left-2 top-1 rounded bg-rose-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">{g.label}</span>
              </div>
            ))}
          </div>
          {guides && cover.size !== 'reel' && <p className="mt-2 text-xs text-ink-400">Crop guides are for the 9:16 cover. This size is already cropped.</p>}
        </div>
      </div>
    </Card>
  );
});
