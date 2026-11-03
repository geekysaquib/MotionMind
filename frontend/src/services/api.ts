import type { Profile, Project } from '@motionmind/shared';
import { config } from '../config';
import { apiRequest } from './http';
import { httpClaudeService } from './claudeHttp';
import { ServiceError, type AuthService, type ProfileService, type ProjectService, type Services, type Session } from './types';
import type { Storage } from './memory';

const SESSION_KEY = 'motionmind-session';

/** Real mode: everything goes through the Motion Mind API. The browser never connects to the database. */
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
  let session = readSession();
  const setSession = (s: Session | null, event: string) => {
    session = s;
    try {
      storage.setItem(SESSION_KEY, s ? JSON.stringify(s) : '');
    } catch {
      /* storage blocked: the session lasts for this tab only */
    }
    listeners.forEach((l) => l(s, event));
  };

  /** Signed-in call. A 401 means the session expired, so sign out everywhere in the app. */
  async function call<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
    if (!session) throw new ServiceError('You are signed out.', 'unauthorized');
    try {
      return await apiRequest<T>(baseUrl, path, { method, body, token: session.accessToken, fetchImpl });
    } catch (e) {
      if (e instanceof ServiceError && e.code === 'unauthorized') setSession(null, 'SIGNED_OUT');
      throw e;
    }
  }

  const auth: AuthService = {
    getSession: async () => session,
    onChange(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    async requestCode(email) {
      await apiRequest(baseUrl, '/auth/request-code', { method: 'POST', body: { email }, fetchImpl });
    },
    async verifyCode(email, code) {
      const res = await apiRequest<{ token: string; user: { id: string; email: string } }>(baseUrl, '/auth/verify-code', { method: 'POST', body: { email, code }, fetchImpl });
      setSession({ userId: res.user.id, email: res.user.email, accessToken: res.token }, 'SIGNED_IN');
    },
    signOut: async () => setSession(null, 'SIGNED_OUT'),
  };

  const profiles: ProfileService = {
    get: async () => (await call<{ profile: Profile }>('/profile')).profile,
    update: async (_userId, patch) => (await call<{ profile: Profile }>('/profile', 'PATCH', patch)).profile,
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
    create: async (input) => (await call<{ project: Project }>('/projects', 'POST', input)).project,
    update: async (id, patch) => (await call<{ project: Project }>(`/projects/${id}`, 'PATCH', patch)).project,
    async remove(id) {
      await call(`/projects/${id}`, 'DELETE');
    },
  };

  return { mode: 'api', auth, profiles, projects, claude: (getToken) => httpClaudeService(baseUrl, getToken, fetchImpl) };
}
