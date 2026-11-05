import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { observer } from 'mobx-react-lite';
import { Clapperboard } from 'lucide-react';
import { normalizeCover, type Project } from '@motionmind/shared';
import type { CoverSpec } from '@motionmind/reel-engine';
import { useStores } from '../stores/RootStore';
import { brandFor, specFromScript } from './reelSpec';

const CoverPreview = lazy(() => import('./CoverPreview'));

/** Draw only what is on screen: the engine is heavy and a library can have many reels. Without IntersectionObserver (tests) nothing is drawn. */
function useOnScreen<T extends Element>() {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (seen || !el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin: '200px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);
  return [ref, seen] as const;
}

/**
 * A project's cover (thumbnail), in the 4:5 feed shape, drawn live from its script and saved cover settings.
 * A project without a script yet shows a plain tile. `children` sit on top (badges and progress).
 */
export const ProjectCover = observer(function ProjectCover({ project, tint, children }: { project: Project; tint: string; children?: ReactNode }) {
  const { profile } = useStores();
  const [ref, seen] = useOnScreen<HTMLDivElement>();
  const script = project.script;
  const spec = useMemo(() => {
    if (!script?.beats.length) return null;
    const cover = normalizeCover(script.cover, script);
    return { ...specFromScript(script, brandFor(profile.profile)), cover: { ...cover, size: 'feed' as const, tone: cover.tone ?? null } } as unknown as CoverSpec;
  }, [script, profile.profile]);

  return (
    <div ref={ref} className="relative aspect-[4/5] overflow-hidden" style={{ backgroundColor: tint }}>
      {spec && seen ? (
        <Suspense fallback={null}>
          <div className="absolute inset-0" aria-label={`Cover of ${project.title}`} role="img">
            <CoverPreview spec={spec} />
          </div>
        </Suspense>
      ) : (
        !spec && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center text-ink-300">
            <Clapperboard className="h-8 w-8 text-accent" aria-hidden />
            <span className="line-clamp-3 font-display text-base font-bold text-ink-100">{project.title}</span>
            <span className="text-xs">The cover appears once the script is written.</span>
          </div>
        )
      )}
      {children}
    </div>
  );
});
