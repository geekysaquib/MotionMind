import type { SupabaseClient } from '@supabase/supabase-js';
import type { Profile, Project, QualityTier, ReelScript, ResearchReport } from '@motionmind/shared';
import { RESERVED_HANDLES, normalizeHandle } from '@motionmind/shared';

export interface User {
  id: string;
  email: string;
}

export interface LoginCode {
  email: string;
  codeHash: string;
  expiresAt: number;
  attempts: number;
  createdAt: number;
}

export type ProfilePatch = Partial<Omit<Profile, 'id'>>;

export interface NewProject {
  title: string;
  topic: string | null;
  durationSec: number;
  qualityTier: QualityTier;
}

export type ProjectPatch = Partial<NewProject & Pick<Project, 'status' | 'stage'>> & { script?: ReelScript | null; research?: ResearchReport | null };

export class HandleTakenError extends Error {}

/** Everything the API stores except provider keys. Emails are always lowercase here. */
export interface DataRepository {
  getCode(email: string): Promise<LoginCode | null>;
  saveCode(code: LoginCode): Promise<void>;
  addAttempt(email: string): Promise<void>;
  deleteCode(email: string): Promise<void>;
  /** Finds the account for this email, creating it (and an empty profile) on first sign-in. */
  signInUser(email: string): Promise<User>;

  getProfile(userId: string): Promise<Profile | null>;
  updateProfile(userId: string, patch: ProfilePatch): Promise<Profile>;
  isHandleAvailable(handle: string, exceptUserId: string): Promise<boolean>;

  listProjects(ownerId: string): Promise<Project[]>;
  getProject(ownerId: string, id: string): Promise<Project | null>;
  createProject(ownerId: string, input: NewProject): Promise<Project>;
  updateProject(ownerId: string, id: string, patch: ProjectPatch): Promise<Project | null>;
  removeProject(ownerId: string, id: string): Promise<boolean>;
}

const emptyProfile = (id: string): Profile => ({ id, handle: null, displayName: null, channelName: null, niche: null, language: 'hinglish', onboardedAt: null });

export class MemoryDataRepository implements DataRepository {
  private codes = new Map<string, LoginCode>();
  private users = new Map<string, User>();
  private profiles = new Map<string, Profile>();
  private projects: Project[] = [];

  async getCode(email: string) {
    const c = this.codes.get(email);
    return c ? { ...c } : null;
  }
  async saveCode(code: LoginCode) {
    this.codes.set(code.email, { ...code });
  }
  async addAttempt(email: string) {
    const c = this.codes.get(email);
    if (c) c.attempts += 1;
  }
  async deleteCode(email: string) {
    this.codes.delete(email);
  }
  async signInUser(email: string) {
    let u = [...this.users.values()].find((x) => x.email === email);
    if (!u) {
      u = { id: crypto.randomUUID(), email };
      this.users.set(u.id, u);
      this.profiles.set(u.id, emptyProfile(u.id));
    }
    return { ...u };
  }

  async getProfile(userId: string) {
    const p = this.profiles.get(userId);
    return p ? { ...p } : null;
  }
  async updateProfile(userId: string, patch: ProfilePatch) {
    const p = this.profiles.get(userId);
    if (!p) throw new Error('Profile not found');
    if (patch.handle && [...this.profiles.values()].some((x) => x.id !== userId && x.handle === patch.handle)) throw new HandleTakenError();
    Object.assign(p, patch);
    return { ...p };
  }
  async isHandleAvailable(handle: string, exceptUserId: string) {
    const h = normalizeHandle(handle);
    return !RESERVED_HANDLES.has(h) && ![...this.profiles.values()].some((x) => x.handle === h && x.id !== exceptUserId);
  }

  private mine(ownerId: string) {
    return this.projects.filter((p) => p.ownerId === ownerId);
  }
  async listProjects(ownerId: string) {
    return this.mine(ownerId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((p) => ({ ...p }));
  }
  async getProject(ownerId: string, id: string) {
    const p = this.mine(ownerId).find((x) => x.id === id);
    return p ? { ...p } : null;
  }
  async createProject(ownerId: string, input: NewProject) {
    const now = new Date().toISOString();
    const p: Project = { id: crypto.randomUUID(), ownerId, ...input, stage: 'topic', status: 'draft', script: null, research: null, createdAt: now, updatedAt: now };
    this.projects.push(p);
    return { ...p };
  }
  async updateProject(ownerId: string, id: string, patch: ProjectPatch) {
    const p = this.mine(ownerId).find((x) => x.id === id);
    if (!p) return null;
    Object.assign(p, patch, { updatedAt: new Date().toISOString() });
    return { ...p };
  }
  async removeProject(ownerId: string, id: string) {
    const before = this.projects.length;
    this.projects = this.projects.filter((x) => !(x.id === id && x.ownerId === ownerId));
    return this.projects.length < before;
  }
}

type Row = Record<string, unknown>;

const profileFromRow = (r: Row): Profile => ({
  id: r.id as string,
  handle: (r.handle as string | null) ?? null,
  displayName: (r.display_name as string | null) ?? null,
  channelName: (r.channel_name as string | null) ?? null,
  niche: (r.niche as string | null) ?? null,
  language: (r.language as Profile['language']) ?? 'hinglish',
  onboardedAt: (r.onboarded_at as string | null) ?? null,
});

const projectFromRow = (r: Row): Project => ({
  id: r.id as string,
  ownerId: r.owner_id as string,
  title: r.title as string,
  topic: (r.topic as string | null) ?? null,
  stage: r.stage as Project['stage'],
  status: r.status as Project['status'],
  qualityTier: r.quality_tier as Project['qualityTier'],
  durationSec: r.duration_sec as number,
  script: (r.script as ReelScript | null) ?? null,
  research: (r.research as ResearchReport | null) ?? null,
  createdAt: r.created_at as string,
  updatedAt: r.updated_at as string,
});

function profileRow(patch: ProfilePatch): Row {
  const row: Row = {};
  if (patch.handle !== undefined) row.handle = patch.handle;
  if (patch.displayName !== undefined) row.display_name = patch.displayName;
  if (patch.channelName !== undefined) row.channel_name = patch.channelName;
  if (patch.niche !== undefined) row.niche = patch.niche;
  if (patch.language !== undefined) row.language = patch.language;
  if (patch.onboardedAt !== undefined) row.onboarded_at = patch.onboardedAt;
  return row;
}

function projectRow(patch: ProjectPatch): Row {
  const row: Row = {};
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.topic !== undefined) row.topic = patch.topic;
  if (patch.durationSec !== undefined) row.duration_sec = patch.durationSec;
  if (patch.qualityTier !== undefined) row.quality_tier = patch.qualityTier;
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.stage !== undefined) row.stage = patch.stage;
  if (patch.script !== undefined) row.script = patch.script;
  if (patch.research !== undefined) row.research = patch.research;
  return row;
}

