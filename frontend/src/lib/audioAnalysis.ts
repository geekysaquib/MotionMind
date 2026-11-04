import { PEAKS_PER_SEC } from '@motionmind/shared';

export interface AudioAnalysis {
  durationSec: number;
  /** Loudness per 1/20 s, 0 to 99. */
  peaks: number[];
}

/** Turns decoded samples into the loudness bars the timeline draws (and autoCuts reads). */
export function peaksFromSamples(samples: Float32Array, sampleRate: number): number[] {
  const bin = Math.max(1, Math.floor(sampleRate / PEAKS_PER_SEC));
  const bins = Math.ceil(samples.length / bin);
  const raw: number[] = [];
  for (let i = 0; i < bins; i++) {
    let sum = 0;
    const end = Math.min(samples.length, (i + 1) * bin);
    for (let j = i * bin; j < end; j++) sum += samples[j]! * samples[j]!;
    raw.push(Math.sqrt(sum / Math.max(1, end - i * bin)));
  }
  const max = Math.max(...raw, 1e-6);
  return raw.map((v) => Math.min(99, Math.round((v / max) * 99)));
}

/** Decodes an audio file in the browser to find its length and loudness. Throws if the browser can't read it. */
async function decodeInBrowser(file: Blob): Promise<AudioAnalysis> {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) throw new Error("This browser can't read audio files.");
  const ctx = new Ctx();
  try {
    const buffer = await ctx.decodeAudioData(await file.arrayBuffer());
    return { durationSec: buffer.duration, peaks: peaksFromSamples(buffer.getChannelData(0), buffer.sampleRate) };
  } finally {
    void ctx.close().catch(() => undefined);
  }
}

let analyzer: (file: Blob) => Promise<AudioAnalysis> = decodeInBrowser;
/** Reads a file's length and loudness. Tests swap the analyzer, since jsdom can't decode audio. */
export const analyzeAudio = (file: Blob) => analyzer(file);
export function setAudioAnalyzer(fn: ((file: Blob) => Promise<AudioAnalysis>) | null) {
  analyzer = fn ?? decodeInBrowser;
}
