/** ElevenLabs (voiceover), on the server's ELEVENLABS_API_KEY. Users never set up keys. */
const API = 'https://api.elevenlabs.io/v1';
export const ELEVENLABS_MODEL = 'eleven_multilingual_v2';

export interface ElevenLabsVoice {
  id: string;
  name: string;
}

export interface ElevenLabsCheck {
  ok: boolean;
  detail: string;
  voices?: ElevenLabsVoice[];
}

export class ElevenLabsError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function call(apiKey: string, path: string, fetchImpl: typeof fetch, init: RequestInit = {}) {
  let res: Response;
  try {
    res = await fetchImpl(`${API}${path}`, {
      ...init,
      headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', ...(init.headers as Record<string, string> | undefined) },
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new ElevenLabsError("Couldn't reach ElevenLabs. Check the server's internet connection.", 502);
  }
  if (res.status === 401 || res.status === 403) throw new ElevenLabsError("ElevenLabs rejected the server's key. Check ELEVENLABS_API_KEY.", 502);
  if (res.status === 429) throw new ElevenLabsError('ElevenLabs is busy or out of credits for now. Try again later.', 429);
  if (!res.ok) throw new ElevenLabsError(`ElevenLabs answered with HTTP ${res.status}. Try again in a minute.`, 502);
  return res.json();
}

export async function listVoices(apiKey: string, fetchImpl: typeof fetch = fetch): Promise<ElevenLabsVoice[]> {
  const body = (await call(apiKey, '/voices', fetchImpl)) as { voices?: { voice_id: string; name: string }[] };
  return (body.voices ?? []).map((v) => ({ id: v.voice_id, name: v.name }));
}

/** Checks the key by listing the account's voices (a free call). Never throws. */
export async function checkElevenLabs(apiKey: string, fetchImpl: typeof fetch = fetch): Promise<ElevenLabsCheck> {
  try {
    const voices = await listVoices(apiKey, fetchImpl);
    return { ok: true, detail: `Connected. ${voices.length} voice${voices.length === 1 ? '' : 's'} available.`, voices: voices.slice(0, 12) };
  } catch (err) {
    return { ok: false, detail: err instanceof ElevenLabsError ? err.message : "Couldn't reach ElevenLabs." };
  }
}

export interface Alignment {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}

/** Word start/end times from ElevenLabs' per-character alignment. */
export function wordTimings(a: Alignment): { start: number; end: number }[] {
  const words: { start: number; end: number }[] = [];
  let cur: { start: number; end: number } | null = null;
  a.characters.forEach((ch, k) => {
    if (/\s/.test(ch)) {
      if (cur) words.push(cur);
      cur = null;
      return;
    }
    if (!cur) cur = { start: a.character_start_times_seconds[k] ?? 0, end: a.character_end_times_seconds[k] ?? 0 };
    else cur.end = a.character_end_times_seconds[k] ?? cur.end;
  });
  if (cur) words.push(cur);
  return words;
}

/** Speaks one line. Returns the MP3 and word timings; the duration is the last word's end plus a short tail. */
export async function speak(apiKey: string, voiceId: string, text: string, fetchImpl: typeof fetch = fetch) {
  const out = (await call(apiKey, `/text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps?output_format=mp3_44100_128`, fetchImpl, {
    method: 'POST',
    body: JSON.stringify({ text, model_id: ELEVENLABS_MODEL, voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.3, speed: 1.05 } }),
  })) as { audio_base64: string; alignment: Alignment };
  const words = wordTimings(out.alignment);
  const last = out.alignment.character_end_times_seconds.at(-1) ?? 0;
  return { audio: Buffer.from(out.audio_base64, 'base64'), words, durationSec: Math.round((last + 0.15) * 100) / 100 };
}
