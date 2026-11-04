import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Link, useOutletContext } from 'react-router-dom';
import { AudioLines } from 'lucide-react';
import type { Project, ReelVoice } from '@motionmind/shared';
import { useStores } from '../../stores/RootStore';
import { Alert, Badge, Button, Card, Spinner } from '../../components/ui';
import { errorText, timeAgo } from '../../lib/format';
import { log } from '../../lib/logger';
import { brandFor, specFromScript } from '../../components/reelSpec';

const ReelPreview = lazy(() => import('../../components/ReelPreview'));

/** Voice stage: ElevenLabs reads every scene (server key); the preview plays the reel with the voiceover. */
export const VoiceStagePage = observer(function VoiceStagePage() {
  const project = useOutletContext<Project>();
  const { projects, profile, services, auth } = useStores();
  const api = services.claude(() => auth.session?.accessToken ?? null);
  const [voices, setVoices] = useState<{ id: string; name: string }[] | null>(null);
  const [voiceId, setVoiceId] = useState('');
  const [voicesError, setVoicesError] = useState<string | null>(null);
  const [audio, setAudio] = useState<{ voice: ReelVoice | null; urls: string[]; stale: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .voices()
      .then((r) => {
        setVoices(r.voices);
        setVoiceId(project.voice?.voiceId ?? r.defaultVoiceId ?? r.voices[0]?.id ?? '');
      })
      .catch((e) => setVoicesError(errorText(e)));
    api
      .voiceFor(project.id)
      .then(setAudio)
      .catch((e) => setError(errorText(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  const script = project.script;
  const spec = useMemo(
    () => (script ? specFromScript(script, brandFor(profile.profile), audio?.voice && !audio.stale ? { voice: audio.voice, urls: audio.urls } : undefined) : null),
    [script, profile.profile, audio],
  );

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

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <Card>
          <h2 className="flex items-center gap-2 font-semibold">
            <AudioLines className="h-4 w-4 text-accent" /> Voiceover
          </h2>
          <p className="mt-1 text-sm text-ink-400">ElevenLabs reads every scene of your script. Captions follow the voice word by word.</p>
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

      <div className="lg:sticky lg:top-6 lg:self-start">
        <h3 className="mb-3 text-sm font-semibold text-ink-400">Preview {spec?.audioUrls ? 'with voice' : '(no voice yet)'}</h3>
        {spec && (
          <Suspense fallback={<Spinner label="Loading the reel engine" />}>
            <ReelPreview spec={spec} />
          </Suspense>
        )}
      </div>
    </div>
  );
});
