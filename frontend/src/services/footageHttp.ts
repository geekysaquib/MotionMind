import type { FootageEdit, FootageSegment, FootageSettings } from '@motionmind/shared';
import { apiRequest } from './http';
import { ServiceError } from './types';

export interface ToolStatus {
  ready: boolean;
  detail: string;
}

export interface FootageTools {
  ffmpeg: ToolStatus;
  whisper: ToolStatus;
  ytDlp: ToolStatus;
}

/** An edit plus links for the clip and the export (relative to the API origin). */
export interface FootageView {
  edit: FootageEdit;
  sourceUrl: string | null;
  outputUrl: string | null;
}

export interface FootageSave {
  name?: string;
  settings: Pick<FootageSettings, 'minPause' | 'padSec' | 'captions' | 'captionPosition'>;
  segments: FootageSegment[];
  approved: boolean;
}

/** Raw footage editing: everything runs on the API's machine (FFmpeg, whisper.cpp). */
export interface FootageService {
  tools(): Promise<{ available: boolean; tools: FootageTools | null }>;
  list(): Promise<{ available: boolean; edits: FootageView[] }>;
  upload(file: Blob, fileName: string): Promise<FootageView>;
  get(id: string): Promise<FootageView>;
  save(id: string, body: FootageSave): Promise<FootageView>;
  analyze(id: string, opts?: { noiseDb?: number; retranscribe?: boolean }): Promise<FootageView>;
  exportReel(id: string): Promise<FootageView>;
  remove(id: string): Promise<void>;
}

export function httpFootageService(baseUrl: string, getToken: () => string | null, fetchImpl: typeof fetch = fetch): FootageService {
  const token = () => {
    const t = getToken();
    if (!t) throw new ServiceError('You are signed out.', 'unauthorized');
    return t;
  };
  const call = <T,>(path: string, method = 'GET', body?: unknown) => apiRequest<T>(baseUrl, path, { method, body, token: token(), fetchImpl });
  return {
    tools: () => call('/footage/tools'),
    list: () => call('/footage'),
    upload: (file, fileName) =>
      apiRequest(baseUrl, '/footage', {
        method: 'POST',
        token: token(),
        fetchImpl,
        // Any video/* type: the API streams the body to disk and checks it with FFprobe.
        raw: { data: file, contentType: file.type.startsWith('video/') ? file.type : 'video/mp4', headers: { 'X-File-Name': encodeURIComponent(fileName) } },
      }),
    get: (id) => call(`/footage/${id}`),
    save: (id, body) => call(`/footage/${id}`, 'PUT', body),
    analyze: (id, opts) => call(`/footage/${id}/analyze`, 'POST', opts ?? {}),
    exportReel: (id) => call(`/footage/${id}/export`, 'POST'),
    remove: async (id) => {
      await call(`/footage/${id}`, 'DELETE');
    },
  };
}
