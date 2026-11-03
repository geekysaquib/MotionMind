import { useMemo } from 'react';
import { Player } from '@remotion/player';
import { FPS, Reel, reelTiming, TRAIN_REEL, type ReelSpec } from '@motionmind/reel-engine';

/**
 * The reel engine, running in the browser: the same composition the renderer turns into an MP4,
 * played live so a script can be checked before anything is rendered.
 * Without a spec it plays the sample "Where is my Train" reel.
 */
export default function ReelPreview({ spec = TRAIN_REEL }: { spec?: ReelSpec }) {
  const total = useMemo(() => reelTiming(spec).totalFrames, [spec]);
  return (
    <div className="overflow-hidden rounded-2xl border border-line/10 bg-ink-900 shadow-soft">
      <Player
        component={Reel}
        inputProps={spec}
        durationInFrames={total}
        fps={FPS}
        compositionWidth={1080}
        compositionHeight={1920}
        style={{ width: '100%', aspectRatio: '9 / 16' }}
        controls
        clickToPlay
        acknowledgeRemotionLicense
      />
    </div>
  );
}
