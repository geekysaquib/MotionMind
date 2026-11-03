import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

export const CODE_TTL_MS = 10 * 60 * 1000;
export const RESEND_AFTER_MS = 30 * 1000;
export const MAX_ATTEMPTS = 5;

export function newCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

/** Codes are stored only as an HMAC tied to the email, so a database leak doesn't reveal them. */
export function hashCode(secret: string, email: string, code: string): string {
  return createHmac('sha256', Buffer.from(secret, 'base64')).update(`${email}:${code}`).digest('hex');
}

export function codeMatches(secret: string, email: string, code: string, storedHash: string): boolean {
  const a = Buffer.from(hashCode(secret, email, code));
  const b = Buffer.from(storedHash);
  return a.length === b.length && timingSafeEqual(a, b);
}
