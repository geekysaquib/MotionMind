import { createHmac, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { ANALYTICS_RANGES, isoDay, SOCIAL_PLATFORMS, type AnalyticsRange, type AnalyticsSummary } from '@motionmind/shared';
import type { AppDeps } from '../app';
import { firstIssue } from '../http';
import { followersFromDeltas, type InstagramClient } from './instagram';
import { NeedsMigrationError, type StoredAccount } from './store';
import { SocialApiError, type YouTubeClient } from './youtube';

/** The two platform clients. A missing YouTube client means Google sign-in is not set up in .env. */
export interface SocialDeps {
  youtube?: YouTubeClient;
  instagram: InstagramClient;
  /** Where Google sends the browser back to (must match the OAuth client's redirect URI). */
  redirectBase: string;
}

const needsMigration = { error: 'needs_migration', message: 'Analytics needs a database update first (migration 20261113000000_social_accounts.sql). Ask for it to be applied.' };
const CACHE_MS = 15 * 60 * 1000;
const STATE_MS = 10 * 60 * 1000;

/** A signed, short-lived "state" for the Google sign-in, so the callback knows which user it is for. */
export function signState(secret: string, userId: string, now = Date.now()): string {
  const body = Buffer.from(JSON.stringify({ u: userId, e: now + STATE_MS })).toString('base64url');
  const sig = createHmac('sha256', Buffer.from(secret, 'base64')).update(`social-state:${body}`).digest('base64url');
  return `${body}.${sig}`;
}

export function readState(secret: string, state: string, now = Date.now()): string | null {
  const [body, sig] = state.split('.');
  if (!body || !sig) return null;
  const want = createHmac('sha256', Buffer.from(secret, 'base64')).update(`social-state:${body}`).digest();
  const got = Buffer.from(sig, 'base64url');
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as { u: string; e: number };
    return p.e > now && typeof p.u === 'string' ? p.u : null;
  } catch {
    return null;
  }
}

function sendError(err: unknown, reply: FastifyReply) {
  if (err instanceof NeedsMigrationError) return reply.code(503).send(needsMigration);
  if (err instanceof SocialApiError) return reply.code(err.reconnect ? 401 : err.status).send({ error: err.reconnect ? 'reconnect' : 'platform_error', message: err.reconnect ? `${err.message} Connect the account again in Settings.` : err.message });
  throw err;
}

/** Public: Google sends the browser back here after sign-in. */
export function registerSocialCallback(app: FastifyInstance, deps: AppDeps) {
  app.get('/api/social/youtube/callback', async (req, reply) => {
    const q = req.query as { code?: string; state?: string; error?: string };
    const back = (params: string) => reply.redirect(`${deps.webOrigin}/app/settings/connections?${params}`);
    const yt = deps.social?.youtube;
    if (!yt || !deps.socialStore) return back('error=not_set_up');
    if (q.error) return back(`error=${encodeURIComponent(q.error)}`);
    const userId = q.state ? readState(deps.authSecret, q.state) : null;
    if (!userId || !q.code) return back('error=expired');
    try {
      const tokens = await yt.exchange(q.code, `${deps.social!.redirectBase}/api/social/youtube/callback`);
      const channel = await yt.channel(tokens.accessToken);
      if (!tokens.refreshToken) req.log.warn('Google gave no refresh token; the user will need to connect again in an hour');
      await deps.socialStore.save(userId, {
        platform: 'youtube',
        accountId: channel.id,
        handle: channel.handle,
        name: channel.title,
        avatarUrl: channel.avatarUrl,
        connectedAt: new Date().toISOString(),
        expiresAt: null,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiresAt: tokens.expiresAt,
      });
      req.log.info({ channel: channel.id }, 'youtube connected');
      return back('connected=youtube');
    } catch (err) {
      req.log.warn({ err }, 'youtube connect failed');
      return back(err instanceof NeedsMigrationError ? 'error=needs_migration' : 'error=failed');
    }
  });
}

