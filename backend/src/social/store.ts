import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SocialAccount, SocialPlatform } from '@motionmind/shared';

// Connected accounts and their tokens. Tokens are encrypted by the API (AES-256-GCM) before they are stored, with a key
// derived from AUTH_SECRET, so a copy of the database alone does not give access to anyone's account.

export interface StoredAccount extends SocialAccount {
  accessToken: string;
  refreshToken: string | null;
  /** When the access token itself expires (YouTube: about an hour; Instagram: 60 days). */
  tokenExpiresAt: string | null;
}

export interface SocialStore {
  list(userId: string): Promise<SocialAccount[]>;
  get(userId: string, platform: SocialPlatform): Promise<StoredAccount | null>;
  save(userId: string, account: StoredAccount): Promise<void>;
  remove(userId: string, platform: SocialPlatform): Promise<void>;
  /** Keeps one follower count per day, so there is a history even where the platform gives none. */
  snapshot(userId: string, platform: SocialPlatform, day: string, followers: number): Promise<void>;
  snapshots(userId: string, platform: SocialPlatform, since: string): Promise<{ date: string; followers: number }[]>;
}

/** The table the store needs is missing: the migration has not been applied yet. */
export class NeedsMigrationError extends Error {}

const publicPart = (a: StoredAccount): SocialAccount => ({ platform: a.platform, accountId: a.accountId, handle: a.handle, name: a.name, avatarUrl: a.avatarUrl, connectedAt: a.connectedAt, expiresAt: a.expiresAt });

export class TokenBox {
  private readonly key: Buffer;
  constructor(authSecret: string) {
    this.key = createHash('sha256').update(Buffer.from(authSecret, 'base64')).update('motionmind-social-tokens-v1').digest();
  }
  seal(plain: string): string {
    const iv = randomBytes(12);
    const c = createCipheriv('aes-256-gcm', this.key, iv);
    const body = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
    return ['v1', iv.toString('base64'), c.getAuthTag().toString('base64'), body.toString('base64')].join('.');
  }
  open(sealed: string): string {
    const [v, iv, tag, body] = sealed.split('.');
    if (v !== 'v1' || !iv || !tag || !body) throw new Error('Unknown token format.');
    const d = createDecipheriv('aes-256-gcm', this.key, Buffer.from(iv, 'base64'));
    d.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([d.update(Buffer.from(body, 'base64')), d.final()]).toString('utf8');
  }
}

export class MemorySocialStore implements SocialStore {
  private accounts = new Map<string, StoredAccount>();
  private days = new Map<string, Map<string, number>>();
  async list(userId: string) {
    return [...this.accounts.entries()].filter(([k]) => k.startsWith(`${userId}:`)).map(([, a]) => publicPart(a));
  }
  async get(userId: string, platform: SocialPlatform) {
    return this.accounts.get(`${userId}:${platform}`) ?? null;
  }
  async save(userId: string, account: StoredAccount) {
    this.accounts.set(`${userId}:${account.platform}`, { ...account });
  }
  async remove(userId: string, platform: SocialPlatform) {
    this.accounts.delete(`${userId}:${platform}`);
    this.days.delete(`${userId}:${platform}`);
  }
  async snapshot(userId: string, platform: SocialPlatform, day: string, followers: number) {
    const key = `${userId}:${platform}`;
    if (!this.days.has(key)) this.days.set(key, new Map());
    this.days.get(key)!.set(day, followers);
  }
  async snapshots(userId: string, platform: SocialPlatform, since: string) {
    return [...(this.days.get(`${userId}:${platform}`) ?? new Map<string, number>()).entries()]
      .filter(([d]) => d >= since)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, followers]) => ({ date, followers }));
  }
}

type Row = Record<string, unknown>;

export class SupabaseSocialStore implements SocialStore {
  constructor(private readonly db: SupabaseClient, private readonly box: TokenBox) {}

  private check(error: { code?: string; message?: string } | null) {
    if (!error) return;
    // 42P01 / PGRST205: the table does not exist yet.
    if (error.code === '42P01' || error.code === 'PGRST205' || /social_(accounts|snapshots)/.test(error.message ?? '')) throw new NeedsMigrationError(error.message);
    throw error;
  }

  private toAccount(r: Row): StoredAccount {
    return {
      platform: r.platform as SocialPlatform,
      accountId: r.account_id as string,
      handle: r.handle as string,
      name: (r.name as string | null) ?? null,
      avatarUrl: (r.avatar_url as string | null) ?? null,
      connectedAt: r.connected_at as string,
      expiresAt: (r.expires_at as string | null) ?? null,
      accessToken: this.box.open(r.access_token as string),
      refreshToken: r.refresh_token ? this.box.open(r.refresh_token as string) : null,
      tokenExpiresAt: (r.token_expires_at as string | null) ?? null,
    };
  }

  async list(userId: string) {
    const { data, error } = await this.db.from('social_accounts').select('platform, account_id, handle, name, avatar_url, connected_at, expires_at').eq('user_id', userId);
    this.check(error);
    return (data ?? []).map((r: Row) => ({ platform: r.platform as SocialPlatform, accountId: r.account_id as string, handle: r.handle as string, name: (r.name as string | null) ?? null, avatarUrl: (r.avatar_url as string | null) ?? null, connectedAt: r.connected_at as string, expiresAt: (r.expires_at as string | null) ?? null }));
  }

  async get(userId: string, platform: SocialPlatform) {
    const { data, error } = await this.db.from('social_accounts').select('*').eq('user_id', userId).eq('platform', platform).maybeSingle();
    this.check(error);
    return data ? this.toAccount(data as Row) : null;
  }

  async save(userId: string, a: StoredAccount) {
    const { error } = await this.db.from('social_accounts').upsert(
      {
        user_id: userId,
        platform: a.platform,
        account_id: a.accountId,
        handle: a.handle,
        name: a.name,
        avatar_url: a.avatarUrl,
        connected_at: a.connectedAt,
        expires_at: a.expiresAt,
        access_token: this.box.seal(a.accessToken),
        refresh_token: a.refreshToken ? this.box.seal(a.refreshToken) : null,
        token_expires_at: a.tokenExpiresAt,
      },
      { onConflict: 'user_id,platform' },
    );
    this.check(error);
  }

  async remove(userId: string, platform: SocialPlatform) {
    const a = await this.db.from('social_accounts').delete().eq('user_id', userId).eq('platform', platform);
    this.check(a.error);
    const b = await this.db.from('social_snapshots').delete().eq('user_id', userId).eq('platform', platform);
    this.check(b.error);
  }

  async snapshot(userId: string, platform: SocialPlatform, day: string, followers: number) {
    const { error } = await this.db.from('social_snapshots').upsert({ user_id: userId, platform, day, followers }, { onConflict: 'user_id,platform,day' });
    this.check(error);
  }

  async snapshots(userId: string, platform: SocialPlatform, since: string) {
    const { data, error } = await this.db.from('social_snapshots').select('day, followers').eq('user_id', userId).eq('platform', platform).gte('day', since).order('day');
    this.check(error);
    return (data ?? []).map((r: Row) => ({ date: r.day as string, followers: Number(r.followers) }));
  }
}
