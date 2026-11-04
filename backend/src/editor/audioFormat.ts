/** Audio types the editor accepts, recognised from the file's first bytes (not from what the browser claims). */
export interface AudioFormat {
  ext: string;
  mime: string;
}

export function sniffAudio(b: Buffer): AudioFormat | null {
  if (b.length < 12) return null;
  const ascii = (from: number, to: number) => b.subarray(from, to).toString('latin1');
  if (ascii(0, 3) === 'ID3') return { ext: 'mp3', mime: 'audio/mpeg' };
  if (b[0] === 0xff && (b[1]! & 0xe0) === 0xe0) {
    // Layer bits 00 mean an AAC (ADTS) frame; anything else is an MP3 frame.
    return ((b[1]! >> 1) & 3) === 0 ? { ext: 'aac', mime: 'audio/aac' } : { ext: 'mp3', mime: 'audio/mpeg' };
  }
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WAVE') return { ext: 'wav', mime: 'audio/wav' };
  if (ascii(4, 8) === 'ftyp') return { ext: 'm4a', mime: 'audio/mp4' };
  if (ascii(0, 4) === 'OggS') return { ext: 'ogg', mime: 'audio/ogg' };
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return { ext: 'webm', mime: 'audio/webm' };
  if (ascii(0, 4) === 'fLaC') return { ext: 'flac', mime: 'audio/flac' };
  return null;
}

/** A file name safe to show and store: no folders, no control characters, and not too long. */
export function cleanFileName(raw: unknown, fallback = 'audio'): string {
  let name = typeof raw === 'string' ? raw : fallback;
  try {
    name = decodeURIComponent(name);
  } catch {
    /* keep it as sent */
  }
  name = name.replace(/[\\/]+/g, '_').replace(/[\u0000-\u001f]/g, '').trim();
  return (name || fallback).slice(0, 120);
}
