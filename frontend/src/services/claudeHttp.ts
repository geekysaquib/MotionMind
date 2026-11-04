import type { AudioTrack, Project, ReelEditor, ReelScript, ReelVoice } from '@motionmind/shared';
import { apiRequest } from './http';
import { ServiceError } from './types';

export interface ClaudeStatus {
  connected: boolean;
  model: string;
}

export interface ClaudeAnswer {
  reply: { text: string; model: string; inputTokens: number; outputTokens: number };
  ms: number;
}

export interface Connector {
  id: 'claude' | 'elevenlabs';
  name: string;
  purpose: string;
  connected: boolean;
  detail: string | null;
}

export interface ElevenLabsCheck {
  ok: boolean;
  detail: string;
  voices?: { id: string; name: string }[];
}

/** Playable URLs for the editor's uploaded voice and music. */
export interface EditorUrls {
  voice?: string;
  music?: string;
  /** Playable URL of each sound effect, by its storage path. */
  sfx?: Record<string, string>;
}

export interface RenderJob {
  id: string;
  status: 'bundling' | 'rendering' | 'done' | 'failed';
  progress: number;
  file?: string;
  error?: string;
  startedAt: string;
  finishedAt?: string;
}

export interface ClaudeService {
  /** The app's connectors (Claude, ElevenLabs), all on server keys. */
  connectors(): Promise<Connector[]>;
  testElevenLabs(): Promise<ElevenLabsCheck>;
  status(): Promise<ClaudeStatus>;
  ask(prompt: string): Promise<ClaudeAnswer>;
  /** Claude writes the project's reel script; returns the updated project. */
  writeScript(projectId: string): Promise<Project>;
  /** For claude.ai: the prompt to copy, then the answer to paste back. */
  scriptPrompt(projectId: string): Promise<string>;
  importScript(projectId: string, text: string): Promise<Project>;
  /** Research: Claude searches the web (API), or the same through claude.ai, then the user approves it. */
  research(projectId: string): Promise<Project>;
  researchPrompt(projectId: string): Promise<string>;
  importResearch(projectId: string, text: string): Promise<Project>;
  approveResearch(projectId: string): Promise<Project>;
  /** Voice (ElevenLabs on the server key). */
  voices(): Promise<{ voices: { id: string; name: string }[]; defaultVoiceId: string | null }>;
  voiceFor(projectId: string): Promise<{ voice: ReelVoice | null; urls: string[]; stale: boolean }>;
  generateVoice(projectId: string, voiceId?: string, voiceName?: string): Promise<{ project: Project; urls: string[] }>;
  /** Reel editor: upload voice/music, then save the editor state. */
  uploadAudio(projectId: string, kind: 'voice' | 'music' | 'sfx', file: Blob, fileName: string): Promise<{ track: Pick<AudioTrack, 'path' | 'fileName' | 'mime'>; url: string }>;
  editorFor(projectId: string): Promise<{ editor: ReelEditor | null; urls: EditorUrls }>;
  saveEditor(projectId: string, editor: ReelEditor): Promise<{ project: Project; urls: EditorUrls }>;
  /** Export: render the MP4 (only on a local server). */
  startExport(projectId: string): Promise<{ job: RenderJob; withVoice: boolean }>;
  exportStatus(projectId: string): Promise<{ available: boolean; job: RenderJob | null }>;
  /** Storyboard: save the user's edits to the script. */
  saveScript(projectId: string, script: ReelScript): Promise<Project>;
}

/** Claude always runs on the API, on the server's Anthropic key. */
export function httpClaudeService(baseUrl: string, getToken: () => string | null, fetchImpl: typeof fetch = fetch): ClaudeService {
  async function call<T>(path: string, method = 'GET', body?: unknown) {
    const token = getToken();
    if (!token) throw new ServiceError('You are signed out.', 'unauthorized');
    return apiRequest<T>(baseUrl, path, { method, body, token, fetchImpl });
  }
  return {
    connectors: async () => (await call<{ connectors: Connector[] }>('/connectors')).connectors,
    testElevenLabs: async () => (await call<{ result: ElevenLabsCheck }>('/connectors/elevenlabs/test', 'POST')).result,
    status: () => call<ClaudeStatus>('/claude/status'),
    ask: (prompt) => call<ClaudeAnswer>('/claude/ask', 'POST', { prompt }),
    writeScript: async (projectId) => (await call<{ project: Project }>(`/projects/${projectId}/script`, 'POST')).project,
    scriptPrompt: async (projectId) => (await call<{ prompt: string }>(`/projects/${projectId}/script/prompt`)).prompt,
    importScript: async (projectId, text) => (await call<{ project: Project }>(`/projects/${projectId}/script/import`, 'POST', { text })).project,
    research: async (projectId) => (await call<{ project: Project }>(`/projects/${projectId}/research`, 'POST')).project,
    researchPrompt: async (projectId) => (await call<{ prompt: string }>(`/projects/${projectId}/research/prompt`)).prompt,
    importResearch: async (projectId, text) => (await call<{ project: Project }>(`/projects/${projectId}/research/import`, 'POST', { text })).project,
    voices: () => call('/voices'),
    voiceFor: (projectId) => call(`/projects/${projectId}/voice`),
    generateVoice: (projectId, voiceId, voiceName) => call(`/projects/${projectId}/voice`, 'POST', { voiceId, voiceName }),
    uploadAudio: (projectId, kind, file, fileName) => {
      const token = getToken();
      if (!token) throw new ServiceError('You are signed out.', 'unauthorized');
      return apiRequest(baseUrl, `/projects/${projectId}/audio/${kind}`, {
        method: 'POST',
        token,
        fetchImpl,
        raw: { data: file, contentType: 'application/octet-stream', headers: { 'X-File-Name': encodeURIComponent(fileName) } },
      });
    },
    editorFor: (projectId) => call(`/projects/${projectId}/editor`),
    saveEditor: (projectId, editor) => call(`/projects/${projectId}/editor`, 'PUT', { editor }),
    startExport: (projectId) => call(`/projects/${projectId}/export`, 'POST'),
    exportStatus: (projectId) => call(`/projects/${projectId}/export`),
    saveScript: async (projectId, script) => (await call<{ project: Project }>(`/projects/${projectId}/script`, 'PUT', { script })).project,
    approveResearch: async (projectId) => (await call<{ project: Project }>(`/projects/${projectId}/research/approve`, 'POST')).project,
  };
}
