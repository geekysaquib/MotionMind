import { createHmac, timingSafeEqual } from 'node:crypto';
import type { TokenVerifier } from '../auth';

/** Signed session tokens (HS256 JWT). The secret never leaves the API server. */
export class SessionTokens implements TokenVerifier {
  private readonly key: Buffer;

  constructor(secret: string, private readonly ttlSec = 60 * 60 * 24 * 30) {
    this.key = Buffer.from(secret, 'base64');
  }

  issue(userId: string, email: string, now = Date.now()): string {
    const header = b64({ alg: 'HS256', typ: 'JWT' });
    const iat = Math.floor(now / 1000);
    const body = b64({ sub: userId, email, iat, exp: iat + this.ttlSec });
    return `${header}.${body}.${this.sign(`${header}.${body}`)}`;
  }

  async verify(token: string, now = Date.now()): Promise<string | null> {
    const [header, body, sig] = token.split('.');
    if (!header || !body || !sig) return null;
    const expected = Buffer.from(this.sign(`${header}.${body}`));
    const given = Buffer.from(sig);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
    try {
      const claims = JSON.parse(Buffer.from(body, 'base64url').toString()) as { sub?: string; exp?: number };
      if (!claims.sub || !claims.exp || claims.exp * 1000 < now) return null;
      return claims.sub;
    } catch {
      return null;
    }
  }

  private sign(data: string) {
    return createHmac('sha256', this.key).update(data).digest('base64url');
  }
}

const b64 = (v: object) => Buffer.from(JSON.stringify(v)).toString('base64url');
