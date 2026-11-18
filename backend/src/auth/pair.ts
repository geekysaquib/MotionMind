import { randomBytes } from 'node:crypto';
import { networkInterfaces } from 'node:os';
import type { FastifyInstance } from 'fastify';
import QRCode from 'qrcode';
import { z } from 'zod';
import type { AppDeps } from '../app';
import { firstIssue } from '../http';

// Pairing a phone or tablet with this PC for Motion Mind Terminal (Saquib, 2026-11-18): the signed-in PC shows a QR
// code holding the Terminal's address on the Wi-Fi and a one-time code; the phone trades the code for its own session,
// so nobody types an address or waits for an email code on the phone.

export const PAIR_TTL_MS = 5 * 60_000;

interface Pending {
  userId: string;
  email: string;
  expires: number;
}

/** One-time pairing codes, kept in memory: they live 5 minutes and the API runs on one PC. */
export class PairCodes {
  private codes = new Map<string, Pending>();

  issue(userId: string, email: string, now = Date.now()): { code: string; expiresAt: string } {
    this.sweep(now);
    const code = randomBytes(18).toString('base64url');
    this.codes.set(code, { userId, email, expires: now + PAIR_TTL_MS });
    return { code, expiresAt: new Date(now + PAIR_TTL_MS).toISOString() };
  }

  /** The code's account, once: a used or expired code gives null. */
  take(code: string, now = Date.now()): Pending | null {
    const p = this.codes.get(code);
    this.codes.delete(code);
    return p && p.expires > now ? p : null;
  }

  private sweep(now: number) {
    for (const [k, v] of this.codes) if (v.expires <= now) this.codes.delete(k);
  }
}

/** This PC's addresses on the local network (IPv4, not loopback), most likely Wi-Fi or Ethernet first. */
export function lanAddresses(): string[] {
  const out: string[] = [];
  for (const [name, list] of Object.entries(networkInterfaces())) {
    for (const a of list ?? []) {
      if (a.family !== 'IPv4' || a.internal) continue;
      // Virtual adapters (WSL, Hyper-V, VirtualBox, Docker) are rarely what the phone can reach: list them last.
      const virtual = /vethernet|virtual|vmware|vbox|docker|wsl|hyper-v/i.test(name);
      if (virtual) out.push(a.address);
      else out.unshift(a.address);
    }
  }
  return [...new Set(out)];
}

/** The email claim of an already verified session token (the pairing code carries it to the phone's session). */
function emailOf(authorization: string | undefined): string {
  try {
    const body = (authorization ?? '').replace(/^Bearer /, '').split('.')[1] ?? '';
    const email = (JSON.parse(Buffer.from(body, 'base64url').toString()) as { email?: unknown }).email;
    return typeof email === 'string' ? email : '';
  } catch {
    return '';
  }
}

const pairCodeBody = z.object({ webPort: z.number().int().min(1).max(65535).optional() }).strict();

/** Signed in (the PC): a fresh pairing code, the Terminal's address on each network, and a QR code of the first. */
export function registerPairCodeRoute(api: FastifyInstance, codes: PairCodes, lan: () => string[] = lanAddresses) {
  api.post('/auth/pair-code', async (req, reply) => {
    const body = pairCodeBody.safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: 'invalid_request', message: firstIssue(body.error) });
    const { code, expiresAt } = codes.issue(req.userId, emailOf(req.headers.authorization));
    const port = body.data.webPort ?? 5173;
    const urls = lan().map((ip) => `http://${ip}:${port}/t/pair#${code}`);
    const qr = urls[0] ? await QRCode.toString(urls[0], { type: 'svg', margin: 1, errorCorrectionLevel: 'M' }) : null;
    return { code, expiresAt, urls, qr };
  });
}

const pairBody = z.object({ code: z.string().trim().min(10, 'Scan the QR code on your PC again.').max(100) }).strict();

/** Public (the phone): trades a pairing code for a session of the account that made it. */
export function registerPairRoute(app: FastifyInstance, deps: Pick<AppDeps, 'sessions'>, codes: PairCodes) {
  app.post('/pair', async (req, reply) => {
    const body = pairBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_code', message: firstIssue(body.error) });
    const p = codes.take(body.data.code);
    if (!p) return reply.code(400).send({ error: 'pair_expired', message: 'This pairing code has expired or was already used. Make a new QR code on your PC (Settings, Open on your phone).' });
    req.log.info({ userId: p.userId }, 'device paired');
    return { token: deps.sessions.issue(p.userId, p.email), user: { id: p.userId, email: p.email } };
  });
}
