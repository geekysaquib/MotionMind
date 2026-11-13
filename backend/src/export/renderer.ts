import { randomUUID } from 'node:crypto';
import { mkdir, rm } from 'node:fs/promises';
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
  status: 'bundling' | 'rendering' | 'finishing' | 'done' | 'failed';
  progress: number;
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
  removeProject?(userId: string, projectId: string): Promise<void>;
  /** Absolute path of a finished render, by file name; null if unknown. */
  filePath(file: string): string | null;
}

const here = path.dirname(fileURLToPath(import.meta.url));
export const RENDERS_DIR = path.resolve(here, '../../../renders');

export class HyperFramesRenderer implements Renderer {
  private jobs = new Map<string, RenderJob>();
  /** Cover images made so far, by file name, with the project each belongs to (when known). */
  private stills = new Map<string, string | null>();

  start(userId: string, projectId: string, input: HtmlRenderInput, platform: Platform = 'instagram'): RenderJob {
    const running = this.latest(userId, projectId, platform);
    if (running && ['bundling', 'rendering', 'finishing'].includes(running.status)) return running;
    const job: RenderJob = { id: randomUUID(), projectId, status: 'bundling', progress: 0, startedAt: new Date().toISOString() };
    this.jobs.set(`${userId}:${projectId}:${platform}`, job);
    void mkdir(RENDERS_DIR, { recursive: true }).then(() => renderHtmlJob(job, input, RENDERS_DIR));
    return job;
  }

  latest(userId: string, projectId: string, platform: Platform = 'instagram') {
    return this.jobs.get(`${userId}:${projectId}:${platform}`) ?? null;
  }

  filePath(file: string) {
    if (!/^[0-9a-f-]{36}\.(mp4|png|jpg)$/.test(file)) return null;
    return this.stills.has(file) || [...this.jobs.values()].some((j) => j.file === file) ? path.join(RENDERS_DIR, file) : null;
  }

  async removeProject(userId: string, projectId: string) {
    const files: string[] = [];
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
