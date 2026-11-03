import { lazy, Suspense, useMemo, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Link, useOutletContext } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import type { Project } from '@motionmind/shared';
import { useStores } from '../../stores/RootStore';
import { Alert, Badge, Button, Card, Spinner } from '../../components/ui';
import { errorText, timeAgo } from '../../lib/format';
import { brandFor, specFromScript } from '../../components/reelSpec';

// The player pulls in the whole reel engine, so it loads only on this page.
const ReelPreview = lazy(() => import('../../components/ReelPreview'));

/** Script stage: Claude writes the reel script from the topic, and the embedded engine plays it. */
export const ScriptStagePage = observer(function ScriptStagePage() {
  const project = useOutletContext<Project>();
  const { projects, profile } = useStores();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSample, setShowSample] = useState(false);
  const script = project.script;
  const spec = useMemo(() => (script ? specFromScript(script, brandFor(profile.profile)) : null), [script, profile.profile]);

  async function write() {
    setBusy(true);
    setError(null);
    try {
      await projects.writeScript(project.id);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">Reel script</h2>
              <p className="mt-1 text-sm text-ink-400">
                Claude writes the hook, the step-by-step explanation and the on-screen cards for <span className="text-ink-100">{project.topic ?? 'this topic'}</span>, about {project.durationSec}s long.
              </p>
            </div>
            <Button icon={<Sparkles className="h-4 w-4" />} loading={busy} disabled={!project.topic} onClick={() => void write()}>
              {script ? 'Rewrite with Claude' : 'Write with Claude'}
            </Button>
          </div>
          {!project.topic && <div className="mt-4"><Alert tone="info">Add a topic on the Topic tab first.</Alert></div>}
          {error && (
            <div className="mt-4">
              <Alert>
                {error}{' '}
                {/Settings/.test(error) && (
                  <Link to="/app/settings/claude" className="font-semibold underline">
                    Open Settings
                  </Link>
                )}
              </Alert>
            </div>
          )}
          {busy && <p className="mt-4 text-sm text-ink-400">Claude is writing. This usually takes 20 to 60 seconds.</p>}
        </Card>

        {script && (
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-xl font-bold">{script.title}</h3>
              <div className="flex flex-wrap gap-2">
                {script.steps.map((s, i) => (
                  <Badge key={s}>{`${i + 1}. ${s}`}</Badge>
                ))}
              </div>
            </div>
            <ol className="mt-5 space-y-4">
              {script.beats.map((b, i) => (
                <li key={b.id} className="rounded-xl border border-line/10 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-ink-400">
                    {i + 1}. {b.card.eyebrow}
                  </div>
                  <div className="mt-1 font-semibold" dangerouslySetInnerHTML={{ __html: highlight(b.card.headline) }} />
                  <p className="mt-2 text-sm text-ink-400">{b.narration}</p>
                </li>
              ))}
            </ol>
            {script.model && (
              <p className="mt-4 text-xs text-ink-400">
                Written by {script.model}
                {script.writtenAt ? ` · ${timeAgo(script.writtenAt)}` : ''}
              </p>
            )}
          </Card>
        )}
      </div>

      <div className="lg:sticky lg:top-6 lg:self-start">
        <h3 className="mb-3 text-sm font-semibold text-ink-400">Preview</h3>
        {spec || showSample ? (
          <Suspense fallback={<Spinner label="Loading the reel engine" />}>
            <ReelPreview spec={spec ?? undefined} />
          </Suspense>
        ) : (
          <div className="flex aspect-[9/16] flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-line/15 p-6 text-center text-sm text-ink-400">
            The reel plays here once Claude has written the script.
            <Button variant="secondary" onClick={() => setShowSample(true)}>
              Play the sample reel
            </Button>
          </div>
        )}
        {!spec && showSample && <p className="mt-2 text-xs text-ink-400">Sample: "Where is my Train", made with the same engine.</p>}
      </div>
    </div>
  );
});

/** *word* -> highlighted, with everything else escaped. */
function highlight(text: string) {
  const esc = text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  return esc.replace(/\*([^*]+)\*/g, '<span class="text-accent">$1</span>');
}
