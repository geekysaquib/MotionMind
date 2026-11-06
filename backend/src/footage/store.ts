import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Transform, type Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { DEFAULT_FOOTAGE_SETTINGS, type FootageEdit } from '@motionmind/shared';

const here = path.dirname(fileURLToPath(import.meta.url));
/** Default home of raw footage edits: `footage/` at the repo root (git-ignored). FOOTAGE_DIR moves it. */
export const DEFAULT_FOOTAGE_DIR = path.resolve(here, '../../../footage');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export class TooLargeError extends Error {}

/**
 * Raw clips are big, so edits live as folders on this machine, not in the database:
 * `<root>/<editId>/edit.json` plus the source clip, the words, the captions file and the exports.
 * The edit id is a random UUID, and every read checks the owner.
 */
export class FootageStore {
  constructor(readonly root: string = DEFAULT_FOOTAGE_DIR) {}

  dir(id: string) {
    if (!UUID.test(id)) throw new Error('Bad edit id.');
    return path.join(this.root, id);
  }

  /** Streams an upload to disk, stopping at `maxBytes`. */
  async create(ownerId: string, body: Readable, info: { fileName: string; ext: string; maxBytes: number }): Promise<{ edit: FootageEdit; bytes: number }> {
    const id = randomUUID();
    const dir = this.dir(id);
    await mkdir(dir, { recursive: true });
    const file = `source.${info.ext}`;
    let bytes = 0;
    const limit = new Transform({
      transform(chunk: Buffer, _enc, done) {
        bytes += chunk.length;
        if (bytes > info.maxBytes) done(new TooLargeError('too large'));
        else done(null, chunk);
      },
    });
    try {
      await pipeline(body, limit, createWriteStream(path.join(dir, file)));
    } catch (err) {
      await rm(dir, { recursive: true, force: true });
      throw err;
    }
    const now = new Date().toISOString();
    const edit: FootageEdit = {
      id,
      ownerId,
      name: info.fileName.replace(/\.[^.]+$/, '').slice(0, 80) || 'Raw clip',
      fileName: info.fileName,
      createdAt: now,
      updatedAt: now,
      source: { file, durationSec: 0, width: 0, height: 0, hasAudio: false },
      settings: { ...DEFAULT_FOOTAGE_SETTINGS },
      silences: null,
      segments: [],
      words: null,
      transcriptNote: null,
      approvedAt: null,
      job: null,
      output: null,
    };
    await this.save(edit);
    return { edit, bytes };
  }

  async get(ownerId: string, id: string): Promise<FootageEdit | null> {
    if (!UUID.test(id)) return null;
    try {
      const edit = JSON.parse(await readFile(path.join(this.dir(id), 'edit.json'), 'utf8')) as FootageEdit;
      return edit.ownerId === ownerId ? edit : null;
    } catch {
      return null;
    }
  }

  /** Any edit by id, for the public file route (which only knows the unguessable id). */
  async find(id: string): Promise<FootageEdit | null> {
    if (!UUID.test(id)) return null;
    try {
      return JSON.parse(await readFile(path.join(this.dir(id), 'edit.json'), 'utf8')) as FootageEdit;
    } catch {
      return null;
    }
  }

  async list(ownerId: string): Promise<FootageEdit[]> {
    const ids = await readdir(this.root).catch(() => [] as string[]);
    const edits = await Promise.all(ids.filter((d) => UUID.test(d)).map((d) => this.get(ownerId, d)));
    return edits.filter((e): e is FootageEdit => Boolean(e)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  /** Writes edit.json atomically, so a crash mid-write never leaves half a file. */
  async save(edit: FootageEdit): Promise<FootageEdit> {
    const dir = this.dir(edit.id);
    const tmp = path.join(dir, `edit.${randomUUID()}.tmp`);
    await writeFile(tmp, JSON.stringify(edit, null, 1));
    await rename(tmp, path.join(dir, 'edit.json'));
    return edit;
  }

  async remove(ownerId: string, id: string): Promise<boolean> {
    const edit = await this.get(ownerId, id);
    if (!edit) return false;
    await rm(this.dir(id), { recursive: true, force: true });
    return true;
  }
}
