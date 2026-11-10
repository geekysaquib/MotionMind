import { useEffect, useMemo, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Link, useOutletContext } from 'react-router-dom';
import { Wand2 } from 'lucide-react';
import { STYLES, styleOf, type Project, type ReelAnimation, type ReelTimeline } from '@motionmind/shared';
import { useStores } from '../../stores/RootStore';
import { EmptyState } from '../../components/EmptyState';
import { Alert, Badge, Card, Spinner } from '../../components/ui';
import { errorText, timeAgo } from '../../lib/format';
import { log } from '../../lib/logger';
import { config } from '../../config';
import { HtmlReelPlayer, type PlayerClip } from '../../components/HtmlReelPlayer';
import { ClaudeAiPanel } from './PasteScriptPanel';

/**
 * Animate step: Claude writes the whole reel as a HyperFrames composition (HTML, CSS, SVG and a GSAP timeline)
 * in claude.ai, from a prompt with the script, the exact timing of every scene and word, and the style's rulebook.
 * The user pastes it back and watches it here with the voice.
 */
export const AnimateStagePage = observer(function AnimateStagePage() {
  const project = useOutletContext<Project>();
  const { projects, services, auth } = useStores();
  const api = services.claude(() => auth.session?.accessToken ?? null);
  const [state, setState] = useState<{ animation: ReelAnimation | null; timeline: ReelTimeline | null; stale: boolean } | null>(null);
  const [clips, setClips] = useState<PlayerClip[]>([]);
  const [error, setError] = useState<string | null>(null);
  const script = project.script;

  useEffect(() => {
    if (!script) return;
    api
      .animationFor(project.id)
      .then(setState)
      .catch((e) => setError(errorText(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, script?.animation?.writtenAt, project.editor?.updatedAt]);

  // The voice under the preview: the user's own recording.
  useEffect(() => {
    const tl = state?.timeline;
    if (!tl) return;
    if (tl.source === 'recording')
      api
        .editorFor(project.id)
        .then((r) => setClips(r.urls.voice ? [{ url: r.urls.voice, at: 0, from: project.editor?.upload?.trimStart ?? 0 }] : []))
        .catch(() => setClips([]));
    else setClips([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.timeline?.source, project.id]);

  const gsapUrl = useMemo(() => `${config.apiUrl || window.location.origin}/api/static/gsap.min.js`, []);

  if (!script) {
    return <EmptyState icon={<Wand2 className="h-6 w-6" />} title="No script yet" text="Claude animates your script, so write it first." to={`/app/projects/${project.id}/script`} action="Go to Script" />;
  }

  const tl = state?.timeline;
  const anim = state?.animation;
  const style = styleOf(script.style);

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-6">
        <Card>
          <h2 className="flex items-center gap-2 font-semibold">
            <Wand2 className="h-4 w-4 text-accent" /> Claude animates the reel
          </h2>
          <p className="mt-1 text-sm text-ink-400">
            Claude writes every scene of your reel as an animation, in the <span className="font-semibold text-ink-100">{STYLES[style.id].name}</span> style, timed to the word with your voice. Nothing is drawn by a template: what you see is what Claude designed for this topic.{' '}
            <Link to={`/app/projects/${project.id}/graphics`} className="text-accent hover:underline">
              Change the style
            </Link>
          </p>
          {tl?.source === 'estimate' && (
            <div className="mt-3">
              <Alert tone="info">
                There is no voice yet, so the timing is estimated.{' '}
                <Link to={`/app/projects/${project.id}/voice`} className="font-semibold underline">
                  Make the voice first
                </Link>{' '}
                so every scene lands on its words.
              </Alert>
            </div>
          )}
          {state?.stale && (
            <div className="mt-3">
              <Alert tone="info">The voice changed after this animation was made. Copy the prompt again so Claude re-times it.</Alert>
            </div>
          )}
          {error && <div className="mt-3"><Alert>{error}</Alert></div>}
        </Card>

        <ClaudeAiPanel
          title={anim ? 'Ask Claude for a new animation' : 'Animate it in claude.ai'}
          chatHint="Use a new chat. Claude's answer is long (one HTML file); wait until it has finished, then copy all of it."
          placeholder="<!doctype html> ... </html>"
          logScope="Animate"
          getPrompt={() => api.animationPrompt(project.id)}
          onImport={async (text) => {
            const p = await api.importAnimation(project.id, text);
            projects.upsert(p);
            log.info('animate', 'Animation imported', { projectId: project.id, bytes: p.script?.animation?.html.length });
            return p;
          }}
        />

        {anim && (
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold">Current animation</h3>
              {state?.stale ? <Badge tone="amber">Voice changed since</Badge> : <Badge tone="mint">Timed to the voice</Badge>}
            </div>
            <p className="mt-2 text-sm text-ink-400">
              {STYLES[styleOf(anim.style).id].name} · {(anim.html.length / 1024).toFixed(0)} KB of HTML · {timeAgo(anim.writtenAt)} ·{' '}
              <Link to={`/app/projects/${project.id}/export`} className="text-accent hover:underline">
                Export the video
              </Link>
            </p>
          </Card>
        )}
      </div>

      <div className="xl:sticky xl:top-6 xl:self-start">
        <h3 className="mb-3 text-sm font-semibold text-ink-400">Preview {clips.length ? 'with voice' : ''}</h3>
        {!state ? (
          <Spinner label="Loading" />
        ) : anim && tl ? (
          <HtmlReelPlayer html={anim.html} duration={tl.duration} clips={clips} gsapUrl={gsapUrl} />
        ) : (
          <div className="flex aspect-[9/16] items-center justify-center rounded-2xl border border-dashed border-line/20 p-6 text-center text-sm text-ink-400">Paste Claude's animation and it plays here.</div>
        )}
      </div>
    </div>
  );
});
