import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Link, useOutletContext } from 'react-router-dom';
import { Clapperboard, Music2, Type, Upload } from 'lucide-react';
import {
  autoCuts,
  clampPace,
  DEFAULT_CAPTIONS,
  normalizeEditor,
  PACE_MAX,
  PACE_MIN,
  sceneBounds,
  type CaptionStyle,
  type Project,
  type ReelEditor,
  type ReelScript,
} from '@motionmind/shared';
import { useStores } from '../../stores/RootStore';
import { Alert, Badge, Button, Card, Spinner } from '../../components/ui';
import { Timeline } from '../../components/Timeline';
import { errorText } from '../../lib/format';
import { log } from '../../lib/logger';
import { attachMusic, attachVoice, AudioFileError } from '../../lib/editorActions';
import type { EditorUrls } from '../../services/claudeHttp';
import { brandFor, specFromScript } from '../../components/reelSpec';

const ReelPreview = lazy(() => import('../../components/ReelPreview'));

const input = 'mt-1 block w-full rounded-lg border border-line/15 bg-transparent px-3 py-2 text-sm text-ink-100';

function Seg<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { id: T; text: string }[]; onChange: (v: T) => void }) {
  return (
    <div>
      <div className="text-xs text-ink-400">{label}</div>
      <div className="mt-1 inline-flex rounded-lg border border-line/15 p-0.5" role="group" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            aria-pressed={value === o.id}
            onClick={() => onChange(o.id)}
            className={`rounded-md px-3 py-1 text-sm ${value === o.id ? 'bg-accent text-white' : 'text-ink-400 hover:text-ink-100'}`}
          >
            {o.text}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Reel editor: manage the voice (upload, scene breaks, pace), the words on screen, music and captions, with a live preview. */
export const ReelEditorPage = observer(function ReelEditorPage() {
  const project = useOutletContext<Project>();
  const { projects, profile, services, auth, toasts, aiMode } = useStores();
  const api = services.claude(() => auth.session?.accessToken ?? null);
  const [draft, setDraft] = useState<ReelEditor>(() => normalizeEditor(project.editor, Boolean(project.voice)));
  const [script, setScript] = useState<ReelScript | null>(project.script);
  const [urls, setUrls] = useState<EditorUrls | null>(null);
  const [scene, setScene] = useState(0);
  const [busy, setBusy] = useState<'save' | 'voice' | 'music' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elevenAudio, setElevenAudio] = useState<{ voice: Project['voice']; urls: string[]; stale: boolean } | null>(null);
  const voiceFile = useRef<HTMLInputElement>(null);
  const musicFile = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api
      .editorFor(project.id)
      .then((r) => setUrls(r.urls))
      .catch((e) => {
        setUrls({});
        setError(errorText(e));
      });
    if (project.voice) {
      api
        .voiceFor(project.id)
        .then(setElevenAudio)
        .catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  const saved = useMemo(() => JSON.stringify([normalizeEditor(project.editor, Boolean(project.voice)), project.script]), [project.editor, project.script, project.voice]);
  const dirty = JSON.stringify([draft, script]) !== saved;
  const beats = script?.beats ?? [];
  const upload = draft.upload;
  const mismatch = Boolean(upload && beats.length > 0 && upload.cuts.length !== beats.length - 1);

  const spec = useMemo(
    () =>
      script && urls
        ? specFromScript(script, brandFor(profile.profile), elevenAudio?.voice && !elevenAudio.stale ? { voice: elevenAudio.voice, urls: elevenAudio.urls } : undefined, { editor: mismatch ? { ...draft, upload: null } : draft, urls })
        : null,
    [script, urls, draft, mismatch, profile.profile, elevenAudio],
  );

  if (!script) {
    return (
      <Card>
        <h2 className="font-semibold">Reel editor</h2>
        <p className="mt-2 text-sm text-ink-400">
          Write the script first.{' '}
          <Link to={`/app/projects/${project.id}/script`} className="text-accent hover:underline">
            Go to Script
          </Link>
        </p>
      </Card>
    );
  }

  const patch = (p: Partial<ReelEditor>) => setDraft((d) => ({ ...d, ...p }));
  const setBeat = (i: number, f: (b: ReelScript['beats'][number]) => ReelScript['beats'][number]) =>
    setScript((s) => (s ? { ...s, beats: s.beats.map((b, j) => (j === i ? f(b) : b)) } : s));
  const scenePace = (i: number) => draft.scenePace[i] ?? 1;
  const setScenePace = (i: number, v: number) =>
    patch({ scenePace: Array.from({ length: beats.length }, (_, j) => (j === i ? clampPace(v) : draft.scenePace[j] ?? 1)) });
  const bounds = upload ? sceneBounds(upload.cuts, upload.track.durationSec) : [];
  const total = bounds.reduce((n, b, i) => n + (b.end - b.start) / (clampPace(draft.pace) * scenePace(i)), 0);

  async function pick(kind: 'voice' | 'music', file: File | undefined) {
    if (!file) return;
    setBusy(kind);
    setError(null);
    try {
      const r = kind === 'voice' ? await attachVoice(api, { ...project, script }, file, draft) : await attachMusic(api, project, file, draft);
      projects.upsert(r.project);
      setDraft(r.editor);
      setUrls(r.urls);
      toasts.push('success', kind === 'voice' ? 'Voiceover uploaded. Check the scene breaks below.' : 'Music added.');
    } catch (e) {
      setError(e instanceof AudioFileError ? e.message : errorText(e));
    } finally {
      setBusy(null);
      if (voiceFile.current) voiceFile.current.value = '';
      if (musicFile.current) musicFile.current.value = '';
    }
  }

  function refit() {
    if (!upload || !script) return;
    const cuts = autoCuts(upload.track.peaks ?? [], upload.track.durationSec, script.beats.map((b) => b.narration));
    patch({ upload: { ...upload, cuts } });
    log.info('editor', 'Scene breaks refitted', { projectId: project.id, scenes: beats.length });
  }

  async function save() {
    setBusy('save');
    setError(null);
    try {
      let current = project;
      if (script && JSON.stringify(script) !== JSON.stringify(project.script)) {
        await projects.saveScript(project.id, script);
        current = projects.byId(project.id) ?? project;
      }
      const r = await api.saveEditor(project.id, draft);
      projects.upsert({ ...r.project, script: current.script ?? r.project.script });
      setDraft(r.project.editor ?? draft);
      setUrls(r.urls);
      toasts.push('success', 'Saved.');
      log.info('editor', 'Reel editor saved', { projectId: project.id });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  const b = beats[scene] ?? beats[0]!;
  const sceneIdx = Math.min(scene, beats.length - 1);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        {error && <Alert>{error}</Alert>}

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-semibold">
              <Clapperboard className="h-4 w-4 text-accent" /> Voice and pace
            </h2>
            {upload && <Badge tone="mint">Your recording</Badge>}
          </div>
          {!upload ? (
            <div className="mt-3 space-y-3 text-sm text-ink-400">
              <p>Upload your own voiceover (MP3, WAV or M4A, up to 5 minutes). One file for the whole reel: you set where each scene starts, and how fast it plays.</p>
              <Button loading={busy === 'voice'} onClick={() => voiceFile.current?.click()}>
                <Upload className="mr-2 h-4 w-4" /> Upload voiceover
              </Button>
              {!aiMode.paste && (
                <p>
                  Or use ElevenLabs from the{' '}
                  <Link to={`/app/projects/${project.id}/voice`} className="text-accent hover:underline">
                    Voice
                  </Link>{' '}
                  tab.
                </p>
              )}
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <p className="text-sm text-ink-400">
                {upload.track.fileName} · {upload.track.durationSec.toFixed(1)}s recorded · plays for about {total.toFixed(1)}s at this pace
              </p>
              <label className="block text-xs text-ink-400">
                Voice pace for the whole reel: <span className="font-semibold text-ink-100">{draft.pace.toFixed(2)}×</span>
                <input type="range" className="mt-1 block w-full" min={PACE_MIN} max={PACE_MAX} step={0.05} value={draft.pace} onChange={(e) => patch({ pace: clampPace(Number(e.target.value)) })} aria-label="Voice pace" />
              </label>
              {mismatch ? (
                <Alert tone="info">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>The script has {beats.length} scenes but the recording is split into {upload.cuts.length + 1}. The preview uses the default voice until you refit.</span>
                    <Button onClick={refit}>Refit scene breaks</Button>
                  </div>
                </Alert>
              ) : (
                <>
                  <p className="text-xs text-ink-400">Drag a pink line to move where a scene starts. With a line selected, arrow keys nudge it (Shift for bigger steps).</p>
                  <Timeline peaks={upload.track.peaks ?? []} durationSec={upload.track.durationSec} cuts={upload.cuts} onChange={(cuts) => patch({ upload: { ...upload, cuts } })} selected={sceneIdx} onSelect={setScene} />
                  <div className="flex flex-wrap gap-2">
                    <Button variant="ghost" onClick={refit}>
                      Guess the breaks again
                    </Button>
                    <Button variant="ghost" loading={busy === 'voice'} onClick={() => voiceFile.current?.click()}>
                      Replace recording
                    </Button>
                    <Button variant="ghost" onClick={() => patch({ upload: null, voiceSource: 'elevenlabs' })}>
                      Remove recording
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
          <input ref={voiceFile} type="file" accept="audio/*" className="hidden" aria-label="Voiceover file" onChange={(e) => void pick('voice', e.target.files?.[0])} />
        </Card>

        <Card>
          <h2 className="flex items-center gap-2 font-semibold">
            <Type className="h-4 w-4 text-accent" /> Scenes
          </h2>
          <div className="mt-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Scenes">
            {beats.map((x, i) => (
              <button key={x.id} role="tab" aria-selected={i === sceneIdx} onClick={() => setScene(i)} className={`rounded-md border px-2.5 py-1 text-xs ${i === sceneIdx ? 'border-accent text-accent' : 'border-line/15 text-ink-400'}`}>
                {i + 1}
              </button>
            ))}
          </div>
          <div className="mt-4 space-y-3">
            <label className="block text-xs text-ink-400">
              What the voice says (also the captions)
              <textarea className={input} rows={3} value={b.narration} onChange={(e) => setBeat(sceneIdx, (x) => ({ ...x, narration: e.target.value }))} />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs text-ink-400">
                Label on screen
                <input className={input} value={b.card.eyebrow} onChange={(e) => setBeat(sceneIdx, (x) => ({ ...x, card: { ...x.card, eyebrow: e.target.value } }))} />
              </label>
              <label className="block text-xs text-ink-400">
                Headline on screen
                <input className={input} value={b.card.headline} onChange={(e) => setBeat(sceneIdx, (x) => ({ ...x, card: { ...x.card, headline: e.target.value } }))} />
              </label>
            </div>
            <label className="block text-xs text-ink-400">
              Pace for this scene: <span className="font-semibold text-ink-100">{scenePace(sceneIdx).toFixed(2)}×</span> (on top of the reel pace)
              <input type="range" className="mt-1 block w-full" min={PACE_MIN} max={PACE_MAX} step={0.05} value={scenePace(sceneIdx)} onChange={(e) => setScenePace(sceneIdx, Number(e.target.value))} aria-label="Scene pace" />
            </label>
            {!upload && <p className="text-xs text-ink-400">Without an uploaded recording the pace changes how long each scene stays on screen{aiMode.paste ? '.' : ' and how fast the ElevenLabs voice plays.'}</p>}
          </div>
        </Card>

        <Card>
          <h2 className="flex items-center gap-2 font-semibold">
            <Music2 className="h-4 w-4 text-accent" /> Music and captions
          </h2>
          <div className="mt-3 space-y-3">
            {draft.music ? (
              <div className="space-y-2">
                <p className="text-sm text-ink-400">
                  {draft.music.track.fileName} · {draft.music.track.durationSec.toFixed(0)}s{draft.music.track.durationSec < total ? ' · loops under the reel' : ''}
                </p>
                <label className="block text-xs text-ink-400">
                  Music volume: <span className="font-semibold text-ink-100">{Math.round(draft.music.volume * 100)}%</span>
                  <input
                    type="range"
                    className="mt-1 block w-full"
                    min={0}
                    max={1}
                    step={0.01}
                    value={draft.music.volume}
                    onChange={(e) => patch({ music: { ...draft.music!, volume: Number(e.target.value) } })}
                    aria-label="Music volume"
                  />
                </label>
                <Button variant="ghost" onClick={() => patch({ music: null })}>
                  Remove music
                </Button>
              </div>
            ) : (
              <Button variant="ghost" loading={busy === 'music'} onClick={() => musicFile.current?.click()}>
                <Upload className="mr-2 h-4 w-4" /> Add background music
              </Button>
            )}
            <input ref={musicFile} type="file" accept="audio/*" className="hidden" aria-label="Music file" onChange={(e) => void pick('music', e.target.files?.[0])} />
            <div className="flex flex-wrap gap-6 pt-2">
              <Seg<CaptionStyle['size']> label="Caption size" value={draft.captions.size} options={[{ id: 'small', text: 'Small' }, { id: 'medium', text: 'Medium' }, { id: 'large', text: 'Large' }]} onChange={(size) => patch({ captions: { ...draft.captions, size } })} />
              <Seg<CaptionStyle['position']> label="Position" value={draft.captions.position} options={[{ id: 'bottom', text: 'Bottom' }, { id: 'middle', text: 'Middle' }]} onChange={(position) => patch({ captions: { ...draft.captions, position } })} />
              <Seg<CaptionStyle['look']> label="Look" value={draft.captions.look} options={[{ id: 'box', text: 'Box' }, { id: 'plain', text: 'Plain' }]} onChange={(look) => patch({ captions: { ...draft.captions, look } })} />
            </div>
            <button type="button" className="text-xs text-ink-400 hover:underline" onClick={() => patch({ captions: DEFAULT_CAPTIONS })}>
              Reset captions
            </button>
          </div>
        </Card>

        <div className="flex flex-wrap items-center gap-3">
          <Button loading={busy === 'save'} disabled={!dirty} onClick={() => void save()}>
            Save changes
          </Button>
          {dirty ? <span className="text-sm text-amber-700">Unsaved changes: the preview shows them, the export does not yet.</span> : <span className="text-sm text-ink-400">Saved.</span>}
          <Link to={`/app/projects/${project.id}/export`} className="ml-auto text-sm text-accent hover:underline">
            Go to Export
          </Link>
        </div>
      </div>

      <div className="lg:sticky lg:top-6 lg:self-start">
        <h3 className="mb-3 text-sm font-semibold text-ink-400">Live preview</h3>
        {!spec ? (
          <Spinner label="Loading" />
        ) : (
          <Suspense fallback={<Spinner label="Loading the reel engine" />}>
            <ReelPreview spec={spec} />
          </Suspense>
        )}
      </div>
    </div>
  );
});
