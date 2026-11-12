import type { AudioTrack, CoverSettings, Platform, Project, ReelAnimation, ReelEditor, ReelScript, ReelTimeline, StyleId } from '@motionmind/shared';
import { apiRequest } from './http';
import { ServiceError } from './types';

/** Playable URLs for the uploaded voice and music. */
export interface EditorUrls {
  voice?: string;
  music?: string;
}

export interface LayoutCheck {
  report: { ok: boolean; total: number; issues: { code: string; time: number; text: string | null; message: string; seconds: number }[] };
  /** What to paste into the same claude.ai chat so Claude fixes the problems; null when there are none. */
  request: string | null;
}

export interface RenderJob {
  id: string;
  status: 'bundling' | 'rendering' | 'finishing' | 'done' | 'failed';
  progress: number;
  file?: string;
  error?: string;
  startedAt: string;
  finishedAt?: string;
}

/** A page that many people read yesterday (Wikipedia). */
export interface TrendingTopic {
  title: string;
  views: number;
  url: string;
}
export interface Trending {
  date: string;
  lang: 'en' | 'hi';
  items: TrendingTopic[];
}
/** A reel idea made from the trending pages. */
export interface TrendIdea {
  topic: string;
  hook: string;
  seconds: 15 | 30 | 45 | 60 | 90;
  why: string;
}

/** What the app asks of the API for a reel. Everything that needs Claude is a prompt to copy into claude.ai and an answer to paste back. */
export interface ClaudeService {
  /** Discover: what people are reading right now, and reel ideas made from it (prompt, then the pasted answer). */
  trending(lang: 'en' | 'hi'): Promise<Trending>;
  trendingPrompt(lang: 'en' | 'hi', note?: string): Promise<string>;
  importTrendingIdeas(text: string): Promise<TrendIdea[]>;
  /** Script: the prompt to copy, then the answer to paste back. */
  scriptPrompt(projectId: string, style?: StyleId | null, note?: string): Promise<string>;
  importScript(projectId: string, text: string, style?: StyleId | null): Promise<Project>;
  /** Research: the prompt to copy, the answer to paste back, then the user approves it. */
  researchPrompt(projectId: string, note?: string): Promise<string>;
  importResearch(projectId: string, text: string): Promise<Project>;
  approveResearch(projectId: string): Promise<Project>;
  /** Animate: Claude writes the reel as a HyperFrames composition in claude.ai; the user pastes it back. */
  animationFor(projectId: string): Promise<{ animation: ReelAnimation | null; timeline: ReelTimeline | null; stale: boolean }>;
  animationPrompt(projectId: string, note?: string): Promise<string>;
  importAnimation(projectId: string, text: string): Promise<Project>;
  /** Layout check: opens the animation in Chrome on this PC and looks for overlapping, hidden or cut-off text. */
  checkLayout(projectId: string): Promise<LayoutCheck>;
  /** Style: the rulebook Claude animates with. */
  saveStyle(projectId: string, style: StyleId): Promise<Project>;
  /** Voice: upload the recording and the music, save how they are cut, and fit the script's words to the voice. */
  uploadAudio(projectId: string, kind: 'voice' | 'music', file: Blob, fileName: string): Promise<{ track: Pick<AudioTrack, 'path' | 'fileName' | 'mime'>; url: string }>;
  editorFor(projectId: string): Promise<{ editor: ReelEditor | null; urls: EditorUrls }>;
  saveEditor(projectId: string, editor: ReelEditor): Promise<{ project: Project; urls: EditorUrls }>;
  fitVoice(projectId: string): Promise<{ project: Project; urls: EditorUrls; fit: 'speech' | 'loudness'; note: string | null }>;
  /** Captions and hashtags for the post: the prompt to copy, then the answer to paste back. */
  postPrompt(projectId: string, note?: string): Promise<string>;
  importPost(projectId: string, text: string): Promise<Project>;
  /** Cover (thumbnail): save the scene, and take the frame on this machine. */
  saveCover(projectId: string, cover: CoverSettings): Promise<Project>;
  renderCover(projectId: string, cover: CoverSettings): Promise<{ file: string; url: string }>;
  /** Export: render the MP4 (only on a local server). */
  startExport(projectId: string, platform?: Platform): Promise<{ job: RenderJob; withVoice: boolean }>;
  /** `jobs` has the latest export of each platform; `job` is the first platform's. */
  exportStatus(projectId: string): Promise<{ available: boolean; job: RenderJob | null; jobs?: Partial<Record<Platform, RenderJob | null>> }>;
  /** Storyboard: save the user's edits to the script. */
  saveScript(projectId: string, script: ReelScript): Promise<Project>;
}

