import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { copyFile, mkdir, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { Platform } from '@motionmind/shared';
import type { RenderJob } from './renderer';

// The video kit's render pipeline: HyperFrames turns Claude's HTML composition into frames and an MP4 in
// headless Chrome, then FFmpeg lays the voice (and music) under it and levels the loudness to -14 LUFS.

const require = createRequire(import.meta.url);

export interface AudioClip {
  /** Signed URL or data URL of the clip. */
  url: string;
  /** Seconds into the video where it starts. */
  at: number;
  /** Part of the file to play (seconds), for a trimmed recording. */
  from?: number;
  to?: number;
  volume?: number;
  /** Loop it to the end of the video (background music). */
  loop?: boolean;
}

export interface HtmlRenderInput {
  html: string;
  duration: number;
  audio: AudioClip[];
}

/** Any GSAP build from a CDN becomes the local copy, so renders work offline and the same every time. */
export const localizeGsap = (html: string, local: string) => html.replace(/https:\/\/(?:cdn\.jsdelivr\.net\/npm|unpkg\.com|cdnjs\.cloudflare\.com\/ajax\/libs)\/gsap@?[^"'\s]*?\/(?:dist\/)?gsap(?:\.min)?\.js/g, local);

export interface RunLimits {
  /** Stop when nothing is printed for this long (ms): the tool has hung. */
  idleMs?: number;
  /** Stop after this long in total (ms). */
  totalMs?: number;
}

/** Kills a process and everything it started (HyperFrames runs Chrome workers). */
function killTree(pid: number | undefined) {
  if (!pid) return;
  if (process.platform === 'win32') spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true }).on('error', () => undefined);
  else {
    try {
      process.kill(-pid, 'SIGKILL');
    } catch {
      try {
        process.kill(pid, 'SIGKILL');
      } catch {
        /* already gone */
      }
    }
  }
}

/**
 * Runs a tool, passing every output line on. Our renders are queued one at a time, so HyperFrames' own account-wide
 * lock is turned off: a crashed or hung earlier run can no longer hold it and keep every later export waiting.
 */
export function run(bin: string, args: string[], cwd: string, onLine?: (line: string) => void, limits: RunLimits = {}): Promise<{ code: number; tail: string; timedOut?: 'idle' | 'total' }> {
  return new Promise((resolve) => {
    const p = spawn(bin, args, { cwd, windowsHide: true, detached: process.platform !== 'win32', env: { ...process.env, HYPERFRAMES_RENDER_LOCK: 'off' } });
    let tail = '';
    let timedOut: 'idle' | 'total' | undefined;
    let idle: ReturnType<typeof setTimeout> | undefined;
    const stop = (why: 'idle' | 'total') => {
      timedOut = why;
      killTree(p.pid);
    };
    const poke = () => {
      if (!limits.idleMs) return;
      if (idle) clearTimeout(idle);
      idle = setTimeout(() => stop('idle'), limits.idleMs);
    };
    const total = limits.totalMs ? setTimeout(() => stop('total'), limits.totalMs) : undefined;
    poke();
    const take = (b: Buffer) => {
      poke();
      const s = b.toString();
      tail = (tail + s).slice(-4000);
      s.split(/\r?\n|\r/).forEach((l) => l && onLine?.(l));
    };
    p.stdout.on('data', take);
    p.stderr.on('data', take);
    const done = (code: number, extra = '') => {
      if (idle) clearTimeout(idle);
      if (total) clearTimeout(total);
      resolve({ code, tail: tail + extra, ...(timedOut ? { timedOut } : {}) });
    };
    p.on('error', (e) => done(-1, String(e)));
    p.on('close', (code) => done(timedOut ? -1 : (code ?? -1)));
  });
}

/** HyperFrames prints machine-readable progress: @hf-progress {"code":"capture","done":20,"total":90,"pct":35}. */
export function parseProgress(line: string): { code: string; done: number; total: number; pct: number } | null {
  const i = line.indexOf('@hf-progress ');
  if (i < 0) return null;
  try {
    const j = JSON.parse(line.slice(i + 13)) as { code?: string; done?: number; total?: number; pct?: number };
    return typeof j.pct === 'number' ? { code: String(j.code ?? ''), done: Number(j.done ?? 0), total: Number(j.total ?? 0), pct: j.pct } : null;
  } catch {
    return null;
  }
}

const mins = (s: number) => (s < 90 ? 'under 2 minutes' : `about ${Math.round(s / 60)} minutes`);

async function fetchTo(url: string, file: string) {
  const res = await fetch(url, { signal: AbortSignal.timeout(90_000) });
  if (!res.ok) throw new Error(`Could not load an audio file (${res.status}).`);
  await writeFile(file, Buffer.from(await res.arrayBuffer()));
}

/** Writes the composition into a fresh folder with a local GSAP, ready for the HyperFrames CLI. */
export async function prepareProject(dir: string, html: string) {
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'index.html'), localizeGsap(html, 'gsap.min.js'), 'utf8');
  await copyFile(require.resolve('gsap/dist/gsap.min.js'), path.join(dir, 'gsap.min.js'));
}

const hyperframesBin = () => path.join(path.dirname(require.resolve('hyperframes/package.json')), 'bin', 'hyperframes.mjs');
const ffmpegBin = () => process.env.FFMPEG_BIN || 'ffmpeg';

