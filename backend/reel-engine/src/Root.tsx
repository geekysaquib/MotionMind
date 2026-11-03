import React from 'react';
import { Composition } from 'remotion';
import './fonts';
import { Reel } from './Reel';
import { FPS, TRAIN_REEL, reelTiming, type ReelSpec } from './script';

// CLI renders (render.mjs) use this. The reel comes in as props; the sample train reel is the default.
export const Root: React.FC = () => (
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
);