/** Signed in: connected accounts and their analytics. */
export function registerSocialRoutes(api: FastifyInstance, deps: AppDeps) {
  const cache = new Map<string, { at: number; summary: AnalyticsSummary }>();
  const store = () => deps.socialStore!;

  api.get('/social/accounts', async (req, reply) => {
    try {
      return { accounts: await store().list(req.userId), youtubeReady: Boolean(deps.social?.youtube) };
    } catch (err) {
      return sendError(err, reply);
    }
  });

  api.get('/social/youtube/connect', async (req, reply) => {
    const yt = deps.social?.youtube;
    if (!yt) return reply.code(501).send({ error: 'not_set_up', message: 'YouTube sign-in is not set up yet: add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env and restart Motion Mind.' });
    return { url: yt.authUrl(signState(deps.authSecret, req.userId), `${deps.social!.redirectBase}/api/social/youtube/callback`) };
  });

  api.post('/social/instagram', async (req, reply) => {
    const body = z.object({ token: z.string().trim().min(20, 'Paste the whole access token.').max(2000) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_token', message: firstIssue(body.error) });
    const ig = deps.social!.instagram;
    try {
      const profile = await ig.profile(body.data.token);
      if (profile.accountType && !/BUSINESS|MEDIA_CREATOR|CREATOR/i.test(profile.accountType)) {
        return reply.code(400).send({ error: 'not_professional', message: 'This Instagram account is a personal account. Switch it to a Creator or Business account in the Instagram app, then connect again.' });
      }
      const now = new Date();
      await store().save(req.userId, {
        platform: 'instagram',
        accountId: profile.id,
        handle: `@${profile.username}`,
        name: profile.name,
        avatarUrl: profile.avatarUrl,
        connectedAt: now.toISOString(),
        // Tokens from the dashboard last 60 days; the exact date is learned on the first refresh.
        expiresAt: new Date(now.getTime() + 59 * 86_400_000).toISOString(),
        accessToken: body.data.token,
        refreshToken: null,
        tokenExpiresAt: null,
      });
      cache.forEach((_, k) => k.startsWith(`${req.userId}:instagram`) && cache.delete(k));
      return { accounts: await store().list(req.userId) };
    } catch (err) {
      if (err instanceof SocialApiError) return reply.code(400).send({ error: 'invalid_token', message: `That token did not work: ${err.message.replace(/^Instagram profile failed: /, '')}` });
      return sendError(err, reply);
    }
  });

  api.delete('/social/:platform', async (req, reply) => {
    const p = z.enum(SOCIAL_PLATFORMS).safeParse((req.params as { platform: string }).platform);
    if (!p.success) return reply.code(404).send({ error: 'not_found', message: 'Unknown platform.' });
    try {
      await store().remove(req.userId, p.data);
      cache.forEach((_, k) => k.startsWith(`${req.userId}:${p.data}`) && cache.delete(k));
      return { accounts: await store().list(req.userId) };
    } catch (err) {
      return sendError(err, reply);
    }
  });

  /** A working access token, refreshed and saved when it is about to run out. */
  async function freshToken(userId: string, a: StoredAccount): Promise<string> {
    const now = Date.now();
    if (a.platform === 'youtube') {
      if (a.tokenExpiresAt && Date.parse(a.tokenExpiresAt) - now > 120_000) return a.accessToken;
      if (!a.refreshToken) throw new SocialApiError('The YouTube sign-in ran out.', 401, true);
      const t = await deps.social!.youtube!.refresh(a.refreshToken);
      await store().save(userId, { ...a, accessToken: t.accessToken, refreshToken: t.refreshToken ?? a.refreshToken, tokenExpiresAt: t.expiresAt });
      return t.accessToken;
    }
    // Instagram: refresh when less than 30 days are left (the token must be at least a day old to refresh).
    const left = a.expiresAt ? Date.parse(a.expiresAt) - now : Infinity;
    const age = now - Date.parse(a.connectedAt);
    if (left < 30 * 86_400_000 && age > 86_400_000) {
      try {
        const t = await deps.social!.instagram.refresh(a.accessToken);
        await store().save(userId, { ...a, accessToken: t.token, expiresAt: t.expiresAt, connectedAt: a.connectedAt });
        return t.token;
      } catch (err) {
        if (left <= 0) throw err;
      }
    }
    return a.accessToken;
  }

  api.get('/social/analytics/:platform', async (req, reply) => {
    const p = z.enum(SOCIAL_PLATFORMS).safeParse((req.params as { platform: string }).platform);
    if (!p.success) return reply.code(404).send({ error: 'not_found', message: 'Unknown platform.' });
    const q = req.query as { range?: string; fresh?: string };
    const range = (ANALYTICS_RANGES as readonly number[]).includes(Number(q.range)) ? (Number(q.range) as AnalyticsRange) : 28;
    const key = `${req.userId}:${p.data}:${range}`;
    const hit = cache.get(key);
    if (hit && !q.fresh && Date.now() - hit.at < CACHE_MS) return { summary: hit.summary, cached: true };
    try {
      const account = await store().get(req.userId, p.data);
      if (!account) return reply.code(404).send({ error: 'not_connected', message: `Connect your ${p.data === 'youtube' ? 'YouTube channel' : 'Instagram account'} in Settings first.` });
      if (p.data === 'youtube' && !deps.social?.youtube) return reply.code(501).send({ error: 'not_set_up', message: 'YouTube sign-in is not set up: add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env.' });
      const token = await freshToken(req.userId, account);
      const today = isoDay(new Date());
      const since = isoDay(new Date(Date.now() - (range + 1) * 86_400_000));
      let summary: AnalyticsSummary;
      if (p.data === 'youtube') {
        const yt = deps.social!.youtube!;
        const channel = await yt.channel(token);
        const s = await yt.summary(token, channel, range);
        if (channel.subscribers !== null) await store().snapshot(req.userId, 'youtube', today, channel.subscribers);
        summary = { ...s, followerHistory: await store().snapshots(req.userId, 'youtube', since) };
      } else {
        const ig = deps.social!.instagram;
        const profile = await ig.profile(token);
        const { followerDeltas, ...s } = await ig.summary(token, profile, range);
        if (profile.followers !== null) await store().snapshot(req.userId, 'instagram', today, profile.followers);
        // Our own daily snapshots win; Instagram's daily changes fill the days before we started keeping them.
        const ours = await store().snapshots(req.userId, 'instagram', since);
        const rebuilt = profile.followers !== null ? followersFromDeltas(profile.followers, followerDeltas, today) : [];
        const byDay = new Map(rebuilt.filter((d) => d.date >= since).map((d) => [d.date, d.followers]));
        ours.forEach((d) => byDay.set(d.date, d.followers));
        summary = { ...s, followerHistory: [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, followers]) => ({ date, followers })) };
      }
      cache.set(key, { at: Date.now(), summary });
      return { summary, cached: false };
    } catch (err) {
      req.log.warn({ err, platform: p.data }, 'analytics failed');
      return sendError(err, reply);
    }
  });
}
