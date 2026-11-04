import { useMemo } from 'react';
import { Thumbnail } from '@remotion/player';
import { FPS, Reel, reelTiming, type ReelSpec } from '@motionmind/reel-engine';

/** A still of every scene, taken a little after it starts (once its animation has settled). */
export default function SceneThumbnails({ spec }: { spec: ReelSpec }) {
  const { timed, totalFrames } = useMemo(() => reelTiming(spec), [spec]);
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {timed.map((b, i) => (
        <figure key={b.id} className="overflow-hidden rounded-xl border border-line/10 bg-ink-900">
          <Thumbnail
            component={Reel}
            inputProps={spec}
            compositionWidth={1080}
            compositionHeight={1920}
            durationInFrames={totalFrames}
            fps={FPS}
            frameToDisplay={Math.min(b.start + Math.round(1.5 * FPS), b.start + b.frames - 1)}
            style={{ width: '100%', aspectRatio: '9 / 16' }}
          />
          <figcaption className="px-3 py-2 text-xs text-ink-400">
            Scene {i + 1} · {b.card.eyebrow}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
