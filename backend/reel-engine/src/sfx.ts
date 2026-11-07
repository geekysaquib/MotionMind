// Sound design made in code: short WAV clips (a whoosh, a pop, a tick, a thud) generated once and played as
// data URLs, so the reel has sound effects without any sound files or licences.

const RATE = 22050;

function wav(samples: Float32Array): string {
  const n = samples.length;
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  v.setUint32(4, 36 + n * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, RATE, true);
  v.setUint32(28, RATE * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, samples[i]!)) * 32767, true);
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:audio/wav;base64,${btoa(bin)}`;
}

/** Deterministic noise, so every render sounds the same. */
function noise(seed: number) {
  let x = seed;
  return () => {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    return (x / 0x7fffffff) * 2 - 1;
  };
}

function make(sec: number, fn: (t: number, i: number) => number) {
  const out = new Float32Array(Math.round(sec * RATE));
  for (let i = 0; i < out.length; i++) out[i] = fn(i / RATE, i);
  return out;
}

export type SfxKind = 'whoosh' | 'pop' | 'tick' | 'thud';

let cache: Record<SfxKind, string> | null = null;

/** The four clips, as data URLs (made the first time they are asked for). */
export function sfxUrls(): Record<SfxKind, string> {
  if (cache) return cache;
  const n1 = noise(7);
  let lp = 0;
  // Whoosh: noise through a filter that opens and closes, swelling and fading over 0.45 s.
  const whoosh = make(0.45, (t) => {
    const env = Math.sin(Math.PI * Math.min(1, t / 0.45)) ** 2;
    const cutoff = 0.04 + 0.25 * Math.sin(Math.PI * Math.min(1, t / 0.45));
    lp += cutoff * (n1() - lp);
    return lp * env * 0.9;
  });
  // Pop: a short sine whose pitch drops fast, like a bubble.
  let ph = 0;
  const pop = make(0.09, (t) => {
    const f = 900 - 5200 * t;
    ph += (2 * Math.PI * Math.max(180, f)) / RATE;
    return Math.sin(ph) * Math.exp(-t * 45) * 0.7;
  });
  // Tick: a few milliseconds of bright click.
  const n2 = noise(3);
  const tick = make(0.025, (t) => (n2() * 0.5 + Math.sin(2 * Math.PI * 3200 * t) * 0.5) * Math.exp(-t * 260) * 0.6);
  // Thud: a low drop with a little body, for a stamp landing.
  let ph2 = 0;
  const n3 = noise(11);
  const thud = make(0.32, (t) => {
    ph2 += (2 * Math.PI * (110 - 120 * t)) / RATE;
    return (Math.sin(ph2) * 0.9 + n3() * 0.25 * Math.exp(-t * 60)) * Math.exp(-t * 11);
  });
  cache = { whoosh: wav(whoosh), pop: wav(pop), tick: wav(tick), thud: wav(thud) };
  return cache;
}

/** How loud each clip plays under the voice. */
export const SFX_VOLUME: Record<SfxKind, number> = { whoosh: 0.32, pop: 0.28, tick: 0.18, thud: 0.4 };
