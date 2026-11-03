import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Profile, Project } from '@motionmind/shared';
import { config } from '../config';
import { httpKeysService } from './keysHttp';
import { ServiceError, type AuthService, type ProfileService, type ProjectService, type Services, type Session } from './types';

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
  createdAt: r.created_at as string,
  updatedAt: r.updated_at as string,
});

function fail(error: { message: string; code?: string } | null): never {
  throw new ServiceError(error?.message ?? 'Unknown database error', error?.code ?? 'db');
}

function toSession(s: { user: { id: string; email?: string }; access_token: string } | null): Session | null {
  return s ? { userId: s.user.id, email: s.user.email ?? '', accessToken: s.access_token } : null;
}

export function supabaseServices(): Services {
  const db: SupabaseClient = createClient(config.supabaseUrl!, config.supabaseAnonKey!, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  const origin = window.location.origin;

  const auth: AuthService = {
    async getSession() {
      const { data } = await db.auth.getSession();
      return toSession(data.session);
    },
    onChange(cb) {
      const { data } = db.auth.onAuthStateChange((event, s) => cb(toSession(s), event));
      return () => data.subscription.unsubscribe();
    },
    async signUp(email, password, displayName) {
      const { data, error } = await db.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName }, emailRedirectTo: `${origin}/auth/callback` },
      });
      if (error) fail(error);
      return { needsConfirmation: !data.session };
    },
    async signIn(email, password) {
      const { error } = await db.auth.signInWithPassword({ email, password });
      if (error) fail(error);
    },
    async sendMagicLink(email) {
      const { error } = await db.auth.signInWithOtp({ email, options: { emailRedirectTo: `${origin}/auth/callback` } });
      if (error) fail(error);
    },
    async sendPasswordReset(email) {
      const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/reset-password` });
      if (error) fail(error);
    },
    async updatePassword(password) {
      const { error } = await db.auth.updateUser({ password });
      if (error) fail(error);
    },
    async signOut() {
      const { error } = await db.auth.signOut();
      if (error) fail(error);
    },
  };

  const profiles: ProfileService = {
    async get(userId) {
      const { data, error } = await db.from('profiles').select('*').eq('id', userId).single();
      if (error) fail(error);
      return profileFromRow(data);
    },
    async update(userId, patch) {
      const row: Row = {};
      if (patch.handle !== undefined) row.handle = patch.handle;
      if (patch.displayName !== undefined) row.display_name = patch.displayName;
      if (patch.channelName !== undefined) row.channel_name = patch.channelName;
      if (patch.niche !== undefined) row.niche = patch.niche;
      if (patch.language !== undefined) row.language = patch.language;
      if (patch.onboardedAt !== undefined) row.onboarded_at = patch.onboardedAt;
      const { data, error } = await db.from('profiles').update(row).eq('id', userId).select('*').single();
      if (error?.code === '23505') throw new ServiceError('That handle was just taken. Try another.', 'handle_taken');
      if (error) fail(error);
      return profileFromRow(data);
    },
    async isHandleAvailable(handle) {
      const { data, error } = await db.rpc('handle_available', { p_handle: handle });
      if (error) fail(error);
      return Boolean(data);
    },
  };

  const projects: ProjectService = {
    async list() {
      const { data, error } = await db.from('projects').select('*').order('updated_at', { ascending: false });
      if (error) fail(error);
      return (data ?? []).map(projectFromRow);
    },
    async get(id) {
      const { data, error } = await db.from('projects').select('*').eq('id', id).maybeSingle();
      if (error) fail(error);
      return data ? projectFromRow(data) : null;
    },
    async create(input) {
      const { data, error } = await db
        .from('projects')
        .insert({ title: input.title, topic: input.topic, duration_sec: input.durationSec, quality_tier: input.qualityTier })
        .select('*')
        .single();
      if (error) fail(error);
      return projectFromRow(data);
    },
    async update(id, patch) {
      const row: Row = {};
      if (patch.title !== undefined) row.title = patch.title;
      if (patch.topic !== undefined) row.topic = patch.topic;
      if (patch.durationSec !== undefined) row.duration_sec = patch.durationSec;
      if (patch.qualityTier !== undefined) row.quality_tier = patch.qualityTier;
      if (patch.status !== undefined) row.status = patch.status;
      if (patch.stage !== undefined) row.stage = patch.stage;
      const { data, error } = await db.from('projects').update(row).eq('id', id).select('*').single();
      if (error) fail(error);
      return projectFromRow(data);
    },
    async remove(id) {
      const { error } = await db.from('projects').delete().eq('id', id);
      if (error) fail(error);
    },
  };

  return { mode: 'supabase', auth, profiles, projects, keys: (getToken) => httpKeysService(config.apiUrl, getToken) };
}
