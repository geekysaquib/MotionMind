import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Platform } from '@motionmind/shared';

/**
 * MP4 export with Remotion, on the machine running the API (your PC). Rendering needs a headless Chrome and
 * minutes of CPU; Remotion downloads its Chrome on first use.
 *
 * The Remotion packages are imported by name at runtime, so the API starts fast and tests never load them.
 */
export interface RenderJob {
  id: string;
  projectId: string;
  status: 'bundling' | 'rendering' | 'finishing' | 'done' | 'failed';
  progress: number;
  file?: string;
  error?: string;
  startedAt: string;
  finishedAt?: string;
}

export interface Renderer {
  start(userId: string, projectId: string, inputProps: Record<string, unknown>, platform?: Platform): RenderJob;
  latest(userId: string, projectId: string, platform?: Platform): RenderJob | null;
  /** Renders the reel's cover (a single image) and returns its file name. */
  still(inputProps: Record<string, unknown>, format: 'png' | 'jpeg'): Promise<string>;
  /** Absolute path of a finished render, by file name; null if unknown. */
  filePath(file: string): string | null;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const ENGINE_ENTRY = path.resolve(here, '../../reel-engine/src/index.ts');
export const RENDERS_DIR = path.resolve(here, '../../../renders');

export class RemotionRenderer implements Renderer {
  private jobs = new Map<string, RenderJob>();
  private serveUrl: Promise<string> | null = null;
  private stills = new Set<string>();

  start(userId: string, projectId: string, inputProps: Record<string, unknown>, platform: Platform = 'instagram'): RenderJob {
    const running = this.latest(userId, projectId, platform);
    if (running && (running.status === 'bundling' || running.status === 'rendering')) return running;
    const job: RenderJob = { id: randomUUID(), projectId, status: 'bundling', progress: 0, startedAt: new Date().toISOString() };
    this.jobs.set(`${userId}:${projectId}:${platform}`, job);
    void this.run(job, inputProps);
    return job;
  }

  latest(userId: string, projectId: string, platform: Platform = 'instagram') {
    return this.jobs.get(`${userId}:${projectId}:${platform}`) ?? null;
  }

  filePath(file: string) {
    if (!/^[0-9a-f-]{36}\.(mp4|png|jpg)$/.test(file)) return null;
    return this.stills.has(file) || [...this.jobs.values()].some((j) => j.file === file) ? path.join(RENDERS_DIR, file) : null;
  }

  async still(inputProps: Record<string, unknown>, format: 'png' | 'jpeg') {
    try {
      const bundlerName = '@remotion/bundler';
      const rendererName = '@remotion/renderer';
      const { bundle } = (await import(bundlerName)) as typeof import('@remotion/bundler');
      const { renderStill, selectComposition } = (await import(rendererName)) as typeof import('@remotion/renderer');
      this.serveUrl ??= bundle({ entryPoint: ENGINE_ENTRY });
      const serveUrl = await this.serveUrl;
      const browserExecutable = process.env.REMOTION_BROWSER || undefined;
      const composition = await selectComposition({ serveUrl, id: 'Cover', inputProps, browserExecutable });
      await mkdir(RENDERS_DIR, { recursive: true });
      const file = `${randomUUID()}.${format === 'jpeg' ? 'jpg' : 'png'}`;
      await renderStill({ serveUrl, composition, inputProps, frame: 0, output: path.join(RENDERS_DIR, file), imageFormat: format, ...(format === 'jpeg' ? { jpegQuality: 92 } : {}), browserExecutable });
      this.stills.add(file);
      return file;
    } catch (err) {
      this.serveUrl = null;
      throw err;
    }
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
        crf: 16,
        // Sharper frames than the default (80): text and thin lines stay clean after Instagram re-encodes the video.
        jpegQuality: 95,
        x264Preset: 'slow',
        pixelFormat: 'yuv420p',
        outputLocation: path.join(RENDERS_DIR, file),
        browserExecutable,
        onProgress: ({ progress }) => {
          job.progress = Math.round(progress * 100) / 100;
        },
      });
      // The kit's finishing pass: loudness to -14 LUFS (what Instagram and YouTube play at) and a fast-start MP4.
      job.status = 'finishing';
      await finishWithFfmpeg(path.join(RENDERS_DIR, file));
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

/**
 * FFmpeg pass after Remotion, as in the video kit: normalise the loudness to -14 LUFS and move the index to the
 * front so the file plays while it downloads. The video stream is copied, not re-encoded. Without FFmpeg (or if
 * it fails) the Remotion file is kept as it is.
 */
export async function finishWithFfmpeg(file: string, bin = process.env.FFMPEG_BIN || 'ffmpeg'): Promise<boolean> {
  const tmp = file.replace(/\.mp4$/,'.finishing.mp4');
  const ok = await new Promise<boolean>((resolve) => {
    const p = spawn(bin, ['-y', '-loglevel', 'error', '-i', file, '-c:v', 'copy', '-af', 'loudnorm=I=-14:TP=-1.2:LRA=11', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', tmp], { stdio: 'ignore', windowsHide: true });
    p.on('error', () => resolve(false));
    p.on('close', (code) => resolve(code === 0));
  });
  if (!ok) {
    await rm(tmp, { force: true });
    return false;
  }
  await rename(tmp, file);
  return true;
}
