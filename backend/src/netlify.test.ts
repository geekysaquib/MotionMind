import { randomBytes } from 'node:crypto';
import { beforeAll, describe, expect, it } from '@jest/globals';

// Netlify treats every file in netlify/functions as a function, so this test lives here.
// The Netlify function builds the app from process.env on first call; use demo (memory) mode.
beforeAll(() => {
  Object.assign(process.env, {
    API_DATA_MODE: 'memory',
    AUTH_SECRET: randomBytes(32).toString('base64'),
    URL: 'https://motionmind.netlify.app',
    SMTP_HOST: '',
  });
});

describe('Netlify function adapter', () => {
  it('passes requests through to the API and back', async () => {
    const { default: handler } = await import('../netlify/functions/api');
    const health = await handler(new Request('https://motionmind.netlify.app/health'));
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ ok: true, mode: 'memory' });
  });

  it('forwards method, body and headers, and keeps the status code', async () => {
    const { default: handler } = await import('../netlify/functions/api');
    const res = await handler(
      new Request('https://motionmind.netlify.app/api/auth/request-code', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'https://motionmind.netlify.app' },
        body: JSON.stringify({ email: 'nope' }),
      }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalid_email');
    expect(res.headers.get('access-control-allow-origin')).toBe('https://motionmind.netlify.app');
  });

  it('answers 401 for signed-in routes without a token, with no body on 204s', async () => {
    const { default: handler } = await import('../netlify/functions/api');
    expect((await handler(new Request('https://motionmind.netlify.app/api/projects'))).status).toBe(401);
    const logged = await handler(
      new Request('https://motionmind.netlify.app/api/client-logs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ entries: [{ t: 'now', level: 'error', scope: 'test', msg: 'from the adapter test' }] }),
      }),
    );
    expect(logged.status).toBe(204);
    expect(await logged.text()).toBe('');
  });
});
