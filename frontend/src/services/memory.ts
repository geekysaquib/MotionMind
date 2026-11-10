import { RESERVED_HANDLES, normalizeHandle, normalizePlatforms, type Profile, type Project } from '@motionmind/shared';
import { config } from '../config';
import { httpClaudeService } from './claudeHttp';
import { httpFootageService } from './footageHttp';
import { ServiceError, type AuthService, type ProfileService, type ProjectService, type Services, type Session } from './types';

/**
 * Local demo mode. Accounts and projects live in this browser's storage; nothing is sent to the database.
 * The UI shows a "Demo data" banner whenever this mode is active.
 */
/** Demo mode sends no email; this code always works. */
export const DEMO_CODE = '123456';

interface Db {
  users: { id: string; email: string }[];
  profiles: Profile[];
  projects: Project[];
  session: Session | null;
}

const KEY = 'motionmind-demo-db';

export interface Storage {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

function uid(): string {
  return crypto.randomUUID();
}

export function memoryServices(storage: Storage = window.localStorage, apiUrl = config.apiUrl): Services {
  const load = (): Db => {
    try {
      const raw = storage.getItem(KEY);
      if (raw) return JSON.parse(raw) as Db;
    } catch {
      /* corrupted demo data: start fresh */
    }
    return { users: [], profiles: [], projects: [], session: null };
  };
  let db = load();
  const save = () => storage.setItem(KEY, JSON.stringify(db));
  const listeners = new Set<(s: Session | null, e: string) => void>();
  const emit = (e: string) => listeners.forEach((l) => l(db.session, e));
  const startSession = (u: { id: string; email: string }) => {
    db.session = { userId: u.id, email: u.email, accessToken: `dev:${u.id}` };
    save();
    emit('SIGNED_IN');
  };

  const auth: AuthService = {
    async getSession() {
      db = load();
      return db.session;
    },
    onChange(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    async requestCode(email) {
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) throw new ServiceError('Enter a valid email address.', 'invalid_email');
    },
    async verifyCode(email, code) {
      if (code.trim() !== DEMO_CODE) throw new ServiceError("That code isn't right.", 'wrong_code');
      const e = email.trim().toLowerCase();
      let user = db.users.find((u) => u.email === e);
      if (!user) {
        user = { id: uid(), email: e };
        db.users.push(user);
        db.profiles.push({ id: user.id, handle: null, displayName: null, channelName: null, niche: null, language: 'hinglish', onboardedAt: null });
      }
      startSession(user);
    },
    async signOut() {
      db.session = null;
      save();
      emit('SIGNED_OUT');
    },
  };

  const profiles: ProfileService = {
    async get(userId) {
      const p = db.profiles.find((x) => x.id === userId);
      if (!p) throw new ServiceError('Profile not found', 'not_found');
      return { ...p };
    },
    async update(userId, patch) {
      const p = db.profiles.find((x) => x.id === userId);
      if (!p) throw new ServiceError('Profile not found', 'not_found');
      if (patch.handle && db.profiles.some((x) => x.id !== userId && x.handle === patch.handle)) {
        throw new ServiceError('That handle was just taken. Try another.', 'handle_taken');
      }
      Object.assign(p, patch);
      save();
      return { ...p };
    },
    async isHandleAvailable(handle) {
      const h = normalizeHandle(handle);
      return !RESERVED_HANDLES.has(h) && !db.profiles.some((x) => x.handle === h && x.id !== db.session?.userId);
    },
  };

  const mine = () => db.projects.filter((p) => p.ownerId === db.session?.userId);
  const projects: ProjectService = {
    async list() {
      return mine().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((p) => ({ ...p }));
    },
    async get(id) {
      const p = mine().find((x) => x.id === id);
      return p ? { ...p } : null;
    },
    async create(input) {
      if (!db.session) throw new ServiceError('You are signed out.', 'unauthorized');
      const now = new Date().toISOString();
      const p: Project = { id: uid(), ownerId: db.session.userId, title: input.title, topic: input.topic, stage: 'topic', status: 'draft', qualityTier: input.qualityTier, platforms: normalizePlatforms(input.platforms), durationSec: input.durationSec, script: null, research: null, editor: null, createdAt: now, updatedAt: now };
      db.projects.push(p);
      save();
      return { ...p };
    },
    async update(id, patch) {
      const p = mine().find((x) => x.id === id);
      if (!p) throw new ServiceError('Project not found', 'not_found');
      Object.assign(p, patch, { updatedAt: new Date().toISOString() });
      save();
      return { ...p };
    },
    async remove(id) {
      db.projects = db.projects.filter((x) => !(x.id === id && x.ownerId === db.session?.userId));
      save();
    },
  };

  return { mode: 'memory', auth, profiles, projects, claude: (getToken) => httpClaudeService(apiUrl, getToken), footage: (getToken) => httpFootageService(apiUrl, getToken) };
}
