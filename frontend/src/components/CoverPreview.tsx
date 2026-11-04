import { useMemo } from 'react';
import { Thumbnail } from '@remotion/player';
import { Cover, COVER_DIMS, FPS, type CoverSpec } from '@motionmind/reel-engine';

/** The cover, drawn live in the browser by the same engine that renders the final image. */
export default function CoverPreview({ spec }: { spec: CoverSpec }) {
  const dims = COVER_DIMS[spec.cover.size] ?? COVER_DIMS.reel;
  const inputProps = useMemo(() => spec, [spec]);
  return (
    <Thumbnail
      component={Cover}
      inputProps={inputProps}
      compositionWidth={dims.width}
      compositionHeight={dims.height}
      frameToDisplay={0}
      durationInFrames={1}
      fps={FPS}
      style={{ width: '100%', aspectRatio: `${dims.width} / ${dims.height}` }}
    />
  );
}
