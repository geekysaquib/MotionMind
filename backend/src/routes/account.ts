import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { handleSchema } from '@motionmind/shared';
import type { AppDeps } from '../app';
import { CODE_TTL_MS, MAX_ATTEMPTS, RESEND_AFTER_MS, codeMatches, hashCode, newCode } from '../accounts/otp';
import { HandleTakenError } from '../data/repository';

const emailSchema = z.string().trim().toLowerCase().email('Enter a valid email address.').max(254);
const requestSchema = z.object({ email: emailSchema });
const verifySchema = z.object({ email: emailSchema, code: z.string().trim().regex(/^\d{6}$/, 'The code is 6 digits.') });

const short = (max: number) => z.string().trim().max(max).nullable();
const profilePatchSchema = z
  .object({
    handle: handleSchema.nullable(),
    displayName: short(60),
    channelName: short(60),
    niche: short(60),
    language: z.enum(['en', 'hi', 'hinglish']),
    onboardedAt: z.string().datetime().nullable(),
  })
  .partial()
  .strict();

const projectFields = {
  title: z.string().trim().min(1, 'Give the reel a title.').max(120),
  topic: z.string().trim().max(500).nullable(),
  durationSec: z.union([z.literal(15), z.literal(30), z.literal(45), z.literal(60), z.literal(90)]),
  qualityTier: z.enum(['draft', 'standard', 'premium', 'cinematic']),
};
const newProjectSchema = z.object(projectFields).strict();
const projectPatchSchema = z
  .object({
    ...projectFields,
    status: z.enum(['draft', 'in_progress', 'completed', 'archived']),
    stage: z.enum(['topic', 'research', 'script', 'storyboard', 'graphics', 'voice', 'final']),
  })
  .partial()
  .strict();

const firstIssue = (e: z.ZodError) => e.issues[0]?.message ?? 'Invalid request.';
/** A malformed id can't match any project; answering 404 here keeps it from reaching Postgres as a type error. */
const projectId = (params: unknown) => {
  const id = (params as { id: string }).id;
  return z.string().uuid().safeParse(id).success ? id : null;
};

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

/** Signed-in only: the caller's profile and projects. */
export function registerAccountRoutes(api: FastifyInstance, deps: AppDeps) {
  api.get('/profile', async (req, reply) => {
    const profile = await deps.data.getProfile(req.userId);
    return profile ? { profile } : reply.code(404).send({ error: 'not_found', message: 'Profile not found.' });
  });

  api.patch('/profile', async (req, reply) => {
    const body = profilePatchSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_profile', message: firstIssue(body.error) });
    try {
      return { profile: await deps.data.updateProfile(req.userId, body.data) };
    } catch (err) {
      if (err instanceof HandleTakenError) return reply.code(409).send({ error: 'handle_taken', message: 'That handle was just taken. Try another.' });
      throw err;
    }
  });

  api.get('/handles/:handle/available', async (req) => {
    const parsed = handleSchema.safeParse((req.params as { handle: string }).handle);
    if (!parsed.success) return { available: false };
    return { available: await deps.data.isHandleAvailable(parsed.data, req.userId) };
  });

  api.get('/projects', async (req) => ({ projects: await deps.data.listProjects(req.userId) }));

  api.get('/projects/:id', async (req, reply) => {
    const id = projectId(req.params);
    const p = id ? await deps.data.getProject(req.userId, id) : null;
    return p ? { project: p } : reply.code(404).send({ error: 'not_found', message: 'Project not found.' });
  });

  api.post('/projects', async (req, reply) => {
    const body = newProjectSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_project', message: firstIssue(body.error) });
    return { project: await deps.data.createProject(req.userId, body.data) };
  });

  api.patch('/projects/:id', async (req, reply) => {
    const body = projectPatchSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_project', message: firstIssue(body.error) });
    const id = projectId(req.params);
    const p = id ? await deps.data.updateProject(req.userId, id, body.data) : null;
    return p ? { project: p } : reply.code(404).send({ error: 'not_found', message: 'Project not found.' });
  });

  api.delete('/projects/:id', async (req, reply) => {
    const id = projectId(req.params);
    const removed = id ? await deps.data.removeProject(req.userId, id) : false;
    return removed ? { ok: true } : reply.code(404).send({ error: 'not_found', message: 'Project not found.' });
  });
}
