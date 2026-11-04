import type { SupabaseClient } from '@supabase/supabase-js';

/** Where voiceover MP3s live. Paths are `<userId>/<projectId>/beat_<i>.mp3`. */
export interface AudioStore {
  put(path: string, mp3: Buffer): Promise<void>;
  /** Short-lived URLs the browser can play without signing in (the player can't send headers). */
  urls(paths: string[]): Promise<string[]>;
}

export const voicePath = (userId: string, projectId: string, i: number) => `${userId}/${projectId}/beat_${i}.mp3`;

/** Tests and demo mode: audio kept in RAM, served as data URLs. */
export class MemoryAudioStore implements AudioStore {
  readonly files = new Map<string, Buffer>();
  async put(path: string, mp3: Buffer) {
    this.files.set(path, mp3);
  }
  async urls(paths: string[]) {
    return paths.map((p) => {
      const f = this.files.get(p);
      return f ? `data:audio/mpeg;base64,${f.toString('base64')}` : '';
    });
  }
}

/** Supabase Storage, private bucket "voice" (created by migration). Only the service role can read or write it. */
export class SupabaseAudioStore implements AudioStore {
  constructor(private readonly db: SupabaseClient, private readonly bucket = 'voice') {}

  async put(path: string, mp3: Buffer) {
    const { error } = await this.db.storage.from(this.bucket).upload(path, mp3, { contentType: 'audio/mpeg', upsert: true });
    if (error) throw error;
  }

  async urls(paths: string[]) {
    if (!paths.length) return [];
    const { data, error } = await this.db.storage.from(this.bucket).createSignedUrls(paths, 60 * 60 * 6);
    if (error) throw error;
    return (data ?? []).map((d) => d.signedUrl ?? '');
  }
}
