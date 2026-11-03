import type { Profile, Project } from '@motionmind/shared';
import { config } from '../config';
import { httpKeysService } from './keysHttp';
import { ServiceError, type AuthService, type ProfileService, type ProjectService, type Services, type Session } from './types';
import type { Storage } from './memory';

const SESSION_KEY = 'motionmind-session';

/** Talks only to the Motion Mind API. The browser never connects to the database. */
export function apiServices(storage: Storage = window.localStorage, baseUrl = config.apiUrl, fetchImpl: typeof fetch = fetch): Services {
  const listeners = new Set<(s: Session | null, e: string) => void>();

  const readSession = (): Session | null => {
    try {
      const raw = storage.getItem(SESSION_KEY);
      return raw ? (JSON.parse(raw) as Session) : null;
    } catch {
      return null;
    }
  };
  const writeSession = (s: Session | null, event: string) => {
    try {
      storage.setItem(SESSION_KEY, s ? JSON.stringify(s) : '');
    } catch {
      /* storage blocked: the session lasts for this tab only */
    }
    listeners.forEach((l) => l(s, event));
  };
  let session = readSession();

  async function call<T>(path: string, init: RequestInit = {}, authed = true): Promise<T> {
    const headers: Record<string, string> = {};
    if (init.body) headers['Content-Type'] = 'application/json';
    if (authed) {
      if (!session) throw new ServiceError('You are signed out.', 'unauthorized');
      headers.Authorization = `Bearer ${session.accessToken}`;
    }
    let res: Response;
    try {
      res = await fetchImpl(`${baseUrl}/api${path}`, { ...init, headers });
    } catch {
      throw new ServiceError(`Can't reach the Motion Mind API at ${baseUrl || 'this site'}. Is it running?`, 'network');
    }
    const body = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
    if (res.status === 401 && authed) {
      session = null;
      writeSession(null, 'SIGNED_OUT');
    }
    if (!res.ok) throw new ServiceError(body.message ?? `Request failed (${res.status}).`, body.error ?? 'http');
    return body as T;
  }
  const json = (method: string, data: unknown): RequestInit => ({ method, body: JSON.stringify(data) });

  const auth: AuthService = {
    async getSession() {
      return session;
    },
    onChange(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    async requestCode(email) {
      await call('/auth/request-code', json('POST', { email }), false);
    },
    async verifyCode(email, code) {
      const res = await call<{ token: string; user: { id: string; email: string } }>('/auth/verify-code', json('POST', { email, code }), false);
      session = { userId: res.user.id, email: res.user.email, accessToken: res.token };
      writeSession(session, 'SIGNED_IN');
    },
    async signOut() {
      session = null;
      writeSession(null, 'SIGNED_OUT');
    },
  };

  const profiles: ProfileService = {
    get: async () => (await call<{ profile: Profile }>('/profile')).profile,
    update: async (_userId, patch) => (await call<{ profile: Profile }>('/profile', json('PATCH', patch))).profile,
    isHandleAvailable: async (handle) => (await call<{ available: boolean }>(`/handles/${encodeURIComponent(handle)}/available`)).available,
  };

  const projects: ProjectService = {
    list: async () => (await call<{ projects: Project[] }>('/projects')).projects,
    async get(id) {
      try {
        return (await call<{ project: Project }>(`/projects/${id}`)).project;
      } catch (e) {
        if (e instanceof ServiceError && e.code === 'not_found') return null;
        throw e;
      }
    },
    create: async (input) => (await call<{ project: Project }>('/projects', json('POST', input))).project,
    update: async (id, patch) => (await call<{ project: Project }>(`/projects/${id}`, json('PATCH', patch))).project,
    async remove(id) {
      await call(`/projects/${id}`, { method: 'DELETE' });
    },
  };

  return { mode: 'api', auth, profiles, projects, keys: (getToken) => httpKeysService(baseUrl, getToken) };
}
