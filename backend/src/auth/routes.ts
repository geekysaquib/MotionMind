import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AppDeps } from '../app';
import { firstIssue } from '../http';
import { CODE_TTL_MS, MAX_ATTEMPTS, RESEND_AFTER_MS, codeMatches, hashCode, newCode } from './otp';

const emailSchema = z.string().trim().toLowerCase().email('Enter a valid email address.').max(254);
const requestSchema = z.object({ email: emailSchema });
const verifySchema = z.object({ email: emailSchema, code: z.string().trim().regex(/^\d{6}$/, 'The code is 6 digits.') });

/** Public: email a 6-digit code, then trade it for a session token. */
export function registerLoginRoutes(app: FastifyInstance, deps: AppDeps) {
  app.post('/request-code', async (req, reply) => {
    const body = requestSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_email', message: firstIssue(body.error) });
    const { email } = body.data;
    const now = Date.now();
    const existing = await deps.data.getCode(email);
    if (existing && now - existing.createdAt < RESEND_AFTER_MS) {
      const wait = Math.ceil((RESEND_AFTER_MS - (now - existing.createdAt)) / 1000);
      return reply.code(429).send({ error: 'too_soon', message: `Wait ${wait}s before asking for another code.` });
    }
    const code = newCode();
    await deps.data.saveCode({ email, codeHash: hashCode(deps.authSecret, email, code), expiresAt: now + CODE_TTL_MS, attempts: 0, createdAt: now });
    try {
      await deps.mailer.sendLoginCode(email, code);
    } catch (err) {
      req.log.error({ err }, 'sending login code failed');
      await deps.data.deleteCode(email);
      return reply.code(502).send({ error: 'email_failed', message: "Couldn't send the email. Check the SMTP settings on the server." });
    }
    return { ok: true };
  });

  app.post('/verify-code', async (req, reply) => {
    const body = verifySchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_code', message: firstIssue(body.error) });
    const { email, code } = body.data;
    const stored = await deps.data.getCode(email);
    if (!stored || stored.expiresAt < Date.now()) {
      return reply.code(400).send({ error: 'code_expired', message: 'That code has expired. Ask for a new one.' });
    }
    if (stored.attempts >= MAX_ATTEMPTS) {
      await deps.data.deleteCode(email);
      return reply.code(429).send({ error: 'too_many_attempts', message: 'Too many wrong tries. Ask for a new code.' });
    }
    if (!codeMatches(deps.authSecret, email, code, stored.codeHash)) {
      await deps.data.addAttempt(email);
      return reply.code(400).send({ error: 'wrong_code', message: "That code isn't right." });
    }
    await deps.data.deleteCode(email);
    const user = await deps.data.signInUser(email);
    return { token: deps.sessions.issue(user.id, user.email), user };
  });
}
