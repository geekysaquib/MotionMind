import type { SupabaseClient } from '@supabase/supabase-js';

export interface TokenVerifier {
  /** Returns the user id for a valid access token, or null. */
  verify(token: string): Promise<string | null>;
}

export class SupabaseTokenVerifier implements TokenVerifier {
  constructor(private readonly db: SupabaseClient) {}
  async verify(token: string) {
    const { data, error } = await this.db.auth.getUser(token);
    if (error || !data.user) return null;
    return data.user.id;
  }
}

/** Local demo mode only: accepts "dev:<user-id>" tokens. */
export class DevTokenVerifier implements TokenVerifier {
  async verify(token: string) {
    return token.startsWith('dev:') && token.length > 4 ? token.slice(4) : null;
  }
}
