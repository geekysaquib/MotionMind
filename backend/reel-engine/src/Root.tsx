import React from 'react';
import { Composition } from 'remotion';
import './fonts';
import { Reel } from './Reel';
import { Cover, type CoverSpec } from './Cover';
import { COVER_DIMS } from './coverLayout';
import { FPS, SAMPLE_REEL, reelTiming, type ReelSpec } from './script';

// The export (and render.mjs) use this. The reel comes in as props; the sample reel is the default.
export const Root: React.FC = () => (
  <>
    <Composition
      id="Reel"
      component={Reel}
      defaultProps={SAMPLE_REEL}
      calculateMetadata={({ props }: { props: ReelSpec }) => ({ durationInFrames: reelTiming(props).totalFrames })}
      durationInFrames={reelTiming(SAMPLE_REEL).totalFrames}
      fps={FPS}
      width={1080}
      height={1920}
    />
    <Composition
      id="Cover"
      component={Cover}
      defaultProps={{ ...SAMPLE_REEL, cover: { scene: 0, headline: 'Uber ka *live heatmap*', kicker: 'How it works', style: 'bold', size: 'reel', brand: true } } as CoverSpec}
      // The picture's size comes from the cover settings: Reels cover, feed post or square.
      calculateMetadata={({ props }: { props: CoverSpec }) => ({ ...(COVER_DIMS[props.cover.size] ?? COVER_DIMS.reel), durationInFrames: 1 })}
      durationInFrames={1}
      fps={FPS}
      width={1080}
      height={1920}
    />
  </>
);