/** `?a=1&b=2` from the values that are set. */
function query(params: Record<string, string | null | undefined>): string {
  const q = Object.entries(params).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v!)}`);
  return q.length ? `?${q.join('&')}` : '';
}

export function httpClaudeService(baseUrl: string, getToken: () => string | null, fetchImpl: typeof fetch = fetch): ClaudeService {
  async function call<T>(path: string, method = 'GET', body?: unknown) {
    const token = getToken();
    if (!token) throw new ServiceError('You are signed out.', 'unauthorized');
    return apiRequest<T>(baseUrl, path, { method, body, token, fetchImpl });
  }
  return {
    scriptPrompt: async (projectId, style, note) => (await call<{ prompt: string }>(`/projects/${projectId}/script/prompt${query({ style, note })}`)).prompt,
    importScript: async (projectId, text, style) => (await call<{ project: Project }>(`/projects/${projectId}/script/import`, 'POST', style ? { text, style } : { text })).project,
    researchPrompt: async (projectId, note) => (await call<{ prompt: string }>(`/projects/${projectId}/research/prompt${query({ note })}`)).prompt,
    importResearch: async (projectId, text) => (await call<{ project: Project }>(`/projects/${projectId}/research/import`, 'POST', { text })).project,
    approveResearch: async (projectId) => (await call<{ project: Project }>(`/projects/${projectId}/research/approve`, 'POST')).project,
    animationFor: (projectId) => call(`/projects/${projectId}/animation`),
    animationPrompt: async (projectId, note) => (await call<{ prompt: string }>(`/projects/${projectId}/animation/prompt${query({ note })}`)).prompt,
    importAnimation: async (projectId, text) => (await call<{ project: Project }>(`/projects/${projectId}/animation/import`, 'POST', { text })).project,
    checkLayout: (projectId) => call(`/projects/${projectId}/animation/check`, 'POST'),
    saveStyle: async (projectId, style) => (await call<{ project: Project }>(`/projects/${projectId}/style`, 'PUT', { style })).project,
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
    fitVoice: (projectId) => call(`/projects/${projectId}/voice/fit`, 'POST'),
    postPrompt: async (projectId, note) => (await call<{ prompt: string }>(`/projects/${projectId}/post/prompt${query({ note })}`)).prompt,
    importPost: async (projectId, text) => (await call<{ project: Project }>(`/projects/${projectId}/post/import`, 'POST', { text })).project,
    saveCover: async (projectId, cover) => (await call<{ project: Project }>(`/projects/${projectId}/cover`, 'PUT', { cover })).project,
    renderCover: (projectId, cover) => call(`/projects/${projectId}/cover/render`, 'POST', { cover }),
    startExport: (projectId, platform) => call(`/projects/${projectId}/export`, 'POST', platform ? { platform } : undefined),
    exportStatus: (projectId) => call(`/projects/${projectId}/export`),
    saveScript: async (projectId, script) => (await call<{ project: Project }>(`/projects/${projectId}/script`, 'PUT', { script })).project,
    trending: (lang) => call(`/discover/trending?lang=${lang}`),
    trendingPrompt: async (lang, note) => (await call<{ prompt: string }>(`/discover/prompt${query({ lang, note })}`)).prompt,
    importTrendingIdeas: async (text) => (await call<{ ideas: TrendIdea[] }>(`/discover/import`, 'POST', { text })).ideas,
  };
}
