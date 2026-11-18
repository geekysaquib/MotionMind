import { randomUUID } from 'node:crypto';
import { mkdir, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Platform } from '@motionmind/shared';
import { renderHtmlJob, snapshotHtml, type HtmlRenderInput } from './hyperframes';

/**
 * MP4 export on the machine running the API (your PC): Claude's HyperFrames composition is rendered in headless
 * Chrome by the HyperFrames CLI, and FFmpeg adds the voice. Takes a few minutes of CPU per reel.
 */
export interface RenderJob {
  id: string;
  projectId: string;
  status: 'queued' | 'bundling' | 'rendering' | 'finishing' | 'done' | 'failed';
  progress: number;
  /** What is happening right now, in plain words ("Drawing frame 1200 of 2700, about 4 minutes left"). */
  detail?: string;
  file?: string;
  error?: string;
  startedAt: string;
  finishedAt?: string;
}

export interface Renderer {
  start(userId: string, projectId: string, input: HtmlRenderInput, platform?: Platform): RenderJob;
  latest(userId: string, projectId: string, platform?: Platform): RenderJob | null;
  /** One frame of the animation at `at` seconds, as a PNG (the cover). Returns its file name. */
  still(html: string, at: number, projectId?: string): Promise<string>;
  /** Deletes the finished videos and cover images of a project, and forgets its jobs. */
  removeProject?(userId: string, projectId: string, files?: string[]): Promise<void>;
  /** Deletes finished files by name (covers that were replaced). */
  removeFiles?(files: string[]): Promise<void>;
  /** Absolute path of a finished render, by file name; null if unknown. */
  filePath(file: string): string | null;
}

const here = path.dirname(fileURLToPath(import.meta.url));
export const RENDERS_DIR = path.resolve(here, '../../../renders');

export class HyperFramesRenderer implements Renderer {
  private jobs = new Map<string, RenderJob>();
  /** Cover images made so far, by file name, with the project each belongs to (when known). */
  private stills = new Map<string, string | null>();
  private queue: Promise<void> = Promise.resolve();

  constructor() {
    void cleanStaleWorkFolders();
  }

  start(userId: string, projectId: string, input: HtmlRenderInput, platform: Platform = 'instagram'): RenderJob {
    const running = this.latest(userId, projectId, platform);
    if (running && ['queued', 'bundling', 'rendering', 'finishing'].includes(running.status)) return running;
    const job: RenderJob = { id: randomUUID(), projectId, status: 'queued', progress: 0, startedAt: new Date().toISOString(), detail: 'Waiting for the export before it to finish…' };
    this.jobs.set(`${userId}:${projectId}:${platform}`, job);
    // One render at a time: two at once would each take twice as long on one PC.
    this.queue = this.queue.then(async () => {
      job.status = 'bundling';
      job.detail = 'Preparing the animation…';
      await mkdir(RENDERS_DIR, { recursive: true });
      await renderHtmlJob(job, input, RENDERS_DIR);
    });
    return job;
  }

  latest(userId: string, projectId: string, platform: Platform = 'instagram') {
    return this.jobs.get(`${userId}:${projectId}:${platform}`) ?? null;
  }

  filePath(file: string) {
    if (!/^[0-9a-f-]{36}\.(mp4|png|jpg)$/.test(file)) return null;
    // Names are random UUIDs, so any one on disk may be served: covers kept as thumbnails outlive a restart of the API.
    return path.join(RENDERS_DIR, file);
  }

  async removeFiles(files: string[]) {
    const safe = files.filter((f) => /^[0-9a-f-]{36}\.(mp4|png|jpg)$/.test(f));
    for (const f of safe) this.stills.delete(f);
    await Promise.all(safe.map((f) => rm(path.join(RENDERS_DIR, f), { force: true })));
  }

  async removeProject(userId: string, projectId: string, extra: string[] = []) {
    const files: string[] = extra.filter((f) => /^[0-9a-f-]{36}\.(mp4|png|jpg)$/.test(f));
    for (const [key, job] of this.jobs) {
      if (!key.startsWith(`${userId}:${projectId}:`)) continue;
      this.jobs.delete(key);
      if (job.file) files.push(job.file);
    }
    for (const [file, owner] of this.stills) {
      if (owner === projectId) {
        this.stills.delete(file);
        files.push(file);
      }
    }
    await Promise.all(files.map((f) => rm(path.join(RENDERS_DIR, f), { force: true })));
  }

  async still(html: string, at: number, projectId: string | null = null) {
    await mkdir(RENDERS_DIR, { recursive: true });
    const file = await snapshotHtml(html, at, RENDERS_DIR);
    this.stills.set(file, projectId);
    return file;
  }
}

/** Work folders left behind when the API stopped in the middle of a render (they hold whole videos). */
async function cleanStaleWorkFolders() {
  try {
    const names = (await readdir(RENDERS_DIR)).filter((n) => n.startsWith('hf-'));
    for (const n of names) {
      const full = path.join(RENDERS_DIR, n);
      const info = await stat(full).catch(() => null);
      if (info && Date.now() - info.mtimeMs > 2 * 3_600_000) await rm(full, { recursive: true, force: true });
    }
  } catch {
    // No renders folder yet.
  }
}
