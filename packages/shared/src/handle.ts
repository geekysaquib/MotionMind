import { z } from 'zod';

export const HANDLE_MIN = 3;
export const HANDLE_MAX = 30;

/** Instagram-style handle: letters, numbers, dot and underscore; no leading/trailing or double dots. */
export const HANDLE_PATTERN = /^(?!.*\.\.)(?!\.)(?!.*\.$)[a-z0-9._]{3,30}$/;

export const RESERVED_HANDLES = new Set([
  'admin', 'api', 'app', 'auth', 'help', 'login', 'logout', 'settings', 'signup', 'support', 'root', 'system', 'www',
]);

export function normalizeHandle(raw: string): string {
  return raw.trim().replace(/^@/, '').toLowerCase();
}

export type HandleProblem = 'too_short' | 'too_long' | 'invalid_chars' | 'dots' | 'reserved';

export function checkHandle(raw: string): HandleProblem | null {
  const h = normalizeHandle(raw);
  if (h.length < HANDLE_MIN) return 'too_short';
  if (h.length > HANDLE_MAX) return 'too_long';
  if (!/^[a-z0-9._]+$/.test(h)) return 'invalid_chars';
  if (!HANDLE_PATTERN.test(h)) return 'dots';
  if (RESERVED_HANDLES.has(h)) return 'reserved';
  return null;
}

export const HANDLE_MESSAGES: Record<HandleProblem, string> = {
  too_short: `Use at least ${HANDLE_MIN} characters.`,
  too_long: `Use at most ${HANDLE_MAX} characters.`,
  invalid_chars: 'Only letters, numbers, dots and underscores.',
  dots: "Dots can't be first, last, or next to each other.",
  reserved: 'That handle is reserved.',
};

export const handleSchema = z
  .string()
  .transform(normalizeHandle)
  .refine((h) => checkHandle(h) === null, (h) => ({ message: HANDLE_MESSAGES[checkHandle(h) ?? 'invalid_chars'] }));
