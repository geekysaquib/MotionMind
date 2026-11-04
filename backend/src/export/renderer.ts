import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * MP4 export with Remotion, on the machine running the API (your PC). It can't run on Netlify:
 * rendering needs a headless Chrome and minutes of CPU. Remotion downloads its Chrome on first use.
 *
 * The Remotion packages are imported by name at runtime so the Netlify function bundle never includes them.
 */
export interface RenderJob {
  id: string;
  projectId: string;
  status: 'bundling' | 'rendering' | 'done' | 'failed';
  progress: number;
  file?: string;
  error?: string;
  startedAt: string;
  finishedAt?: string;
}

export interface Renderer {
  start(userId: string, projectId: string, inputProps: Record<string, unknown>): RenderJob;
  latest(userId: string, projectId: string): RenderJob | null;
  /** Absolute path of a finished render, by file name; null if unknown. */
  filePath(file: string): string | null;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const ENGINE_ENTRY = path.resolve(here, '../../reel-engine/src/index.ts');
export const RENDERS_DIR = path.resolve(here, '../../../renders');

export class RemotionRenderer implements Renderer {
  private jobs = new Map<string, RenderJob>();
  private serveUrl: Promise<string> | null = null;

  start(userId: string, projectId: string, inputProps: Record<string, unknown>): RenderJob {
    const running = this.latest(userId, projectId);
    if (running && (running.status === 'bundling' || running.status === 'rendering')) return running;
    const job: RenderJob = { id: randomUUID(), projectId, status: 'bundling', progress: 0, startedAt: new Date().toISOString() };
    this.jobs.set(`${userId}:${projectId}`, job);
    void this.run(job, inputProps);
    return job;
  }

  latest(userId: string, projectId: string) {
    return this.jobs.get(`${userId}:${projectId}`) ?? null;
  }

  filePath(file: string) {
    if (!/^[0-9a-f-]{36}\.mp4$/.test(file)) return null;
    return [...this.jobs.values()].some((j) => j.file === file) ? path.join(RENDERS_DIR, file) : null;
  }

  private async run(job: RenderJob, inputProps: Record<string, unknown>) {
    try {
      const bundlerName = '@remotion/bundler';
      const rendererName = '@remotion/renderer';
      const { bundle } = (await import(bundlerName)) as typeof import('@remotion/bundler');
      const { renderMedia, selectComposition } = (await import(rendererName)) as typeof import('@remotion/renderer');
      // The engine is bundled once per server run; later exports reuse it.
      this.serveUrl ??= bundle({ entryPoint: ENGINE_ENTRY });
      const serveUrl = await this.serveUrl;
      const browserExecutable = process.env.REMOTION_BROWSER || undefined;
      const composition = await selectComposition({ serveUrl, id: 'Reel', inputProps, browserExecutable });
      job.status = 'rendering';
      await mkdir(RENDERS_DIR, { recursive: true });
      const file = `${job.id}.mp4`;
      await renderMedia({
        serveUrl,
        composition,
        inputProps,
        codec: 'h264',
        crf: 18,
        pixelFormat: 'yuv420p',
        outputLocation: path.join(RENDERS_DIR, file),
        browserExecutable,
        onProgress: ({ progress }) => {
          job.progress = Math.round(progress * 100) / 100;
        },
      });
      job.file = file;
      job.progress = 1;
      job.status = 'done';
    } catch (err) {
      this.serveUrl = null;
      job.status = 'failed';
      job.error = err instanceof Error ? err.message.split('\n')[0] : String(err);
    } finally {
      job.finishedAt = new Date().toISOString();
    }
  }
}
