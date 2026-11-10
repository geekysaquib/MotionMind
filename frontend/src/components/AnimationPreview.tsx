import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { observer } from 'mobx-react-lite';
import type { Project, ReelAnimation, ReelTimeline } from '@motionmind/shared';
import { useStores } from '../stores/RootStore';
import { config } from '../config';
import { HtmlReelPlayer, type PlayerClip } from './HtmlReelPlayer';
import { Spinner } from './ui';

/** Claude's animation for a project and the voice clips that go under it, loaded from the API. */
export function useAnimationPreview(project: Project) {
  const { services, auth } = useStores();
  const api = services.claude(() => auth.session?.accessToken ?? null);
  const [state, setState] = useState<{ animation: ReelAnimation | null; timeline: ReelTimeline | null; stale: boolean } | null>(null);
  const [clips, setClips] = useState<PlayerClip[]>([]);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!project.script) return;
    // Test doubles and older servers may not have the Animate step: then there is just no preview.
    Promise.resolve()
      .then(() => api.animationFor(project.id))
      .then(setState)
      .catch(setError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, project.script?.animation?.writtenAt, project.voice?.createdAt, project.editor?.updatedAt]);

  // The voice under the preview: the generated clips at their scene times, or the user's own recording.
  useEffect(() => {
    const tl = state?.timeline;
    if (!tl) return;
    if (tl.source === 'voice')
      Promise.resolve()
        .then(() => api.voiceFor(project.id))
        .then((v) => setClips(v.urls.map((url, i) => ({ url, at: (tl.scenes[i]?.start ?? 0) + 0.15 })).filter((c) => c.url)))
        .catch(() => setClips([]));
    else if (tl.source === 'recording')
      Promise.resolve()
        .then(() => api.editorFor(project.id))
        .then((r) => setClips(r.urls.voice ? [{ url: r.urls.voice, at: 0, from: project.editor?.upload?.trimStart ?? 0 }] : []))
        .catch(() => setClips([]));
    else setClips([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.timeline, project.id]);

  const gsapUrl = useMemo(() => `${config.apiUrl || window.location.origin}/api/static/gsap.min.js`, []);
  return { state, clips, gsapUrl, error };
}

/** The reel as Claude animated it, with the voice; or a pointer to the Animate step before there is one. */
export const AnimationPreview = observer(function AnimationPreview({ project }: { project: Project }) {
  const { state, clips, gsapUrl } = useAnimationPreview(project);
  if (!project.script) return null;
  if (project.script.animation && !state) return <Spinner label="Loading the animation" />;
  if (state?.animation && state.timeline) return <HtmlReelPlayer html={state.animation.html} duration={state.timeline.duration} clips={clips} gsapUrl={gsapUrl} />;
  return (
    <div className="flex aspect-[9/16] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line/20 p-6 text-center text-sm text-ink-400">
      Claude animates the reel on the Animate step. It plays here once you have pasted the animation.
      <Link to={`/app/projects/${project.id}/animate`} className="font-semibold text-accent hover:underline">
        Go to Animate
      </Link>
    </div>
  );
});
