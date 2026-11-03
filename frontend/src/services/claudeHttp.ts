import type { Project } from '@motionmind/shared';
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

export interface ClaudeService {
  status(): Promise<ClaudeStatus>;
  ask(prompt: string): Promise<ClaudeAnswer>;
  /** Claude writes the project's reel script; returns the updated project. */
  writeScript(projectId: string): Promise<Project>;
}

/** Claude always runs on the API, on the server's Anthropic key. */
export function httpClaudeService(baseUrl: string, getToken: () => string | null, fetchImpl: typeof fetch = fetch): ClaudeService {
  async function call<T>(path: string, method = 'GET', body?: unknown) {
    const token = getToken();
    if (!token) throw new ServiceError('You are signed out.', 'unauthorized');
    return apiRequest<T>(baseUrl, path, { method, body, token, fetchImpl });
  }
  return {
    status: () => call<ClaudeStatus>('/claude/status'),
    ask: (prompt) => call<ClaudeAnswer>('/claude/ask', 'POST', { prompt }),
    writeScript: async (projectId) => (await call<{ project: Project }>(`/projects/${projectId}/script`, 'POST')).project,
  };
}
