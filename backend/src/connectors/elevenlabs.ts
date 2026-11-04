/** ElevenLabs (voiceover), on the server's ELEVENLABS_API_KEY. Users never set up keys. */
const API = 'https://api.elevenlabs.io/v1';

export interface ElevenLabsCheck {
  ok: boolean;
  detail: string;
  voices?: { id: string; name: string }[];
}

/** Checks the key by listing the account's voices (a free call). Never throws. */
export async function checkElevenLabs(apiKey: string, fetchImpl: typeof fetch = fetch): Promise<ElevenLabsCheck> {
  try {
    const res = await fetchImpl(`${API}/voices`, { headers: { 'xi-api-key': apiKey }, signal: AbortSignal.timeout(10_000) });
    if (res.status === 401 || res.status === 403) return { ok: false, detail: "ElevenLabs rejected the server's key. Check ELEVENLABS_API_KEY." };
    if (!res.ok) return { ok: false, detail: `ElevenLabs answered with HTTP ${res.status}. Try again in a minute.` };
    const body = (await res.json()) as { voices?: { voice_id: string; name: string }[] };
    const voices = (body.voices ?? []).map((v) => ({ id: v.voice_id, name: v.name }));
    return { ok: true, detail: `Connected. ${voices.length} voice${voices.length === 1 ? '' : 's'} available.`, voices: voices.slice(0, 12) };
  } catch {
    return { ok: false, detail: "Couldn't reach ElevenLabs. Check the server's internet connection." };
  }
}
