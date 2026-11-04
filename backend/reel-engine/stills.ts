// Renders one still per scene of a reel spec, to eyeball the 3D graphics without exporting a video.
//   npm run reel:stills -- backend/reel-engine/samples/soundbox.json out/stills
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';
import { reelTiming, type ReelSpec } from './src/script';

const [specPath, outDir = 'out/stills'] = process.argv.slice(2);
if (!specPath) throw new Error('Usage: reel:stills <spec.json> [outDir]');
const spec = JSON.parse(await readFile(specPath, 'utf8')) as ReelSpec;
const here = path.dirname(fileURLToPath(import.meta.url));
const browserExecutable = process.env.REMOTION_BROWSER || undefined;

const serveUrl = await bundle({ entryPoint: path.join(here, 'src/index.ts') });
const composition = await selectComposition({ serveUrl, id: 'Reel', inputProps: spec as unknown as Record<string, unknown>, browserExecutable });
await mkdir(outDir, { recursive: true });
for (const [i, b] of reelTiming(spec).timed.entries()) {
  // Late in the scene, once the camera has settled and the links have drawn on.
  const frame = b.start + Math.round(b.frames * 0.75);
  const output = path.join(outDir, `scene-${String(i + 1).padStart(2, '0')}.png`);
  await renderStill({ serveUrl, composition, inputProps: spec as unknown as Record<string, unknown>, frame, output, browserExecutable, scale: 0.5 });
  console.log(output);
}
