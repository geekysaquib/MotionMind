import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProviderId, StoredKeySummary } from '@motionmind/shared';
import type { Sealed } from './crypto';

export interface KeyRecord extends Sealed {
  userId: string;
  provider: ProviderId;
  last4: string;
  updatedAt: string;
  lastTestedAt: string | null;
  lastTestOk: boolean | null;
}

export interface KeyRepository {
  list(userId: string): Promise<KeyRecord[]>;
  get(userId: string, provider: ProviderId): Promise<KeyRecord | null>;
  upsert(record: Omit<KeyRecord, 'updatedAt' | 'lastTestedAt' | 'lastTestOk'>): Promise<KeyRecord>;
  remove(userId: string, provider: ProviderId): Promise<boolean>;
  markTested(userId: string, provider: ProviderId, ok: boolean): Promise<void>;
}

export function toSummary(r: KeyRecord): StoredKeySummary {
  return { provider: r.provider, last4: r.last4, updatedAt: r.updatedAt, lastTestedAt: r.lastTestedAt, lastTestOk: r.lastTestOk };
}

export class MemoryKeyRepository implements KeyRepository {
  private readonly rows = new Map<string, KeyRecord>();
  private k(userId: string, provider: string) {
    return `${userId}:${provider}`;
  }
  async list(userId: string) {
    return [...this.rows.values()].filter((r) => r.userId === userId);
  }
  async get(userId: string, provider: ProviderId) {
    return this.rows.get(this.k(userId, provider)) ?? null;
  }
  async upsert(record: Omit<KeyRecord, 'updatedAt' | 'lastTestedAt' | 'lastTestOk'>) {
    const row: KeyRecord = { ...record, updatedAt: new Date().toISOString(), lastTestedAt: null, lastTestOk: null };
    this.rows.set(this.k(record.userId, record.provider), row);
    return row;
  }
  async remove(userId: string, provider: ProviderId) {
    return this.rows.delete(this.k(userId, provider));
  }
  async markTested(userId: string, provider: ProviderId, ok: boolean) {
    const row = this.rows.get(this.k(userId, provider));
    if (row) {
      row.lastTestedAt = new Date().toISOString();
      row.lastTestOk = ok;
    }
  }
}

interface Row {
  user_id: string;
  provider: ProviderId;
  ciphertext: string;
  iv: string;
  auth_tag: string;
  last4: string;
  updated_at: string;
  last_tested_at: string | null;
  last_test_ok: boolean | null;
}

const COLUMNS = 'user_id, provider, ciphertext, iv, auth_tag, last4, updated_at, last_tested_at, last_test_ok';

function fromRow(r: Row): KeyRecord {
  return {
    userId: r.user_id,
    provider: r.provider,
    ciphertext: r.ciphertext,
    iv: r.iv,
    authTag: r.auth_tag,
    last4: r.last4,
    updatedAt: r.updated_at,
    lastTestedAt: r.last_tested_at,
    lastTestOk: r.last_test_ok,
  };
}

/** Uses the service-role client: provider_credentials has RLS with no policies, so only this server can touch it. */
export class SupabaseKeyRepository implements KeyRepository {
  constructor(private readonly db: SupabaseClient) {}

  async list(userId: string) {
    const { data, error } = await this.db.from('provider_credentials').select(COLUMNS).eq('user_id', userId);
    if (error) throw error;
    return (data as Row[]).map(fromRow);
  }

  async get(userId: string, provider: ProviderId) {
    const { data, error } = await this.db
      .from('provider_credentials')
      .select(COLUMNS)
      .eq('user_id', userId)
      .eq('provider', provider)
      .maybeSingle();
    if (error) throw error;
    return data ? fromRow(data as Row) : null;
  }

  async upsert(record: Omit<KeyRecord, 'updatedAt' | 'lastTestedAt' | 'lastTestOk'>) {
    const { data, error } = await this.db
      .from('provider_credentials')
      .upsert(
        {
          user_id: record.userId,
          provider: record.provider,
          ciphertext: record.ciphertext,
          iv: record.iv,
          auth_tag: record.authTag,
          last4: record.last4,
          last_tested_at: null,
          last_test_ok: null,
        },
        { onConflict: 'user_id,provider' },
      )
      .select(COLUMNS)
      .single();
    if (error) throw error;
    return fromRow(data as Row);
  }

  async remove(userId: string, provider: ProviderId) {
    const { error, count } = await this.db
      .from('provider_credentials')
      .delete({ count: 'exact' })
      .eq('user_id', userId)
      .eq('provider', provider);
    if (error) throw error;
    return (count ?? 0) > 0;
  }

  async markTested(userId: string, provider: ProviderId, ok: boolean) {
    const { error } = await this.db
      .from('provider_credentials')
      .update({ last_tested_at: new Date().toISOString(), last_test_ok: ok })
      .eq('user_id', userId)
      .eq('provider', provider);
    if (error) throw error;
  }
}
