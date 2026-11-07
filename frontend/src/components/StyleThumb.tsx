import { useMemo } from 'react';
import { Thumbnail } from '@remotion/player';
import { contentOf, FPS, Reel, reelTiming, type ReelSpec } from '@motionmind/reel-engine';

/** One still of a reel in a style: the first scene with a picture (steps or numbers), once it has drawn in. */
export default function StyleThumb({ spec }: { spec: ReelSpec }) {
  const { timed, totalFrames } = useMemo(() => reelTiming(spec), [spec]);
  const beat = timed.find((b) => ['flow', 'stats'].includes(contentOf(b).lead)) ?? timed[1] ?? timed[0]!;
  return (
    <Thumbnail
      component={Reel}
      inputProps={spec}
      compositionWidth={1080}
      compositionHeight={1920}
      durationInFrames={totalFrames}
      fps={FPS}
      frameToDisplay={Math.min(beat.start + 80, beat.start + beat.frames - 1)}
      style={{ width: '100%', aspectRatio: '9 / 16' }}
    />
  );
}
