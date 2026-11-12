import type { FastifyInstance } from 'fastify';
import type { AppDeps } from '../app';
import type { AudioStore } from '../voice/audioStore';

// The creator's channel logo (their Instagram or YouTube picture), one per account. It is stored in the same private
// bucket as the recordings, at a fixed path, so no database column is needed. The end card and the cover put it on the
// reel: the picture is embedded in the page as a small data URL, so the preview, the export and the cover all have it.

export const LOGO_MAX_BYTES = 700_000;
export const logoPath = (userId: string) => `${userId}/profile/logo`;

/** PNG, JPEG or WebP, recognised from the first bytes (not from what the browser claims). SVG is refused on purpose. */
export function sniffImage(b: Buffer): { mime: string } | null {
  if (b.length < 12) return null;
  if (b[0] === 0x89 && b.subarray(1, 4).toString('latin1') === 'PNG') return { mime: 'image/png' };
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: 'image/jpeg' };
  if (b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP') return { mime: 'image/webp' };
  return null;
}

/** The logo as a data URL to put into a page, or undefined when the account has none. */
export async function logoDataUrl(audio: AudioStore, userId: string): Promise<string | undefined> {
  const file = await audio.get(logoPath(userId)).catch(() => null);
  if (!file || !sniffImage(file.data)) return undefined;
  return `data:${file.contentType};base64,${file.data.toString('base64')}`;
}

/** Signed-in only: upload, show and remove the channel logo. */
export function registerLogoRoutes(api: FastifyInstance, deps: AppDeps) {
  if (!api.hasContentTypeParser('application/octet-stream')) {
    api.addContentTypeParser('application/octet-stream', { parseAs: 'buffer', bodyLimit: LOGO_MAX_BYTES }, (_req, body, done) => done(null, body));
  }

  const urlOf = async (userId: string) => {
    const [url] = await deps.audio.urls([logoPath(userId)]);
    return url || null;
  };

  api.get('/profile/logo', async (req) => ({ url: (await logoDataUrl(deps.audio, req.userId)) ? await urlOf(req.userId) : null }));

  api.post('/profile/logo', { bodyLimit: LOGO_MAX_BYTES }, async (req, reply) => {
    const body = req.body;
    if (!Buffer.isBuffer(body) || body.length === 0) return reply.code(400).send({ error: 'no_logo', message: 'Choose a picture to upload.' });
    const image = sniffImage(body);
    if (!image) return reply.code(400).send({ error: 'not_image', message: "That file doesn't look like a PNG, JPEG or WebP picture." });
    await deps.audio.put(logoPath(req.userId), body, image.mime);
    req.log.info({ bytes: body.length, mime: image.mime }, 'logo uploaded');
    return { url: await urlOf(req.userId) };
  });

  api.delete('/profile/logo', async (req) => {
    await deps.audio.remove([logoPath(req.userId)]).catch((err) => req.log.warn({ err }, 'could not delete the logo'));
    return { ok: true };
  });
}
