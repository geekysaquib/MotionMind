import type { SupabaseClient } from '@supabase/supabase-js';

/** Where voiceover MP3s live. Paths are `<userId>/<projectId>/beat_<i>.mp3`. */
export interface AudioStore {
  put(path: string, audio: Buffer, contentType?: string): Promise<void>;
  /** Deletes files, ignoring any that are already gone. */
  remove(paths: string[]): Promise<void>;
  /** Short-lived URLs the browser can play without signing in (the player can't send headers). */
  urls(paths: string[]): Promise<string[]>;
}


/** Tests and demo mode: audio kept in RAM, served as data URLs. */
export class MemoryAudioStore implements AudioStore {
  readonly files = new Map<string, Buffer>();
  readonly types = new Map<string, string>();
  async put(path: string, audio: Buffer, contentType = 'audio/mpeg') {
    this.files.set(path, audio);
    this.types.set(path, contentType);
  }
  async remove(paths: string[]) {
    for (const p of paths) {
      this.files.delete(p);
      this.types.delete(p);
    }
  }
  async urls(paths: string[]) {
    return paths.map((p) => {
      const f = this.files.get(p);
      return f ? `data:${this.types.get(p) ?? 'audio/mpeg'};base64,${f.toString('base64')}` : '';
    });
  }
}

/** Supabase Storage, private bucket "voice" (created by migration). Only the service role can read or write it. */
export class SupabaseAudioStore implements AudioStore {
  constructor(private readonly db: SupabaseClient, private readonly bucket = 'voice') {}

  async put(path: string, audio: Buffer, contentType = 'audio/mpeg') {
    const { error } = await this.db.storage.from(this.bucket).upload(path, audio, { contentType, upsert: true });
    if (error) throw error;
  }

  async remove(paths: string[]) {
    if (!paths.length) return;
    const { error } = await this.db.storage.from(this.bucket).remove(paths);
    if (error) throw error;
  }

  async urls(paths: string[]) {
    if (!paths.length) return [];
    const { data, error } = await this.db.storage.from(this.bucket).createSignedUrls(paths, 60 * 60 * 6);
    if (error) throw error;
    return (data ?? []).map((d) => d.signedUrl ?? '');
  }
}
