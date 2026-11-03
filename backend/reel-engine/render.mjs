import { bundle } from '@remotion/bundler';
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import path from 'node:path';

const mode = process.argv[2] ?? 'stills';
const out = process.argv[3] ?? 'out';
const browserExecutable = '/opt/pw-browsers/chromium';
const serveUrl = await bundle({ entryPoint: path.resolve('src/index.ts') });
const composition = await selectComposition({ serveUrl, id: 'Reel', browserExecutable });
console.log('frames', composition.durationInFrames);
if (mode === 'stills') {
  const frames = (process.argv[4] ?? '30,250,450,700,950,1150,1400,1600,1750,1880').split(',').map(Number);
  for (const f of frames) {
    await renderStill({ serveUrl, composition, frame: f, output: `${out}/still_${f}.png`, browserExecutable, scale: 0.5 });
  }
} else {
  await renderMedia({
    serveUrl, composition, codec: 'h264', outputLocation: `${out}/reel.mp4`, browserExecutable,
    concurrency: 4, crf: 18, pixelFormat: 'yuv420p',
    onProgress: ({ progress }) => { if (Math.round(progress * 100) % 10 === 0) process.stdout.write(`${Math.round(progress * 100)}% `); },
  });
}
console.log('done');
