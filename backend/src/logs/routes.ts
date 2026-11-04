import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AppDeps } from '../app';

const entrySchema = z.object({
  t: z.string().max(40),
  level: z.enum(['debug', 'info', 'warn', 'error']),
  scope: z.string().max(40),
  msg: z.string().max(1000),
  data: z.record(z.unknown()).optional(),
});
const bodySchema = z.object({
  entries: z.array(entrySchema).min(1).max(20),
  page: z.string().max(300).optional(),
  userAgent: z.string().max(300).optional(),
});

export interface ClientLogReport {
  entries: z.infer<typeof entrySchema>[];
  page?: string;
  userAgent?: string;
  userId: string | null;
}

/** Default sink: one JSON line per report, so it shows up in the API terminal. */
export const consoleClientLogSink = (report: ClientLogReport) => console.warn(`[client-log] ${JSON.stringify(report)}`);

/**
 * Public (errors can happen before sign-in): the web app's warnings and errors, for debugging.
 * The browser already strips secrets; bodies are capped at 32 KB and 20 entries.
 */
export function registerClientLogRoutes(app: FastifyInstance, deps: AppDeps) {
  const sink = deps.clientLogSink ?? consoleClientLogSink;
  const verifier = deps.verifier ?? deps.sessions;

  app.post('/client-logs', { bodyLimit: 32 * 1024 }, async (req, reply) => {
    const body = bodySchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_logs', message: 'Log entries are malformed.' });
    const header = req.headers.authorization ?? '';
    const userId = header.startsWith('Bearer ') ? await verifier.verify(header.slice(7)) : null;
    sink({ ...body.data, userId });
    return reply.code(204).send();
  });
}
