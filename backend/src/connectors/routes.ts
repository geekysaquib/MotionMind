import type { FastifyInstance } from 'fastify';
import type { AppDeps } from '../app';
import { CLAUDE_MODEL } from '../ai/claude';
import { checkElevenLabs } from './elevenlabs';

export type ConnectorId = 'claude' | 'elevenlabs';

/**
 * Signed-in only: the app's two connectors. Both run on server keys from .env (or Netlify env vars),
 * so users only see whether each one is ready and can test it.
 */
export function registerConnectorRoutes(api: FastifyInstance, deps: AppDeps) {
  api.get('/connectors', async () => ({
    connectors: [
      { id: 'claude', name: 'Claude', purpose: 'Writes and researches your reel scripts', connected: Boolean(deps.anthropicApiKey), detail: CLAUDE_MODEL },
      { id: 'elevenlabs', name: 'ElevenLabs', purpose: 'Voiceover for your reels', connected: Boolean(deps.elevenLabsApiKey), detail: null },
    ],
  }));

  api.post('/connectors/elevenlabs/test', async (_req, reply) => {
    if (!deps.elevenLabsApiKey) {
      return reply.code(503).send({ error: 'elevenlabs_not_configured', message: "ElevenLabs isn't set up on the server yet (ELEVENLABS_API_KEY)." });
    }
    return { result: await checkElevenLabs(deps.elevenLabsApiKey, deps.fetchImpl) };
  });
}
