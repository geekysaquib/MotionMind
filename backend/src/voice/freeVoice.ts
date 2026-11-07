// The free voice: Microsoft's neural text-to-speech (the voices of Edge's "Read aloud"), with word timings for
// the captions. No key needed. It is what the video kit used for the Uber reel while ElevenLabs had no key.

export interface FreeVoiceOption {
  id: string;
  name: string;
  language: string;
}

/** Voices that suit Indian explainer reels, best first. Hindi voices read Hinglish (Latin script) well too. */
export const FREE_VOICES: FreeVoiceOption[] = [
  { id: 'hi-IN-MadhurNeural', name: 'Madhur (Hindi, male)', language: 'Hindi / Hinglish' },
  { id: 'hi-IN-SwaraNeural', name: 'Swara (Hindi, female)', language: 'Hindi / Hinglish' },
  { id: 'en-IN-PrabhatNeural', name: 'Prabhat (Indian English, male)', language: 'English' },
  { id: 'en-IN-NeerjaNeural', name: 'Neerja (Indian English, female)', language: 'English' },
  { id: 'en-US-AndrewNeural', name: 'Andrew (US English, male)', language: 'English' },
  { id: 'en-US-AvaNeural', name: 'Ava (US English, female)', language: 'English' },
];
export const DEFAULT_FREE_VOICE = FREE_VOICES[0]!.id;

export interface SpokenLine {
  audio: Buffer;
  durationSec: number;
  words: { start: number; end: number }[];
}

export interface FreeVoice {
  speak(text: string, voiceId: string): Promise<SpokenLine>;
}

export class FreeVoiceError extends Error {}

/** Same bitrate as the output format asked for below: the MP3's length follows from its size. */
const KBPS = 48;

/** Edge's neural voices over their public read-aloud service (the msedge-tts package, loaded only when used). */
export class EdgeFreeVoice implements FreeVoice {
  async speak(text: string, voiceId: string): Promise<SpokenLine> {
    const name = 'msedge-tts';
    const { MsEdgeTTS, OUTPUT_FORMAT } = (await import(name)) as typeof import('msedge-tts');
    const tts = new MsEdgeTTS();
    try {
      await tts.setMetadata(voiceId, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3, { wordBoundaryEnabled: true });
      const { audioStream, metadataStream } = tts.toStream(text, { rate: '+8%' });
      const chunks: Buffer[] = [];
      const meta: string[] = [];
      audioStream.on('data', (c: Buffer) => chunks.push(c));
      metadataStream?.on('data', (c: Buffer) => meta.push(c.toString()));
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new FreeVoiceError('The free voice took too long to answer. Try again.')), 60_000);
        audioStream.on('close', () => { clearTimeout(timer); resolve(); });
        audioStream.on('error', (e: Error) => { clearTimeout(timer); reject(e); });
      });
      const audio = Buffer.concat(chunks);
      if (audio.length < 1000) throw new FreeVoiceError('The free voice sent back no audio. Try again in a minute.');
      return { audio, durationSec: (audio.length * 8) / (KBPS * 1000), words: parseWordBoundaries(meta.join('')) };
    } finally {
      tts.close();
    }
  }
}

/** Word timings from the service's metadata messages: one JSON object per word, offsets in 100 ns ticks. */
export function parseWordBoundaries(raw: string): { start: number; end: number }[] {
  const out: { start: number; end: number }[] = [];
  const re = /"Offset":\s*(\d+),\s*"Duration":\s*(\d+)/g;
  for (let m = re.exec(raw); m; m = re.exec(raw)) {
    const start = Number(m[1]) / 1e7;
    out.push({ start, end: start + Number(m[2]) / 1e7 });
  }
  return out;
}
