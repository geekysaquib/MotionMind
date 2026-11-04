import { Boxes } from 'lucide-react';
import { lazy, Suspense, useMemo } from 'react';
import { observer } from 'mobx-react-lite';
import { Link, useOutletContext } from 'react-router-dom';
import type { Project } from '@motionmind/shared';
import { useStores } from '../../stores/RootStore';
import { EmptyState } from '../../components/EmptyState';
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
      <EmptyState icon={<Boxes className="h-6 w-6" />} title="No script yet" text="The 3D scenes are built from the script. Write it first and every scene shows up here." to={`/app/projects/${project.id}/script`} action="Go to Script" />
    );
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
      <Suspense fallback={<Spinner label="Drawing the scenes" />}>
        <SceneThumbnails spec={spec} />
      </Suspense>
    </div>
  );
});