/** The FFmpeg arguments that put the audio clips under the silent video and level the result. */
export function muxArgs(video: string, clips: { file: string; clip: AudioClip }[], duration: number, out: string): string[] {
  const args = ['-y', '-loglevel', 'error', '-i', video];
  for (const { file, clip } of clips) {
    if (clip.loop) args.push('-stream_loop', '-1');
    if (clip.from != null) args.push('-ss', clip.from.toFixed(3));
    if (clip.to != null && clip.from != null) args.push('-t', Math.max(0.1, clip.to - clip.from).toFixed(3));
    args.push('-i', file);
  }
  if (!clips.length) return [...args, '-c:v', 'copy', '-movflags', '+faststart', '-t', duration.toFixed(3), out];
  const parts = clips.map(({ clip }, i) => {
    const ms = Math.max(0, Math.round(clip.at * 1000));
    return `[${i + 1}:a]aresample=48000,adelay=${ms}|${ms},volume=${(clip.volume ?? 1).toFixed(3)}[a${i}]`;
  });
  const mix = `${clips.map((_, i) => `[a${i}]`).join('')}amix=inputs=${clips.length}:normalize=0:dropout_transition=0,atrim=0:${duration.toFixed(3)},loudnorm=I=-14:TP=-1.2:LRA=11[aout]`;
  return [...args, '-filter_complex', [...parts, mix].join(';'), '-map', '0:v', '-map', '[aout]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-t', duration.toFixed(3), out];
}

/** Renders one job: HyperFrames frames to MP4, then the audio mix. Updates the job as it goes. */
export async function renderHtmlJob(job: RenderJob, input: HtmlRenderInput, rendersDir: string) {
  const dir = path.join(rendersDir, `hf-${job.id}`);
  try {
    await prepareProject(dir, input.html);
    job.status = 'rendering';
    job.detail = 'Starting the renderer…';
    // HyperFrames reports its own progress (0 to 100 %, frames drawn); it maps onto 2 % to 88 % of the whole job.
    const began = Date.now();
    const r = await run(
      process.execPath,
      [hyperframesBin(), 'render', dir, '-o', path.join(dir, 'video.mp4'), '--quality', 'delivery', '--fps', '30'],
      dir,
      (line) => {
        const p = parseProgress(line);
        if (!p) return;
        job.progress = Math.max(job.progress, 0.02 + (Math.min(100, p.pct) / 100) * 0.86);
        if (p.code === 'capture' && p.total > 0) {
          const rate = p.done / Math.max(1, (Date.now() - began) / 1000);
          const left = rate > 0 ? (p.total - p.done) / rate : 0;
          job.detail = `Drawing frame ${p.done} of ${p.total}${p.done > 30 ? `, ${mins(left)} left` : ''}`;
        } else if (p.code === 'encode') job.detail = 'Encoding the video…';
        else if (p.code === 'assemble') job.detail = 'Putting the video together…';
      },
      // A heavy frame can take a while, but five silent minutes means the renderer has hung.
      { idleMs: 5 * 60_000, totalMs: 90 * 60_000 },
    );
    if (r.timedOut) throw new Error(r.timedOut === 'idle' ? 'The renderer stopped responding for 5 minutes and was stopped. Try the export again; if it happens again, check the animation for something heavy (huge blurs, hundreds of moving pieces).' : 'The render took longer than 90 minutes and was stopped.');
    if (r.code !== 0) throw new Error(`HyperFrames could not render the animation: ${lastError(r.tail)}`);
    job.status = 'finishing';
    job.progress = Math.max(job.progress, 0.9);
    job.detail = 'Adding your voice and levelling the sound…';
    const clips: { file: string; clip: AudioClip }[] = [];
    for (const [i, clip] of input.audio.entries()) {
      const file = path.join(dir, `audio-${i}`);
      await fetchTo(clip.url, file);
      clips.push({ file, clip });
    }
    const out = path.join(rendersDir, `${job.id}.mp4`);
    const m = await run(ffmpegBin(), muxArgs(path.join(dir, 'video.mp4'), clips, input.duration, out), dir, undefined, { totalMs: 10 * 60_000 });
    if (m.code !== 0) {
      // Without FFmpeg the silent video is still worth having.
      if (clips.length) throw new Error(`FFmpeg could not add the voice: ${lastError(m.tail)}`);
      await rename(path.join(dir, 'video.mp4'), out);
    }
    job.file = `${job.id}.mp4`;
    job.progress = 1;
    job.status = 'done';
    job.detail = undefined;
  } catch (err) {
    job.status = 'failed';
    job.error = err instanceof Error ? err.message.split('\n')[0] : String(err);
  } finally {
    job.finishedAt = new Date().toISOString();
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

/** One still of the animation at a moment (the cover), as a PNG file in the renders folder. */
export async function snapshotHtml(html: string, at: number, rendersDir: string): Promise<string> {
  const id = randomUUID();
  const dir = path.join(rendersDir, `hf-${id}`);
  try {
    await prepareProject(dir, html);
    const outDir = path.join(dir, 'shots');
    const r = await run(process.execPath, [hyperframesBin(), 'snapshot', dir, '--at', at.toFixed(2), '--no-end', '-o', outDir], dir, undefined, { totalMs: 3 * 60_000 });
    if (r.timedOut) throw new Error('Taking the picture took over 3 minutes and was stopped. Try again.');
    if (r.code !== 0) throw new Error(`HyperFrames could not take the picture: ${lastError(r.tail)}`);
    const png = (await readdir(outDir)).find((f) => f.endsWith('.png'));
    if (!png) throw new Error('HyperFrames made no picture.');
    const file = `${id}.png`;
    await rename(path.join(outDir, png), path.join(rendersDir, file));
    return file;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

const lastError = (tail: string) =>
  tail
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /error|fail|invalid|cannot|could not/i.test(l))
    .slice(-1)[0]
    ?.slice(0, 300) ?? 'unknown error';

export type { Platform };
