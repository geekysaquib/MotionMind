import { useEffect, useMemo, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useOutletContext } from 'react-router-dom';
import { Upload, Mic, Music2, Wand2 } from 'lucide-react';
import {
  DEFAULT_MUSIC_VOLUME,
  defaultClosingAt,
  detectTrim,
  narrationKey,
  normalizeEditor,
  placeWords,
  runsFromPeaks,
  trimWindow,
  type Project,
  type ReelEditor,
  type VoiceUpload,
} from '@motionmind/shared';
import { useStores } from '../../stores/RootStore';
import { EmptyState } from '../../components/EmptyState';
import { Alert, Badge, Button, Card } from '../../components/ui';
import { errorText } from '../../lib/format';
import { log } from '../../lib/logger';
import { AnimationPreview } from '../../components/AnimationPreview';
import { NarrationScript } from '../../components/NarrationScript';
import { Timeline } from '../../components/Timeline';
import { attachMusic, attachVoice, AudioFileError } from '../../lib/editorActions';

/** When every word is spoken, for the breaks and trim as they are now. */
function refit(up: VoiceUpload, narrations: string[]): VoiceUpload {
  const win = trimWindow(up);
  const runs = up.speech?.length ? up.speech.map(([start, end]) => ({ start, end })) : runsFromPeaks(up.track.peaks ?? []);
  if (!runs.length) return up;
  const end = up.closingAt ?? win.end;
  return { ...up, wordTimes: placeWords(narrations, runs, [win.start, ...up.cuts, end]), fitKey: narrationKey(narrations) };
}

