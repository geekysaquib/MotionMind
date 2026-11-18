import { spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { FootageWord, TimeRange } from '@motionmind/shared';

/**
 * The command-line tools raw footage editing runs on this machine: FFmpeg (probe, pauses, export), whisper.cpp
 * (words for captions) and yt-dlp (reference videos). Each is found on PATH or through an env var:
 * FFMPEG_BIN, FFPROBE_BIN, WHISPER_CPP_BIN + WHISPER_MODEL, YTDLP_BIN.
 */
export interface ToolStatus {
  ready: boolean;
  /** Version line, or what is missing as a plain sentence. */
  detail: string;
}

export interface ToolsReport {
  ffmpeg: ToolStatus;
  whisper: ToolStatus;
  ytDlp: ToolStatus;
}

export interface ProbeResult {
  durationSec: number;
  width: number;
  height: number;
  hasAudio: boolean;
}

export interface RenderPlan {
  /** Folder the job runs in: the captions file is read from here. */
  cwd: string;
  input: string;
  output: string;
  kept: TimeRange[];
  hasAudio: boolean;
  /** File name of an .ass captions file inside cwd, or null for no captions. */
  captions: string | null;
  durationSec: number;
}

export interface MediaTools {
  report(): Promise<ToolsReport>;
  probe(file: string): Promise<ProbeResult>;
  silences(file: string, opts: { noiseDb: number; minPause: number }): Promise<TimeRange[]>;
  /** Null words with a reason when whisper.cpp isn't set up. */
  transcribe(file: string, workDir: string): Promise<{ words: FootageWord[] | null; note: string | null }>;
  render(plan: RenderPlan, onProgress: (p: number) => void): Promise<void>;
}

interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

function run(bin: string, args: string[], opts: { cwd?: string; onStderr?: (chunk: string) => void } = {}): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { cwd: opts.cwd, windowsHide: true });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d: Buffer) => (stdout += d.toString()));
    child.stderr.on('data', (d: Buffer) => {
      const s = d.toString();
      // Keep only the tail: FFmpeg can print a lot over a long render.
      stderr = (stderr + s).slice(-200_000);
      opts.onStderr?.(s);
    });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

/** The last few meaningful lines of a tool's error output, for the log and the UI. */
function tail(text: string, lines = 3) {
  return text.trim().split(/\r?\n/).filter(Boolean).slice(-lines).join(' ').slice(0, 400);
}

/** Pauses from FFmpeg's silencedetect output. A silence still open at the end runs to `durationSec`. */
export function parseSilences(stderr: string, durationSec: number): TimeRange[] {
  const out: TimeRange[] = [];
  let open: number | null = null;
  for (const line of stderr.split(/\r?\n/)) {
    const s = /silence_start:\s*(-?[\d.]+)/.exec(line);
    if (s) open = Math.max(0, Number(s[1]));
    const e = /silence_end:\s*([\d.]+)/.exec(line);
    if (e && open !== null) {
      out.push({ start: open, end: Number(e[1]) });
      open = null;
    }
  }
  if (open !== null && durationSec > open) out.push({ start: open, end: durationSec });
  return out;
}

/** FFprobe's JSON: duration, displayed size (phones store portrait video rotated) and whether there is sound. */
export function parseProbe(json: string): ProbeResult {
  const data = JSON.parse(json) as {
    format?: { duration?: string };
    streams?: { codec_type?: string; width?: number; height?: number; duration?: string; tags?: { rotate?: string }; side_data_list?: { rotation?: number }[] }[];
  };
  const streams = data.streams ?? [];
  const video = streams.find((s) => s.codec_type === 'video');
  if (!video?.width || !video.height) throw new Error('No video stream found.');
  const rotation = Number(video.tags?.rotate ?? video.side_data_list?.find((d) => d.rotation !== undefined)?.rotation ?? 0);
  const sideways = Math.abs(rotation) % 180 === 90;
  const durationSec = Number(data.format?.duration ?? video.duration ?? 0);
  if (!(durationSec > 0)) throw new Error('The clip has no length.');
  return {
    durationSec: Math.round(durationSec * 1000) / 1000,
    width: sideways ? video.height : video.width,
    height: sideways ? video.width : video.height,
    hasAudio: streams.some((s) => s.codec_type === 'audio'),
  };
}

