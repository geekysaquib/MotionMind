// What the web app imports (as @motionmind/reel-engine) to preview reels in the browser.
import './fonts';
export { Reel } from './Reel';
export { autoScene, computeLayout } from './autoScene';
export { Cover, type CoverSpec } from './Cover';
export { COVER_DIMS, fitHeadline, countLines, worldRegion, type CoverProps } from './coverLayout';
export { layoutProps } from './IsoWorld';
export { FPS, TRAIN_REEL, DEFAULT_BRAND, reelTiming, timeBeats, sceneRates, type Beat, type Brand, type CaptionStyle, type ReelLook, type Card, type CardRow, type ReelSpec, type TimedBeat, type Tone } from './script';
