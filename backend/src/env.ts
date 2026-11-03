import { z } from 'zod';

const base64Secret = (name: string) =>
  z.string().refine((v) => Buffer.from(v, 'base64').length === 32, `${name} must be 32 bytes, base64-encoded`);

const schema = z
  .object({
    PORT: z.coerce.number().int().positive().default(8787),
    WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
    API_DATA_MODE: z.enum(['supabase', 'memory']).default('supabase'),
    SUPABASE_URL: z.string().url().optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),
    AUTH_SECRET: base64Secret('AUTH_SECRET'),
    // Claude for every user (script writing, Ask Claude). Users never add their own keys.
    ANTHROPIC_API_KEY: z.string().min(20).optional(),
    // Login-code email. Leave SMTP_HOST empty in the root .env during development to print codes in the terminal instead.
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().positive().default(465),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    SMTP_FROM: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.API_DATA_MODE === 'supabase' && (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY)) {
      ctx.addIssue({ code: 'custom', message: 'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required when API_DATA_MODE=supabase' });
    }
    // Catch the template placeholder at startup instead of as "Invalid API key" on the first request.
    if (env.API_DATA_MODE === 'supabase' && /^(PASTE_|server-only-service-role-key$)/.test(env.SUPABASE_SERVICE_ROLE_KEY ?? '')) {
      ctx.addIssue({ code: 'custom', message: 'SUPABASE_SERVICE_ROLE_KEY is still the placeholder. Paste the service_role key from Supabase > Project Settings > API into .env' });
    }
    if (env.SMTP_HOST && (!env.SMTP_USER || !env.SMTP_PASS)) {
      ctx.addIssue({ code: 'custom', message: 'SMTP_USER and SMTP_PASS are required when SMTP_HOST is set' });
    }
  });

export type Env = z.infer<typeof schema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  // Empty values in .env ("SMTP_HOST=") mean "not set".
  const cleaned = Object.fromEntries(Object.entries(source).filter(([, v]) => v !== ''));
  const parsed = schema.safeParse(cleaned);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.') || 'env'}: ${i.message}`);
    throw new Error(`Invalid API configuration:\n${lines.join('\n')}`);
  }
  return parsed.data;
}
