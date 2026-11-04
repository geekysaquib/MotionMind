// Renders cover images from a reel spec, to eyeball the layouts without the app.
//   npm run reel:cover -- backend/reel-engine/samples/soundbox.json out/covers [scene] [headline]
// Writes one PNG per style (bold, center, split) at the Reels size, plus the bold style at feed and square size.
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';
import type { ReelSpec } from './src/script';

const [specPath, outDir = 'out/covers', sceneArg, ...rest] = process.argv.slice(2);
if (!specPath) throw new Error('Usage: reel:cover <spec.json> [outDir] [scene] [headline]');
const spec = JSON.parse(await readFile(specPath, 'utf8')) as ReelSpec;
const here = path.dirname(fileURLToPath(import.meta.url));
const browserExecutable = process.env.REMOTION_BROWSER || undefined;
const serveUrl = await bundle({ entryPoint: path.join(here, 'src/index.ts') });
await mkdir(outDir, { recursive: true });

const headline = rest.join(' ') || spec.title.replace(/(\p{L}{5,})/u, '*$1*');
const jobs = [
  ['bold', 'reel'], ['center', 'reel'], ['split', 'reel'], ['bold', 'feed'], ['bold', 'square'],
] as const;
for (const [style, size] of jobs) {
  const inputProps = { ...spec, cover: { scene: Number(sceneArg ?? 0), headline, kicker: 'How it works', style, size, brand: true } } as unknown as Record<string, unknown>;
  const composition = await selectComposition({ serveUrl, id: 'Cover', inputProps, browserExecutable });
  const output = path.join(outDir, `cover-${style}-${size}.png`);
  await renderStill({ serveUrl, composition, inputProps, frame: 0, output, browserExecutable, scale: 0.5 });
  console.log(output, `${composition.width}x${composition.height}`);
}
