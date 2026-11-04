import React from 'react';
import { Composition } from 'remotion';
import './fonts';
import { Reel } from './Reel';
import { Cover, type CoverSpec } from './Cover';
import { COVER_DIMS } from './coverLayout';
import { FPS, TRAIN_REEL, reelTiming, type ReelSpec } from './script';

// CLI renders (render.mjs) use this. The reel comes in as props; the sample train reel is the default.
export const Root: React.FC = () => (
  <>
  <Composition
    id="Reel"
    component={Reel}
    defaultProps={TRAIN_REEL}
    calculateMetadata={({ props }: { props: ReelSpec }) => ({ durationInFrames: reelTiming(props).totalFrames })}
    durationInFrames={reelTiming(TRAIN_REEL).totalFrames}
    fps={FPS}
    width={1080}
    height={1920}
  />
  <Composition
    id="Cover"
    component={Cover}
    defaultProps={{ ...TRAIN_REEL, cover: { scene: 0, headline: 'Where is my *Train*', kicker: 'How it works', style: 'bold', size: 'reel', brand: true } } as CoverSpec}
    // The picture's size comes from the cover settings: Reels cover, feed post or square.
    calculateMetadata={({ props }: { props: CoverSpec }) => ({ ...(COVER_DIMS[props.cover.size] ?? COVER_DIMS.reel), durationInFrames: 1 })}
    durationInFrames={1}
    fps={FPS}
    width={1080}
    height={1920}
  />
  </>
);
