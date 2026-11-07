// What the web app imports (as @motionmind/reel-engine) to preview reels in the browser.
import './fonts';
export { Reel } from './Reel';
export { Cover, type CoverSpec } from './Cover';
export { COVER_DIMS, fitHeadline, countLines, type CoverProps } from './coverLayout';
export { contentOf, captionChunks, splitNumber, countText, type BeatContent } from './styles/common';
export { FPS, SAMPLE_REEL, DEFAULT_BRAND, STYLE_IDS, DEFAULT_STYLE, styleOf, reelTiming, timeBeats, sceneRates, wordsFromPeaks, type Beat, type Brand, type CaptionStyle, type Card, type CardRow, type ReelSpec, type StyleId, type TimedBeat, type Tone } from './script';
