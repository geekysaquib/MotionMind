import { useEffect, useMemo, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Link, useOutletContext } from 'react-router-dom';
import { Clapperboard, Music2, Type, Upload, SlidersHorizontal, Volume2 } from 'lucide-react';
import {
  autoCuts,
  clampPace,
  DEFAULT_CAPTIONS,
  defaultClosingAt,
  detectTrim,
  normalizeEditor,
  trimWindow,
  MAX_SFX,
  PACE_MAX,
  PACE_MIN,
  PEAKS_PER_SEC,
  sceneBounds,
  type CaptionStyle,
  type Project,
  type ReelEditor,
  type ReelScript,
} from '@motionmind/shared';
import { useStores } from '../../stores/RootStore';
import { EmptyState } from '../../components/EmptyState';
import { Alert, Badge, Button, Card } from '../../components/ui';
import { Timeline } from '../../components/Timeline';
import { errorText } from '../../lib/format';
import { log } from '../../lib/logger';
import { attachMusic, attachSfx, attachVoice, AudioFileError } from '../../lib/editorActions';
import type { EditorUrls } from '../../services/claudeHttp';
import { AnimationPreview } from '../../components/AnimationPreview';


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
  const { projects, services, auth, toasts, aiMode } = useStores();
  const api = services.claude(() => auth.session?.accessToken ?? null);
  const [draft, setDraft] = useState<ReelEditor>(() => normalizeEditor(project.editor, Boolean(project.voice)));
  const [script, setScript] = useState<ReelScript | null>(project.script);
  const [, setUrls] = useState<EditorUrls | null>(null);
  const [scene, setScene] = useState(0);
  const [busy, setBusy] = useState<'save' | 'voice' | 'music' | 'sfx' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, setElevenAudio] = useState<{ voice: Project['voice']; urls: string[]; stale: boolean } | null>(null);
  const voiceFile = useRef<HTMLInputElement>(null);
  const musicFile = useRef<HTMLInputElement>(null);
  const sfxFile = useRef<HTMLInputElement>(null);

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


  if (!script) {
    return (
      <EmptyState icon={<SlidersHorizontal className="h-6 w-6" />} title="No script yet" text="The editor times your voiceover to the scenes, so it needs a script to work with." to={`/app/projects/${project.id}/script`} action="Go to Script" />
    );
  }

  const patch = (p: Partial<ReelEditor>) => setDraft((d) => ({ ...d, ...p }));
  const setBeat = (i: number, f: (b: ReelScript['beats'][number]) => ReelScript['beats'][number]) =>
    setScript((s) => (s ? { ...s, beats: s.beats.map((b, j) => (j === i ? f(b) : b)) } : s));
  const scenePace = (i: number) => draft.scenePace[i] ?? 1;
  const setScenePace = (i: number, v: number) =>
    patch({ scenePace: Array.from({ length: beats.length }, (_, j) => (j === i ? clampPace(v) : draft.scenePace[j] ?? 1)) });
  const win = upload ? trimWindow(upload) : { start: 0, end: 0 };
  const bounds = upload ? sceneBounds(upload.cuts, upload.closingAt ?? win.end, win.start) : [];
  const total = bounds.reduce((n, b, i) => n + (b.end - b.start) / (clampPace(draft.pace) * scenePace(i)), 0);

  /** Seconds from the start of the reel at which each scene begins (needs an uploaded recording to know). */
  const sceneStarts = bounds.map((_, i) => bounds.slice(0, i).reduce((n, b, k) => n + (b.end - b.start) / (clampPace(draft.pace) * scenePace(k)), 0));
  const sfx = draft.sfx ?? [];
  const setSfx = (i: number, p: Partial<NonNullable<ReelEditor['sfx']>[number]>) => patch({ sfx: sfx.map((c, j) => (j === i ? { ...c, ...p } : c)) });

  async function addSfx(file: File | undefined) {
    if (!file) return;
    setBusy('sfx');
    setError(null);
    try {
      const r = await attachSfx(api, project, file, draft, 0);
      projects.upsert(r.project);
      setDraft(r.editor);
      setUrls(r.urls);
      toasts.push('success', 'Sound effect added at the start. Set when it plays below.');
    } catch (e) {
      setError(e instanceof AudioFileError ? e.message : errorText(e));
    } finally {
      setBusy(null);
      if (sfxFile.current) sfxFile.current.value = '';
    }
  }

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
    // With a follow line at the end, only the part before it is split into scenes.
    const end = upload.closingAt ?? win.end;
    const peaks = (upload.track.peaks ?? []).slice(Math.round(win.start * PEAKS_PER_SEC), Math.round(end * PEAKS_PER_SEC));
    const cuts = autoCuts(peaks, end - win.start, script.beats.map((b) => b.narration)).map((c) => Math.round((c + win.start) * 100) / 100);
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
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
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
                  <Timeline
                    peaks={upload.track.peaks ?? []}
                    durationSec={upload.track.durationSec}
                    cuts={upload.cuts}
                    onChange={(cuts) => patch({ upload: { ...upload, cuts } })}
                    selected={sceneIdx}
                    onSelect={setScene}
                    closingAt={upload.closingAt}
                    onClosingChange={(closingAt) => patch({ upload: { ...upload, closingAt } })}
                    trimStart={upload.trimStart}
                    trimEnd={upload.trimEnd}
                    onTrimChange={(t) => patch({ upload: { ...upload, ...t } })}
                  />
                  <div className="flex flex-wrap items-center gap-2 text-xs text-ink-400">
                    <span>
                      Using {win.start.toFixed(1)}s to {win.end.toFixed(1)}s of the recording. Drag the white handles at either end to cut off silence or a false start.
                    </span>
                    <Button variant="ghost" onClick={() => patch({ upload: { ...upload, ...(() => { const d = detectTrim(upload.track.peaks ?? [], upload.track.durationSec, upload.cuts, upload.closingAt); return { trimStart: d.start > 0.01 ? d.start : null, trimEnd: d.end < upload.track.durationSec - 0.01 ? d.end : null }; })() } })}>
                      Trim the silence
                    </Button>
                    {(upload.trimStart != null || upload.trimEnd != null) && (
                      <Button variant="ghost" onClick={() => patch({ upload: { ...upload, trimStart: null, trimEnd: null } })}>
                        Use the whole recording
                      </Button>
                    )}
                  </div>
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1"
                      aria-label="My recording ends with the follow line"
                      checked={upload.closingAt != null}
                      onChange={(e) => patch({ upload: { ...upload, closingAt: e.target.checked ? defaultClosingAt(upload.track.peaks ?? [], win.end, upload.cuts, undefined, win.start) : null } })}
                    />
                    <span>
                      My recording ends with the "follow us" line
                      <span className="block text-xs text-ink-400">
                        Drag the purple line to where that line starts. The last scene ends there and the end card appears as the line begins, so it plays over your brand.
                      </span>
                    </span>
                  </label>
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
            <Volume2 className="h-4 w-4 text-accent" /> Sound effects
          </h2>
          <p className="mt-1 text-sm text-ink-400">Short sounds (a whoosh, a pop, a ding) that play once at the moment you choose. Up to {MAX_SFX}, each at most 30 seconds.</p>
          <ul className="mt-3 space-y-3">
            {sfx.map((c, i) => (
              <li key={c.track.path} className="rounded-lg border border-line/10 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-sm font-medium">
                    {i + 1}. {c.track.fileName} <span className="font-normal text-ink-400">· {c.track.durationSec.toFixed(1)}s</span>
                  </span>
                  <Button variant="ghost" aria-label={`Remove sound effect ${i + 1}`} onClick={() => patch({ sfx: sfx.filter((_, j) => j !== i) })}>
                    Remove
                  </Button>
                </div>
                <div className="mt-2 flex flex-wrap items-end gap-3 text-xs text-ink-400">
                  <label>
                    Plays at (seconds)
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      aria-label={`Sound effect ${i + 1} start`}
                      className="mt-1 block w-24 rounded-lg border border-line/15 bg-transparent px-2 py-1.5 text-sm text-ink-100"
                      value={Number(c.at.toFixed(2))}
                      onChange={(e) => setSfx(i, { at: Math.max(0, Number(e.target.value) || 0) })}
                    />
                  </label>
                  {sceneStarts.length > 0 && (
                    <label>
                      Or at the start of
                      <select
                        aria-label={`Sound effect ${i + 1} scene`}
                        className="mt-1 block rounded-lg border border-line/15 bg-transparent px-2 py-1.5 text-sm text-ink-100"
                        value=""
                        onChange={(e) => e.target.value !== '' && setSfx(i, { at: Math.round(sceneStarts[Number(e.target.value)]! * 100) / 100 })}
                      >
                        <option value="">scene…</option>
                        {sceneStarts.map((_, k) => (
                          <option key={k} value={k}>
                            Scene {k + 1}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label className="min-w-[140px] flex-1">
                    Volume: <span className="font-semibold text-ink-100">{Math.round(c.volume * 100)}%</span>
                    <input type="range" className="mt-1 block w-full" min={0} max={1} step={0.01} value={c.volume} onChange={(e) => setSfx(i, { volume: Number(e.target.value) })} aria-label={`Sound effect ${i + 1} volume`} />
                  </label>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-3">
            <Button variant="ghost" loading={busy === 'sfx'} disabled={sfx.length >= MAX_SFX} onClick={() => sfxFile.current?.click()}>
              <Upload className="mr-2 h-4 w-4" /> Add a sound effect
            </Button>
            <input ref={sfxFile} type="file" accept="audio/*" className="hidden" aria-label="Sound effect file" onChange={(e) => void addSfx(e.target.files?.[0])} />
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

      <div className="xl:sticky xl:top-6 xl:self-start">
        <h3 className="mb-3 text-sm font-semibold text-ink-400">Preview (saved settings)</h3>
        <AnimationPreview project={project} />
      </div>
    </div>
  );
});
