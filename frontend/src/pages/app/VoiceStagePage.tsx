import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Link, useOutletContext } from 'react-router-dom';
import { AudioLines, Upload, Mic, Gift } from 'lucide-react';
import type { Project, ReelVoice } from '@motionmind/shared';
import { useStores } from '../../stores/RootStore';
import { EmptyState } from '../../components/EmptyState';
import { Alert, Badge, Button, Card, Spinner } from '../../components/ui';
import { errorText, timeAgo } from '../../lib/format';
import { log } from '../../lib/logger';
import { brandFor, specFromScript } from '../../components/reelSpec';
import { NarrationScript } from '../../components/NarrationScript';
import { attachVoice, AudioFileError } from '../../lib/editorActions';
import type { EditorUrls } from '../../services/claudeHttp';

const ReelPreview = lazy(() => import('../../components/ReelPreview'));

/** Voice stage: your own recording, the free neural voice (no key), or ElevenLabs (server key); the preview plays the reel with the voiceover. */
export const VoiceStagePage = observer(function VoiceStagePage() {
  const project = useOutletContext<Project>();
  const { projects, profile, services, auth, aiMode } = useStores();
  const api = services.claude(() => auth.session?.accessToken ?? null);
  const [voices, setVoices] = useState<{ id: string; name: string }[] | null>(null);
  const [voiceId, setVoiceId] = useState('');
  const [voicesError, setVoicesError] = useState<string | null>(null);
  const [audio, setAudio] = useState<{ voice: ReelVoice | null; urls: string[]; stale: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editorUrls, setEditorUrls] = useState<EditorUrls>({});
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [freeVoices, setFreeVoices] = useState<{ id: string; name: string }[]>([]);
  const [freeId, setFreeId] = useState('');
  const [freeBusy, setFreeBusy] = useState(false);

  useEffect(() => {
    if (!aiMode.paste) {
      api
        .voices()
        .then((r) => {
          setVoices(r.voices);
          setVoiceId(project.voice?.voiceId ?? r.defaultVoiceId ?? r.voices[0]?.id ?? '');
        })
        .catch((e) => setVoicesError(errorText(e)));
    }
    // Older test doubles and servers may not have the free voice: then the card stays hidden.
    Promise.resolve()
      .then(() => api.freeVoices())
      .then((r) => {
        if (!r.available) return;
        setFreeVoices(r.voices);
        setFreeId(r.voices.some((v) => v.id === project.voice?.voiceId) ? project.voice!.voiceId : r.defaultVoiceId);
      })
      .catch(() => undefined);
    api
      .editorFor(project.id)
      .then((r) => setEditorUrls(r.urls))
      .catch(() => undefined);
    api
      .voiceFor(project.id)
      .then(setAudio)
      .catch((e) => setError(errorText(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, aiMode.mode]);

  const script = project.script;
  const spec = useMemo(
    () => (script ? specFromScript(script, brandFor(profile.profile), audio?.voice && !audio.stale ? { voice: audio.voice, urls: audio.urls } : undefined, { editor: project.editor, urls: editorUrls }) : null),
    [script, profile.profile, audio, project.editor, editorUrls],
  );

  async function upload(file: File | undefined) {
    if (!file || !script) return;
    setUploading(true);
    setError(null);
    try {
      const r = await attachVoice(api, project, file, project.editor);
      projects.upsert(r.project);
      setEditorUrls(r.urls);
      log.info('voice', 'Own voiceover uploaded', { projectId: project.id });
    } catch (e) {
      setError(e instanceof AudioFileError ? e.message : errorText(e));
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  async function generate() {
    setBusy(true);
    setError(null);
    const started = Date.now();
    try {
      const name = voices?.find((v) => v.id === voiceId)?.name;
      const res = await api.generateVoice(project.id, voiceId || undefined, name);
      projects.upsert(res.project);
      setAudio({ voice: res.project.voice, urls: res.urls, stale: false });
      log.info('voice', 'Voiceover generated', { projectId: project.id, beats: res.urls.length, ms: Date.now() - started });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function generateFree() {
    setFreeBusy(true);
    setError(null);
    const started = Date.now();
    try {
      const res = await api.generateFreeVoice(project.id, freeId || undefined);
      projects.upsert(res.project);
      setAudio({ voice: res.project.voice, urls: res.urls, stale: false });
      log.info('voice', 'Free voiceover generated', { projectId: project.id, voice: freeId, ms: Date.now() - started });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setFreeBusy(false);
    }
  }

  if (!script) {
    return (
      <EmptyState icon={<Mic className="h-6 w-6" />} title="No script yet" text="The voice script is the narration of your scenes, so write the script first." to={`/app/projects/${project.id}/script`} action="Go to Script" />
    );
  }

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        <NarrationScript project={project} />

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-semibold">
              <Upload className="h-4 w-4 text-accent" /> Your own voiceover
            </h2>
            {project.editor?.upload && project.editor.voiceSource === 'upload' && <Badge tone="mint">In use</Badge>}
          </div>
          <p className="mt-1 text-sm text-ink-400">
            Upload one recording of the whole reel (MP3, WAV or M4A, up to 5 minutes). We guess where each scene starts; you fine-tune the breaks and the pace in the Reel editor.
          </p>
          {project.editor?.upload ? (
            <p className="mt-3 text-sm text-ink-400">
              {project.editor.upload.track.fileName} · {project.editor.upload.track.durationSec.toFixed(1)}s ·{' '}
              <Link to={`/app/projects/${project.id}/editor`} className="text-accent hover:underline">
                Open the Reel editor
              </Link>
            </p>
          ) : null}
          <div className="mt-4">
            <Button variant={project.editor?.upload ? 'secondary' : 'primary'} loading={uploading} onClick={() => fileInput.current?.click()}>
              {project.editor?.upload ? 'Replace the recording' : 'Upload your voiceover'}
            </Button>
            <input ref={fileInput} type="file" accept="audio/*" className="hidden" aria-label="Voiceover file" onChange={(e) => void upload(e.target.files?.[0])} />
          </div>
        </Card>

        {freeVoices.length > 0 && (
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 font-semibold">
                <Gift className="h-4 w-4 text-accent" /> Free voice
              </h2>
              <Badge tone="mint">No key needed</Badge>
            </div>
            <p className="mt-1 text-sm text-ink-400">A Microsoft neural voice reads every scene, with word timings for the captions. Hindi voices read Hinglish well. Good for drafts; ElevenLabs or your own voice sounds more natural.</p>
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <label className="block text-xs text-ink-400">
                Voice
                <select aria-label="Free voice" className="mt-1 block min-w-[220px] rounded-lg border border-line/15 bg-transparent px-3 py-2 text-sm text-ink-100" value={freeId} onChange={(e) => setFreeId(e.target.value)}>
                  {freeVoices.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </label>
              <Button variant={audio?.voice ? 'secondary' : 'primary'} loading={freeBusy} onClick={() => void generateFree()}>
                Make it with the free voice
              </Button>
            </div>
            {freeBusy && <p className="mt-3 text-sm text-ink-400">Recording {script.beats.length} scenes. This takes about {Math.max(10, script.beats.length * 2)} seconds.</p>}
            {aiMode.paste && error && <div className="mt-4"><Alert>{error}</Alert></div>}
          </Card>
        )}

        {!aiMode.paste && (
        <Card>
          <h2 className="flex items-center gap-2 font-semibold">
            <AudioLines className="h-4 w-4 text-accent" /> Voiceover
          </h2>
          <p className="mt-1 text-sm text-ink-400">Let ElevenLabs read every scene of your script. Captions follow the voice word by word.</p>
          {voicesError ? (
            <div className="mt-4">
              <Alert tone="info">{voicesError}</Alert>
            </div>
          ) : !voices ? (
            <div className="mt-4"><Spinner label="Loading voices" /></div>
          ) : (
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <label className="block text-xs text-ink-400">
                Voice
                <select className="mt-1 block min-w-[220px] rounded-lg border border-line/15 bg-transparent px-3 py-2 text-sm text-ink-100" value={voiceId} onChange={(e) => setVoiceId(e.target.value)}>
                  {voices.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </label>
              <Button loading={busy} disabled={!voiceId} onClick={() => void generate()}>
                {audio?.voice ? 'Make the voiceover again' : 'Make the voiceover'}
              </Button>
            </div>
          )}
          {busy && <p className="mt-3 text-sm text-ink-400">Recording {script.beats.length} scenes. This takes about {Math.max(10, script.beats.length * 2)} seconds.</p>}
          {error && <div className="mt-4"><Alert>{error}</Alert></div>}
        </Card>
        )}

        {audio?.voice && (
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold">Current voiceover</h3>
              {audio.stale ? <Badge tone="amber">Script changed since</Badge> : <Badge tone="mint">Matches the script</Badge>}
            </div>
            <p className="mt-2 text-sm text-ink-400">
              {audio.voice.voiceName ?? audio.voice.voiceId} · {audio.voice.beats.length} scenes · {audio.voice.beats.reduce((n, b) => n + b.durationSec, 0).toFixed(1)}s · {timeAgo(audio.voice.createdAt)}
            </p>
            {audio.stale && <p className="mt-2 text-sm text-amber-700">You edited the narration after recording. Make the voiceover again so the preview and export use the new lines.</p>}
          </Card>
        )}
      </div>

      <div className="xl:sticky xl:top-6 xl:self-start">
        <h3 className="mb-3 text-sm font-semibold text-ink-400">Preview {spec?.audioUrls || spec?.voiceTrack ? 'with voice' : '(no voice yet)'}</h3>
        {spec && (
          <Suspense fallback={<Spinner label="Loading the reel engine" />}>
            <ReelPreview spec={spec} />
          </Suspense>
        )}
      </div>
    </div>
  );
});