/** Voice step: upload your own recording. Motion Mind fits the script to it: where each scene starts and when each word is spoken. */
export const VoiceStagePage = observer(function VoiceStagePage() {
  const project = useOutletContext<Project>();
  const { projects, services, auth, toasts } = useStores();
  const api = services.claude(() => auth.session?.accessToken ?? null);
  const script = project.script;
  const narrations = useMemo(() => (script?.beats ?? []).map((b) => b.narration), [script]);
  const saved = project.editor?.upload ?? null;
  const [draft, setDraft] = useState<VoiceUpload | null>(saved);
  const [dirty, setDirty] = useState(false);
  const [phase, setPhase] = useState<'upload' | 'fit' | 'music' | 'save' | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [urls, setUrls] = useState<{ voice?: string; music?: string }>({});
  const voiceInput = useRef<HTMLInputElement>(null);
  const musicInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!dirty) setDraft(project.editor?.upload ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.editor?.updatedAt, project.editor?.upload]);

  useEffect(() => {
    Promise.resolve()
      .then(() => api.editorFor(project.id))
      .then((r) => setUrls(r.urls))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  if (!script) {
    return <EmptyState icon={<Mic className="h-6 w-6" />} title="No script yet" text="The voice is the narration of your scenes, so write the script first." to={`/app/projects/${project.id}/script`} action="Go to Script" />;
  }

  const stale = Boolean(draft && draft.fitKey !== narrationKey(narrations));

  async function uploadVoice(file: File | undefined) {
    if (!file) return;
    setPhase('upload');
    setError(null);
    setNote(null);
    try {
      const r = await attachVoice(api, project, file, project.editor);
      projects.upsert(r.project);
      setUrls(r.urls);
      setDirty(false);
      setDraft(r.project.editor?.upload ?? null);
      setNote(r.note);
      log.info('voice', 'Own voiceover uploaded and fitted', { projectId: project.id, fit: r.fit });
      if (r.fit) toasts.push('success', 'Your voice is in, and the script is fitted to it.');
    } catch (e) {
      setError(e instanceof AudioFileError ? e.message : errorText(e));
    } finally {
      setPhase(null);
      if (voiceInput.current) voiceInput.current.value = '';
    }
  }

  async function fitAgain() {
    setPhase('fit');
    setError(null);
    try {
      if (dirty && draft) await api.saveEditor(project.id, { ...normalizeEditor(project.editor), upload: draft });
      const r = await api.fitVoice(project.id);
      projects.upsert(r.project);
      setUrls(r.urls);
      setDirty(false);
      setDraft(r.project.editor?.upload ?? null);
      setNote(r.note);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setPhase(null);
    }
  }

  function edit(patch: Partial<VoiceUpload>) {
    if (!draft) return;
    setDraft(refit({ ...draft, ...patch }, narrations));
    setDirty(true);
  }

  async function saveEdits() {
    if (!draft) return;
    setPhase('save');
    setError(null);
    try {
      const r = await api.saveEditor(project.id, { ...normalizeEditor(project.editor), upload: draft });
      projects.upsert(r.project);
      setUrls(r.urls);
      setDirty(false);
      toasts.push('success', 'Saved.');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setPhase(null);
    }
  }

  async function removeVoice() {
    setPhase('save');
    try {
      const r = await api.saveEditor(project.id, { ...normalizeEditor(project.editor), upload: null });
      projects.upsert(r.project);
      setUrls(r.urls);
      setDraft(null);
      setDirty(false);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setPhase(null);
    }
  }

  async function uploadMusic(file: File | undefined) {
    if (!file) return;
    setPhase('music');
    setError(null);
    try {
      const r = await attachMusic(api, project, file, normalizeEditor(project.editor));
      projects.upsert(r.project);
      setUrls(r.urls);
    } catch (e) {
      setError(e instanceof AudioFileError ? e.message : errorText(e));
    } finally {
      setPhase(null);
      if (musicInput.current) musicInput.current.value = '';
    }
  }

  async function saveMusic(music: ReelEditor['music']) {
    setError(null);
    try {
      const r = await api.saveEditor(project.id, { ...normalizeEditor(project.editor), music });
      projects.upsert(r.project);
      setUrls(r.urls);
    } catch (e) {
      setError(errorText(e));
    }
  }

  const music = project.editor?.music ?? null;
  const win = draft ? trimWindow(draft) : null;
  const busy = phase !== null;

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        <NarrationScript project={project} />

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-semibold">
              <Upload className="h-4 w-4 text-accent" /> Your voiceover
            </h2>
            {draft && !stale && draft.fitKey && <Badge tone="mint">Fitted to the script</Badge>}
            {draft && stale && <Badge tone="amber">Script changed since the fit</Badge>}
          </div>
          <p className="mt-1 text-sm text-ink-400">
            Upload one recording of the whole reel (MP3, WAV or M4A, up to 5 minutes). Motion Mind finds where every scene starts and when every word is spoken, so the animation lands on your voice.
          </p>

          {phase === 'upload' && <p className="mt-3 text-sm text-ink-400">Uploading your recording and fitting the script to it…</p>}
          {phase === 'fit' && <p className="mt-3 text-sm text-ink-400">Fitting the script to your voice… this can take a minute for a long recording.</p>}

          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant={draft ? 'secondary' : 'primary'} loading={phase === 'upload'} disabled={busy && phase !== 'upload'} onClick={() => voiceInput.current?.click()}>
              {draft ? 'Replace the recording' : 'Upload your voiceover'}
            </Button>
            <input ref={voiceInput} type="file" accept="audio/*" className="hidden" aria-label="Voiceover file" onChange={(e) => void uploadVoice(e.target.files?.[0])} />
            {draft && (
              <>
                <Button variant="secondary" icon={<Wand2 className="h-4 w-4" />} loading={phase === 'fit'} disabled={busy && phase !== 'fit'} onClick={() => void fitAgain()}>
                  Fit the script again
                </Button>
                <Button variant="ghost" disabled={busy} onClick={() => void removeVoice()}>
                  Remove
                </Button>
              </>
            )}
          </div>

          {draft && (
            <div className="mt-5 space-y-4">
              <p className="text-sm text-ink-400">
                {draft.track.fileName} · {draft.track.durationSec.toFixed(1)}s ·{' '}
                {draft.fit === 'speech' ? 'fitted to the words I heard' : draft.fit === 'loudness' ? 'fitted to the loudness of your voice' : 'not fitted yet'}
              </p>
              {stale && <Alert tone="info">You changed the narration after fitting. Press "Fit the script again" so the animation uses the new words.</Alert>}
              {note && <Alert tone="info">{note}</Alert>}
              <Timeline
                peaks={draft.track.peaks ?? []}
                durationSec={draft.track.durationSec}
                cuts={draft.cuts}
                onChange={(cuts) => edit({ cuts })}
                closingAt={draft.closingAt ?? null}
                onClosingChange={(closingAt) => edit({ closingAt })}
                trimStart={draft.trimStart ?? null}
                trimEnd={draft.trimEnd ?? null}
                onTrimChange={(t) => edit(t)}
              />
              <div className="flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={draft.closingAt != null}
                    onChange={(e) => edit({ closingAt: e.target.checked ? defaultClosingAt(draft.track.peaks ?? [], draft.track.durationSec, draft.cuts, undefined, win?.start ?? 0) : null })}
                  />
                  My recording ends with the follow line
                </label>
                <button
                  type="button"
                  className="text-accent hover:underline"
                  onClick={() => {
                    const t = detectTrim(draft.track.peaks ?? [], draft.track.durationSec, draft.cuts, draft.closingAt);
                    edit({ trimStart: t.start, trimEnd: t.end });
                  }}
                >
                  Trim the silence
                </button>
              </div>
              {dirty && (
                <div className="flex items-center gap-3">
                  <Badge tone="amber">Unsaved changes</Badge>
                  <Button loading={phase === 'save'} onClick={() => void saveEdits()}>
                    Save
                  </Button>
                </div>
              )}
              {urls.voice && <audio controls src={urls.voice} className="w-full" aria-label="Your recording" />}
            </div>
          )}
          {error && (
            <div className="mt-4">
              <Alert>{error}</Alert>
            </div>
          )}
        </Card>

        <Card>
          <h2 className="flex items-center gap-2 font-semibold">
            <Music2 className="h-4 w-4 text-accent" /> Background music <span className="text-xs font-normal text-ink-400">optional</span>
          </h2>
          <p className="mt-1 text-sm text-ink-400">A track that loops quietly under your voice in the export.</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button variant="secondary" loading={phase === 'music'} disabled={busy && phase !== 'music'} onClick={() => musicInput.current?.click()}>
              {music ? 'Replace the music' : 'Add music'}
            </Button>
            <input ref={musicInput} type="file" accept="audio/*" className="hidden" aria-label="Music file" onChange={(e) => void uploadMusic(e.target.files?.[0])} />
            {music && (
              <>
                <label className="flex items-center gap-2 text-sm text-ink-400">
                  Volume
                  <input
                    type="range"
                    min={0}
                    max={0.6}
                    step={0.01}
                    defaultValue={music.volume ?? DEFAULT_MUSIC_VOLUME}
                    aria-label="Music volume"
                    onMouseUp={(e) => void saveMusic({ ...music, volume: Number((e.target as HTMLInputElement).value) })}
                    onKeyUp={(e) => void saveMusic({ ...music, volume: Number((e.target as HTMLInputElement).value) })}
                  />
                </label>
                <Button variant="ghost" onClick={() => void saveMusic(null)}>
                  Remove
                </Button>
              </>
            )}
          </div>
          {music && <p className="mt-2 text-xs text-ink-400">{music.track.fileName}</p>}
        </Card>
      </div>

      <div className="xl:sticky xl:top-6 xl:self-start">
        <h3 className="mb-3 text-sm font-semibold text-ink-400">Preview</h3>
        <AnimationPreview project={project} />
      </div>
    </div>
  );
});
