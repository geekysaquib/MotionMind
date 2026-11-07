import { useMemo } from 'react';
import { Thumbnail } from '@remotion/player';
import { contentOf, FPS, Reel, reelTiming, type ReelSpec } from '@motionmind/reel-engine';

/** One still of a reel in a style: its busiest scene (most pieces Claude placed, else steps or numbers), once it has all come in. */
export default function StyleThumb({ spec }: { spec: ReelSpec }) {
  const { timed, totalFrames } = useMemo(() => reelTiming(spec), [spec]);
  const designed = [...timed].sort((a, b) => (b.visual?.elements.length ?? 0) - (a.visual?.elements.length ?? 0))[0];
  const beat = designed?.visual ? designed : timed.find((b) => ['flow', 'stats'].includes(contentOf(b).lead)) ?? timed[1] ?? timed[0]!;
  return (
    <Thumbnail
      component={Reel}
      inputProps={spec}
      compositionWidth={1080}
      compositionHeight={1920}
      durationInFrames={totalFrames}
      fps={FPS}
      frameToDisplay={beat.start + Math.round(beat.frames * 0.9)}
      style={{ width: '100%', aspectRatio: '9 / 16' }}
    />
  );
}