/** Uses the service-role client. Every table has RLS on with no policies, so only this server can reach them. */
export class SupabaseDataRepository implements DataRepository {
  constructor(private readonly db: SupabaseClient) {}

  async getCode(email: string) {
    const { data, error } = await this.db.from('login_codes').select('*').eq('email', email).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      email: data.email as string,
      codeHash: data.code_hash as string,
      expiresAt: Date.parse(data.expires_at as string),
      attempts: data.attempts as number,
      createdAt: Date.parse(data.created_at as string),
    };
  }

  async saveCode(c: LoginCode) {
    const { error } = await this.db.from('login_codes').upsert({
      email: c.email,
      code_hash: c.codeHash,
      expires_at: new Date(c.expiresAt).toISOString(),
      attempts: c.attempts,
      created_at: new Date(c.createdAt).toISOString(),
    });
    if (error) throw error;
  }

  async addAttempt(email: string) {
    const current = await this.getCode(email);
    if (!current) return;
    const { error } = await this.db.from('login_codes').update({ attempts: current.attempts + 1 }).eq('email', email);
    if (error) throw error;
  }

  async deleteCode(email: string) {
    const { error } = await this.db.from('login_codes').delete().eq('email', email);
    if (error) throw error;
  }

  async signInUser(email: string) {
    const { data, error } = await this.db
      .from('app_users')
      .upsert({ email, last_login_at: new Date().toISOString() }, { onConflict: 'email' })
      .select('id, email')
      .single();
    if (error) throw error;
    const user = { id: data.id as string, email: data.email as string };
    const { error: pErr } = await this.db.from('profiles').upsert({ id: user.id }, { onConflict: 'id', ignoreDuplicates: true });
    if (pErr) throw pErr;
    return user;
  }

  async getProfile(userId: string) {
    const { data, error } = await this.db.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (error) throw error;
    return data ? profileFromRow(data) : null;
  }

  async updateProfile(userId: string, patch: ProfilePatch) {
    const { data, error } = await this.db.from('profiles').update(profileRow(patch)).eq('id', userId).select('*').single();
    if (error?.code === '23505') throw new HandleTakenError();
    if (error) throw error;
    return profileFromRow(data);
  }

  async isHandleAvailable(handle: string, exceptUserId: string) {
    const h = normalizeHandle(handle);
    if (RESERVED_HANDLES.has(h)) return false;
    const { data, error } = await this.db.from('profiles').select('id').eq('handle', h).neq('id', exceptUserId).limit(1);
    if (error) throw error;
    return (data ?? []).length === 0;
  }

  async listProjects(ownerId: string) {
    const { data, error } = await this.db.from('projects').select('*').eq('owner_id', ownerId).order('updated_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(projectFromRow);
  }

  async getProject(ownerId: string, id: string) {
    const { data, error } = await this.db.from('projects').select('*').eq('owner_id', ownerId).eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? projectFromRow(data) : null;
  }

  async createProject(ownerId: string, input: NewProject) {
    const { data, error } = await this.db
      .from('projects')
      .insert({ owner_id: ownerId, ...projectRow(input) })
      .select('*')
      .single();
    if (error) throw error;
    return projectFromRow(data);
  }

  async updateProject(ownerId: string, id: string, patch: ProjectPatch) {
    const { data, error } = await this.db.from('projects').update(projectRow(patch)).eq('owner_id', ownerId).eq('id', id).select('*').maybeSingle();
    if (error) throw error;
    return data ? projectFromRow(data) : null;
  }

  async removeProject(ownerId: string, id: string) {
    const { error, count } = await this.db.from('projects').delete({ count: 'exact' }).eq('owner_id', ownerId).eq('id', id);
    if (error) throw error;
    return (count ?? 0) > 0;
  }
}
