// CLI render of the sample reel (or a spec file), to check a style without the app.
//   node render.mjs stills out [style] [spec.json]   one still per scene
//   node render.mjs video out [style] [spec.json]    the whole MP4
import { bundle } from '@remotion/bundler';
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const [mode = 'stills', out = 'out', style, specFile] = process.argv.slice(2);
// Remotion downloads its own headless Chrome on first run. Set REMOTION_BROWSER to use an installed one.
const browserExecutable = process.env.REMOTION_BROWSER || undefined;
const serveUrl = await bundle({ entryPoint: path.resolve('src/index.ts') });
const base = specFile ? JSON.parse(readFileSync(specFile, 'utf8')) : null;
const probe = await selectComposition({ serveUrl, id: 'Reel', browserExecutable, inputProps: base ?? {} });
const inputProps = { ...(base ?? probe.defaultProps), ...(style ? { style } : {}) };
const composition = await selectComposition({ serveUrl, id: 'Reel', browserExecutable, inputProps });
console.log('frames', composition.durationInFrames);
if (mode === 'stills') {
  // A settled moment in every scene, plus the end card.
  const { reelTiming } = await import('./src/script.ts').catch(() => ({ reelTiming: null }));
  const frames = reelTiming ? [...reelTiming(inputProps).timed.map((b) => b.start + Math.min(b.frames - 1, 70)), composition.durationInFrames - 20] : [40, 200, 400, 600, 800, 1000];
  for (const f of frames) {
    await renderStill({ serveUrl, composition, inputProps, frame: f, output: `${out}/${style ?? 'reel'}_${f}.png`, browserExecutable, scale: 0.5 });
  }
} else {
  await renderMedia({
    serveUrl, composition, inputProps, codec: 'h264', outputLocation: `${out}/${style ?? 'reel'}.mp4`, browserExecutable,
    crf: 18, pixelFormat: 'yuv420p',
    onProgress: ({ progress }) => { if (Math.round(progress * 100) % 10 === 0) process.stdout.write(`${Math.round(progress * 100)}% `); },
  });
}
console.log('done');
