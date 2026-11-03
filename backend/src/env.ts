import { z } from 'zod';

const schema = z
  .object({
    PORT: z.coerce.number().int().positive().default(8787),
    WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
    API_DATA_MODE: z.enum(['supabase', 'memory']).default('supabase'),
    SUPABASE_URL: z.string().url().optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),
    KEY_ENCRYPTION_SECRET: z
      .string()
      .refine((v) => Buffer.from(v, 'base64').length === 32, 'KEY_ENCRYPTION_SECRET must be 32 bytes, base64-encoded'),
  })
  .superRefine((env, ctx) => {
    if (env.API_DATA_MODE === 'supabase' && (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY)) {
      ctx.addIssue({ code: 'custom', message: 'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required when API_DATA_MODE=supabase' });
    }
  });

export type Env = z.infer<typeof schema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.') || 'env'}: ${i.message}`);
    throw new Error(`Invalid API configuration:\n${lines.join('\n')}`);
  }
  return parsed.data;
}
