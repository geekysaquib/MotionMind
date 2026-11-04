import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Link, useOutletContext } from 'react-router-dom';
import { AudioLines, ClipboardCopy, Upload } from 'lucide-react';
import type { Project, ReelVoice } from '@motionmind/shared';
import { useStores } from '../../stores/RootStore';
import { Alert, Badge, Button, Card, Spinner } from '../../components/ui';
import { errorText, timeAgo } from '../../lib/format';
import { log } from '../../lib/logger';
import { brandFor, specFromScript } from '../../components/reelSpec';
import { attachVoice, AudioFileError } from '../../lib/editorActions';
import type { EditorUrls } from '../../services/claudeHttp';

const ReelPreview = lazy(() => import('../../components/ReelPreview'));

/** Voice stage: ElevenLabs reads every scene (server key); the preview plays the reel with the voiceover. */
export const VoiceStagePage = observer(function VoiceStagePage() {
  const project = useOutletContext<Project>();
  const { projects, profile, services, auth, aiMode, toasts } = useStores();
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

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      toasts.push('success', `${what} copied.`);
    } catch {
      toasts.push('error', "Couldn't copy. Select the text and copy it by hand.");
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

  if (!script) {
    return (
      <Card>
        <h2 className="font-semibold">Voice</h2>
        <p className="mt-2 text-sm text-ink-400">
          Write the script first.{' '}
          <Link to={`/app/projects/${project.id}/script`} className="text-accent hover:underline">
            Go to Script
          </Link>
        </p>
      </Card>
    );
  }

  const fullText = script.beats.map((b) => b.narration.trim()).join('\n\n');
  const words = fullText.split(/\s+/).filter(Boolean).length;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">Your narration script</h2>
              <p className="mt-1 text-sm text-ink-400">
                {words} words, about {Math.max(1, Math.round(words / 2.5))} seconds spoken. Copy it into any text-to-speech tool (or read it yourself), then upload the recording below.
              </p>
            </div>
            <Button variant="secondary" icon={<ClipboardCopy className="h-4 w-4" />} onClick={() => void copy(fullText, 'Script')}>
              Copy the whole script
            </Button>
          </div>
          <ol className="mt-4 space-y-3">
            {script.beats.map((b, i) => (
              <li key={b.id} className="rounded-xl border border-line/10 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">Scene {i + 1}</span>
                  <Button variant="ghost" aria-label={`Copy scene ${i + 1}`} onClick={() => void copy(b.narration, `Scene ${i + 1}`)}>
                    Copy
                  </Button>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{b.narration}</p>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-ink-400">
            Want to change a line? Edit it on the{' '}
            <Link to={`/app/projects/${project.id}/storyboard`} className="text-accent hover:underline">
              Storyboard
            </Link>
            . Speak the scenes in order, with a short pause between them: you set where each scene starts after you upload.
          </p>
        </Card>

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

        {!aiMode.paste && audio?.voice && (
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

      <div className="lg:sticky lg:top-6 lg:self-start">
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
