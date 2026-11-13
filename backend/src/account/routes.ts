import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { STAGES, handleSchema } from '@motionmind/shared';
import type { AppDeps } from '../app';
import { HandleTakenError } from '../data/repository';
import { firstIssue } from '../http';

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
  platforms: z.array(z.enum(['instagram', 'youtube'])).min(1, 'Pick at least one platform.').max(2).optional(),
};
const newProjectSchema = z.object(projectFields).strict();
const projectPatchSchema = z
  .object({
    ...projectFields,
    status: z.enum(['draft', 'in_progress', 'completed', 'archived']),
    stage: z.enum(STAGES),
  })
  .partial()
  .strict();

/** A malformed id can't match any project; answering 404 here keeps it from reaching Postgres as a type error. */
const projectId = (params: unknown) => {
  const id = (params as { id: string }).id;
  return z.string().uuid().safeParse(id).success ? id : null;
};

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
    const project = id ? await deps.data.getProject(req.userId, id) : null;
    const removed = project ? await deps.data.removeProject(req.userId, project.id) : false;
    if (!project || !removed) return reply.code(404).send({ error: 'not_found', message: 'Project not found.' });
    // The project's files go with it: recordings and music in the storage bucket, and the videos and covers made on this machine.
    // The reel itself is already deleted, so a failure here is logged, never shown as a failed delete.
    await deps.audio.removeFolder(`${req.userId}/${project.id}`).catch((err) => req.log.warn({ err, projectId: project.id }, 'could not delete the project files from storage'));
    await deps.renderer?.removeProject?.(req.userId, project.id).catch((err) => req.log.warn({ err, projectId: project.id }, 'could not delete the project renders'));
    return { ok: true };
  });
}