/** whisper.cpp's JSON (-oj) with one word per segment (-ml 1 -sow): offsets are in milliseconds. */
export function parseWhisper(json: string): FootageWord[] {
  const data = JSON.parse(json) as { transcription?: { offsets?: { from: number; to: number }; text?: string }[] };
  const words: FootageWord[] = [];
  for (const seg of data.transcription ?? []) {
    const text = (seg.text ?? '').trim();
    // Skip markers like [BLANK_AUDIO] or (music).
    if (!text || /^[[(].*[\])]$/.test(text) || !seg.offsets) continue;
    const start = seg.offsets.from / 1000;
    const end = Math.max(start + 0.05, seg.offsets.to / 1000);
    // A word that whisper split in two (no leading space) joins the previous one.
    const last = words[words.length - 1];
    if (last && !/^\s/.test(seg.text ?? '') && /^[^\s\p{P}]/u.test(text) && start - last.end < 0.05) {
      last.text += text;
      last.end = end;
    } else words.push({ text, start, end });
  }
  return words;
}

/** The FFmpeg filter graph that keeps `kept`, joins it, fills a 1080x1920 frame and burns the captions in. */
export function filterGraph(plan: Pick<RenderPlan, 'kept' | 'hasAudio' | 'captions'>): string {
  const parts: string[] = [];
  const joins: string[] = [];
  plan.kept.forEach((r, i) => {
    parts.push(`[0:v]trim=start=${r.start}:end=${r.end},setpts=PTS-STARTPTS[v${i}]`);
    if (plan.hasAudio) parts.push(`[0:a]atrim=start=${r.start}:end=${r.end},asetpts=PTS-STARTPTS[a${i}]`);
    joins.push(plan.hasAudio ? `[v${i}][a${i}]` : `[v${i}]`);
  });
  const n = plan.kept.length;
  parts.push(`${joins.join('')}concat=n=${n}:v=1:a=${plan.hasAudio ? 1 : 0}[vc]${plan.hasAudio ? '[ac]' : ''}`);
  // Fill the vertical frame: scale up until it covers, then crop the middle.
  const frame = 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30';
  parts.push(plan.captions ? `[vc]${frame},subtitles=${plan.captions}[vout]` : `[vc]${frame}[vout]`);
  if (plan.hasAudio) parts.push('[ac]loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[aout]');
  return parts.join(';\n');
}

function findOnPath(names: string[]): string | null {
  const dirs = (process.env.PATH ?? '').split(path.delimiter).filter(Boolean);
  const exts = process.platform === 'win32' ? ['.exe', '.cmd', ''] : [''];
  for (const name of names) for (const dir of dirs) for (const ext of exts) {
    const full = path.join(dir, name + ext);
    if (existsSync(full)) return full;
  }
  return null;
}

/** The real tools, run as child processes. */
export class LocalMediaTools implements MediaTools {
  private readonly ffmpeg: string | null;
  private readonly ffprobe: string | null;
  private readonly whisper: string | null;
  private readonly model: string | null;
  private readonly ytDlp: string | null;

  constructor(env: { FFMPEG_BIN?: string; FFPROBE_BIN?: string; WHISPER_CPP_BIN?: string; WHISPER_MODEL?: string; YTDLP_BIN?: string } = {}) {
    this.ffmpeg = env.FFMPEG_BIN || findOnPath(['ffmpeg']);
    this.ffprobe = env.FFPROBE_BIN || (this.ffmpeg ? path.join(path.dirname(this.ffmpeg), path.basename(this.ffmpeg).replace(/ffmpeg/i, 'ffprobe')) : null) || findOnPath(['ffprobe']);
    this.whisper = env.WHISPER_CPP_BIN || findOnPath(['whisper-cli', 'whisper-cpp']);
    this.model = env.WHISPER_MODEL || (this.whisper ? LocalMediaTools.findModel(this.whisper) : null);
    this.ytDlp = env.YTDLP_BIN || findOnPath(['yt-dlp']);
  }

  /** A ggml model next to the whisper.cpp binary: ./models, ../models or ../../models. */
  private static findModel(bin: string): string | null {
    const dir = path.dirname(bin);
    for (const d of [path.join(dir, 'models'), path.join(dir, '..', 'models'), path.join(dir, '..', '..', 'models'), dir]) {
      try {
        // Prefer the more accurate models when several are there.
        const files = readdirSync(d).filter((f) => /^ggml-.*\.bin$/.test(f) && !/silero|vad/i.test(f));
        const order = ['large-v3-turbo', 'large', 'medium', 'small', 'base', 'tiny'];
        files.sort((a, b) => order.findIndex((o) => a.includes(o)) - order.findIndex((o) => b.includes(o)));
        const best = files.find((f) => order.some((o) => f.includes(o))) ?? files[0];
        if (best) return path.join(d, best);
      } catch {
        // folder not there
      }
    }
    return null;
  }

