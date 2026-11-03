import { randomBytes } from 'node:crypto';
import { describe, expect, it } from '@jest/globals';
import { loadEnv } from './env';

const secret = () => randomBytes(32).toString('base64');
const valid = () => ({
  API_DATA_MODE: 'supabase',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'x'.repeat(40),
  KEY_ENCRYPTION_SECRET: secret(),
  AUTH_SECRET: secret(),
});

describe('loadEnv', () => {
  it('applies defaults', () => {
    const env = loadEnv(valid());
    expect(env).toMatchObject({ PORT: 8787, WEB_ORIGIN: 'http://localhost:5173', SMTP_PORT: 465 });
    expect(env.SMTP_HOST).toBeUndefined();
  });

  it('treats empty values as unset', () => {
    const env = loadEnv({ ...valid(), SMTP_HOST: '', SMTP_USER: '', PORT: '' });
    expect(env.SMTP_HOST).toBeUndefined();
    expect(env.PORT).toBe(8787);
  });

  it('lists every problem at once', () => {
    expect(() => loadEnv({ KEY_ENCRYPTION_SECRET: 'short' })).toThrow(/KEY_ENCRYPTION_SECRET must be 32 bytes[\s\S]*AUTH_SECRET/);
  });

  it('needs Supabase settings in supabase mode but not in memory mode', () => {
    const { SUPABASE_SERVICE_ROLE_KEY: _drop, ...rest } = valid();
    expect(() => loadEnv(rest)).toThrow(/SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required/);
    expect(() => loadEnv({ ...rest, API_DATA_MODE: 'memory' })).not.toThrow();
  });

  it('refuses to start with the placeholder service_role key', () => {
    expect(() => loadEnv({ ...valid(), SUPABASE_SERVICE_ROLE_KEY: 'PASTE_SERVICE_ROLE_KEY_HERE' })).toThrow(/still the placeholder/);
  });

  it('needs SMTP user and password once SMTP_HOST is set', () => {
    expect(() => loadEnv({ ...valid(), SMTP_HOST: 'smtp.gmail.com' })).toThrow(/SMTP_USER and SMTP_PASS are required/);
    expect(loadEnv({ ...valid(), SMTP_HOST: 'smtp.gmail.com', SMTP_USER: 'me@gmail.com', SMTP_PASS: 'app-pass', SMTP_PORT: '587' }).SMTP_PORT).toBe(587);
  });
});
