import { lazy, Suspense, useMemo } from 'react';
import { observer } from 'mobx-react-lite';
import { Link, useOutletContext } from 'react-router-dom';
import type { Project } from '@motionmind/shared';
import { useStores } from '../../stores/RootStore';
import { Card, Spinner } from '../../components/ui';
import { brandFor, specFromScript } from '../../components/reelSpec';

const SceneThumbnails = lazy(() => import('../../components/SceneThumbnails'));

/**
 * Graphics stage: every scene's visual, made automatically from its card. A flow becomes a connected
 * diagram, chips become big tags, a key/value becomes a stat, and other scenes show their key word.
 */
export const GraphicsStagePage = observer(function GraphicsStagePage() {
  const project = useOutletContext<Project>();
  const { profile } = useStores();
  const spec = useMemo(() => (project.script ? specFromScript(project.script, brandFor(profile.profile)) : null), [project.script, profile.profile]);

  if (!spec) {
    return (
      <Card>
        <h2 className="font-semibold">Graphics</h2>
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
    <div className="space-y-6">
      <Card>
        <h2 className="font-semibold">Scene graphics</h2>
        <p className="mt-1 text-sm text-ink-400">
          Every scene plays in a 3D isometric world: the original railway world for train topics, or a town of phones, towers, banks, servers and more for everything else. Claude picks each scene's objects, the signals moving between them and the camera. Older scripts without scenes use flat animated cards. To change a scene, edit it in the{' '}
          <Link to={`/app/projects/${project.id}/storyboard`} className="text-accent hover:underline">
            Storyboard
          </Link>
          .
        </p>
      </Card>
      <Suspense fallback={<Spinner label="Drawing the scenes" />}>
        <SceneThumbnails spec={spec} />
      </Suspense>
    </div>
  );
});
