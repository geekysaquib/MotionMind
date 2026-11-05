import { Boxes, Lock, LockOpen } from 'lucide-react';
import { lazy, Suspense, useMemo, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Link, useOutletContext } from 'react-router-dom';
import type { Project } from '@motionmind/shared';
import { useStores } from '../../stores/RootStore';
import { EmptyState } from '../../components/EmptyState';
import { Alert, Button, Card, Spinner } from '../../components/ui';
import { errorText } from '../../lib/format';
import { log } from '../../lib/logger';
import { brandFor, specFromScript } from '../../components/reelSpec';

const SceneThumbnails = lazy(() => import('../../components/SceneThumbnails'));

/**
 * Graphics stage: every scene's visual, made automatically from its card. A flow becomes a connected
 * diagram, chips become big tags, a key/value becomes a stat, and other scenes show their key word.
 */
export const GraphicsStagePage = observer(function GraphicsStagePage() {
  const project = useOutletContext<Project>();
  const { profile, projects } = useStores();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const spec = useMemo(() => (project.script ? specFromScript(project.script, brandFor(profile.profile), undefined, undefined, undefined, project.template) : null), [project.script, profile.profile, project.template]);

  if (!spec) {
    return (
      <EmptyState icon={<Boxes className="h-6 w-6" />} title="No script yet" text="The 3D scenes are built from the script. Write it first and every scene shows up here." to={`/app/projects/${project.id}/script`} action="Go to Script" />
    );
  }

  const script = project.script!;
  const locked = script.layout ? Object.keys(script.layout).length : 0;

  /** Locks the arrangement the engine makes now, or goes back to letting it arrange the objects. */
  async function setLock(on: boolean) {
    setBusy(true);
    setError(null);
    try {
      let layout: typeof script.layout;
      if (on) {
        const { computeLayout, layoutProps } = await import('@motionmind/reel-engine');
        layout = computeLayout(spec!, layoutProps as never);
      }
      await projects.saveScript(project.id, { ...script, layout });
      log.info('graphics', on ? 'Object positions locked' : 'Object positions unlocked', { projectId: project.id });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="font-semibold">Scene graphics</h2>
        <p className="mt-1 text-sm text-ink-400">
          Every scene plays in a 3D world built from what you are explaining: the railway world for train topics, and objects of your topic (with their own icons) for everything else. The camera glides between the scenes. To change a scene's objects, links or look, edit it in the{' '}
          <Link to={`/app/projects/${project.id}/storyboard`} className="text-accent hover:underline">
            Storyboard
          </Link>
          .
        </p>
      </Card>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-[240px] flex-1">
            <h3 className="flex items-center gap-2 font-semibold">
              {locked ? <Lock className="h-4 w-4 text-accent" /> : <LockOpen className="h-4 w-4 text-ink-400" />} Object positions: {locked ? 'locked' : 'automatic'}
            </h3>
            <p className="mt-1 text-sm text-ink-400">
              {locked
                ? `${locked} objects keep their spots, even if the engine gets better at arranging them. Objects you add later are placed around them.`
                : 'The engine arranges the objects so nothing overlaps. Lock the arrangement once you like it, so it never moves.'}
            </p>
          </div>
          {locked ? (
            <Button variant="secondary" loading={busy} icon={<LockOpen className="h-4 w-4" />} onClick={() => void setLock(false)}>
              Arrange automatically
            </Button>
          ) : (
            <Button variant="secondary" loading={busy} icon={<Lock className="h-4 w-4" />} onClick={() => void setLock(true)}>
              Lock these positions
            </Button>
          )}
        </div>
        {error && <div className="mt-3"><Alert>{error}</Alert></div>}
      </Card>
      <Suspense fallback={<Spinner label="Drawing the scenes" />}>
        <SceneThumbnails spec={spec} />
      </Suspense>
    </div>
  );
});