  async report(): Promise<ToolsReport> {
    const version = async (bin: string | null, args: string[], missing: string): Promise<ToolStatus> => {
      if (!bin) return { ready: false, detail: missing };
      try {
        const r = await run(bin, args);
        const line = (r.stdout || r.stderr).trim().split(/\r?\n/)[0] ?? '';
        return r.code === 0 ? { ready: true, detail: line.slice(0, 120) } : { ready: false, detail: `${path.basename(bin)} did not start: ${tail(r.stderr, 1)}` };
      } catch (err) {
        return { ready: false, detail: `${path.basename(bin)} did not start: ${(err as Error).message}` };
      }
    };
    const [ffmpeg, ytDlp] = await Promise.all([
      version(this.ffmpeg, ['-hide_banner', '-version'], 'FFmpeg is not installed. Install it (winget install Gyan.FFmpeg) or set FFMPEG_BIN in .env.'),
      version(this.ytDlp, ['--version'], 'yt-dlp is not installed. Install it (winget install yt-dlp.yt-dlp) or set YTDLP_BIN in .env.'),
    ]);
    let whisper: ToolStatus;
    if (!this.whisper) whisper = { ready: false, detail: 'whisper.cpp is not installed, so clips get no captions. Set WHISPER_CPP_BIN (whisper-cli) and WHISPER_MODEL in .env.' };
    else if (!this.model || !existsSync(this.model)) whisper = { ready: false, detail: 'whisper.cpp has no model. Download one (for example ggml-base.bin) and set WHISPER_MODEL in .env.' };
    else whisper = { ready: true, detail: `${path.basename(this.whisper)} with ${path.basename(this.model)}` };
    return { ffmpeg, whisper, ytDlp };
  }

  private need(bin: string | null, name: string): string {
    if (!bin) throw new Error(`${name} is not installed on this computer.`);
    return bin;
  }

  async probe(file: string) {
    const r = await run(this.need(this.ffprobe, 'FFprobe'), ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', file]);
    if (r.code !== 0) throw new Error(`FFprobe could not read the clip: ${tail(r.stderr)}`);
    return parseProbe(r.stdout);
  }

  async silences(file: string, opts: { noiseDb: number; minPause: number }) {
    const probe = await this.probe(file);
    if (!probe.hasAudio) return [];
    const r = await run(this.need(this.ffmpeg, 'FFmpeg'), ['-hide_banner', '-nostats', '-i', file, '-vn', '-af', `silencedetect=noise=${opts.noiseDb}dB:d=${opts.minPause}`, '-f', 'null', '-']);
    if (r.code !== 0) throw new Error(`FFmpeg could not read the sound: ${tail(r.stderr)}`);
    return parseSilences(r.stderr, probe.durationSec);
  }

  async transcribe(file: string, workDir: string) {
    if (!this.whisper || !this.model || !existsSync(this.model)) {
      return { words: null, note: 'Captions need whisper.cpp. Once it is set up, run the analysis again to add them.' };
    }
    // whisper.cpp reads 16 kHz mono WAV.
    const wav = path.join(workDir, 'speech.wav');
    const conv = await run(this.need(this.ffmpeg, 'FFmpeg'), ['-hide_banner', '-y', '-i', file, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', wav]);
    if (conv.code !== 0) throw new Error(`FFmpeg could not extract the sound: ${tail(conv.stderr)}`);
    const base = path.join(workDir, 'words');
    try {
      const r = await run(this.whisper, ['-m', this.model, '-f', wav, '-l', 'auto', '-ml', '1', '-sow', '-oj', '-of', base, '-np']);
      if (r.code !== 0) throw new Error(`whisper.cpp failed: ${tail(r.stderr)}`);
      const words = parseWhisper(await readFile(`${base}.json`, 'utf8'));
      return { words, note: words.length ? null : 'whisper.cpp heard no words in this clip.' };
    } finally {
      await rm(wav, { force: true });
    }
  }

  async render(plan: RenderPlan, onProgress: (p: number) => void) {
    const ffmpeg = this.need(this.ffmpeg, 'FFmpeg');
    const graphFile = 'filter.txt';
    await writeFile(path.join(plan.cwd, graphFile), filterGraph(plan));
    const args = [
      '-hide_banner', '-y', '-i', plan.input,
      // FFmpeg 7+ reads a long filter graph from a file, which avoids the Windows command-line limit.
      '-/filter_complex', graphFile,
      '-map', '[vout]', ...(plan.hasAudio ? ['-map', '[aout]', '-c:a', 'aac', '-b:a', '192k'] : []),
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-movflags', '+faststart',
      plan.output,
    ];
    const r = await run(ffmpeg, args, {
      cwd: plan.cwd,
      onStderr: (chunk) => {
        const m = /time=(\d+):(\d+):([\d.]+)/.exec(chunk);
        if (m && plan.durationSec > 0) onProgress(Math.min(0.99, (Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])) / plan.durationSec));
      },
    });
    if (r.code !== 0) throw new Error(`FFmpeg could not export the reel: ${tail(r.stderr)}`);
  }
}
