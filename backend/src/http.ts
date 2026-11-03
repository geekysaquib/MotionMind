import type { z } from 'zod';

/** The first validation message, for a 400 response the UI can show as-is. */
export const firstIssue = (e: z.ZodError) => e.issues[0]?.message ?? 'Invalid request.';
