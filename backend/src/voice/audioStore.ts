import type { SupabaseClient } from '@supabase/supabase-js';

/** Where voiceover MP3s live. Paths are `<userId>/<projectId>/beat_<i>.mp3`. */
export interface AudioStore {
  put(path: string, audio: Buffer, contentType?: string): Promise<void>;
  /** Deletes files, ignoring any that are already gone. */
  remove(paths: string[]): Promise<void>;
  /** Deletes every file in a folder (all of a project's files), ignoring a folder that is already gone. */
  removeFolder(folder: string): Promise<void>;
  /** One file's bytes and type, or null when it is not there. */
  get(path: string): Promise<{ data: Buffer; contentType: string } | null>;
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
  async removeFolder(folder: string) {
    const prefix = folder.endsWith('/') ? folder : `${folder}/`;
    for (const p of [...this.files.keys()]) {
      if (p.startsWith(prefix)) {
        this.files.delete(p);
        this.types.delete(p);
      }
    }
  }
  async get(path: string) {
    const data = this.files.get(path);
    return data ? { data, contentType: this.types.get(path) ?? 'application/octet-stream' } : null;
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

  async removeFolder(folder: string) {
    const dir = folder.replace(/\/+$/, '');
    // Files sit one level down (<user>/<project>/<file>); page through in case there are many.
    for (;;) {
      const { data, error } = await this.db.storage.from(this.bucket).list(dir, { limit: 100 });
      if (error) throw error;
      const files = (data ?? []).filter((f) => f.id).map((f) => `${dir}/${f.name}`);
      if (!files.length) return;
      await this.remove(files);
    }
  }

  async get(path: string) {
    const { data, error } = await this.db.storage.from(this.bucket).download(path);
    if (error || !data) return null;
    return { data: Buffer.from(await data.arrayBuffer()), contentType: data.type || 'application/octet-stream' };
  }

  async urls(paths: string[]) {
    if (!paths.length) return [];
    const { data, error } = await this.db.storage.from(this.bucket).createSignedUrls(paths, 60 * 60 * 6);
    if (error) throw error;
    return (data ?? []).map((d) => d.signedUrl ?? '');
  }
}
