import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, ExternalLink } from 'lucide-react';
import type { SocialAccount, SocialPlatform } from '@motionmind/shared';
import { useStores } from '../../stores/RootStore';
import { Alert, Badge, Button, Card, Spinner } from '../../components/ui';
import { PlatformIcon } from '../../components/BrandIcons';
import { errorText, timeAgo } from '../../lib/format';
import { log } from '../../lib/logger';

const CALLBACK_ERRORS: Record<string, string> = {
  expired: 'The YouTube sign-in took too long or was opened twice. Try again.',
  access_denied: 'You cancelled the Google sign-in.',
  not_set_up: 'YouTube sign-in is not set up yet: add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env and restart Motion Mind.',
  needs_migration: 'Analytics needs a database update first (migration 20261113000000_social_accounts.sql).',
  failed: "Google signed you in, but Motion Mind couldn't read the channel. Check that the YouTube Data API and YouTube Analytics API are on in your Google Cloud project, then try again.",
};

function AccountRow({ account, onDisconnect, busy }: { account: SocialAccount; onDisconnect: () => void; busy: boolean }) {
  const soon = account.expiresAt ? Date.parse(account.expiresAt) - Date.now() < 7 * 86_400_000 : false;
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-line/10 p-3">
      {account.avatarUrl ? <img src={account.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" /> : <PlatformIcon platform={account.platform} className="h-10 w-10" />}
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold">{account.handle}</div>
        <div className="truncate text-xs text-ink-400">
          {account.name ? `${account.name} · ` : ''}connected {timeAgo(account.connectedAt)}
        </div>
      </div>
      {soon ? <Badge tone="amber">Token runs out soon</Badge> : <Badge tone="mint">Connected</Badge>}
      <Button variant="ghost" disabled={busy} onClick={onDisconnect}>
        Disconnect
      </Button>
    </div>
  );
}

/** Settings → Connections: the creator's own Instagram and YouTube accounts, read-only, for the Analytics page. */
export const ConnectionsSettings = observer(function ConnectionsSettings() {
  const { services, auth, toasts } = useStores();
  const api = services.claude(() => auth.session?.accessToken ?? null);
  const [params, setParams] = useSearchParams();
  const [accounts, setAccounts] = useState<SocialAccount[] | null>(null);
  const [youtubeReady, setYoutubeReady] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<SocialPlatform | null>(null);
  const [token, setToken] = useState('');

  useEffect(() => {
    Promise.resolve()
      .then(() => api.socialAccounts())
      .then((r) => {
        setAccounts(r.accounts);
        setYoutubeReady(r.youtubeReady);
      })
      .catch((e) => {
        setAccounts([]);
        setError(errorText(e));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Google sends the browser back here with ?connected=youtube or ?error=...
  useEffect(() => {
    const connected = params.get('connected');
    const err = params.get('error');
    if (!connected && !err) return;
    if (connected) toasts.push('success', 'YouTube channel connected.');
    if (err) setError(CALLBACK_ERRORS[err] ?? `YouTube sign-in failed (${err}).`);
    setParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const byPlatform = (p: SocialPlatform) => accounts?.find((a) => a.platform === p) ?? null;

  async function connectYouTube() {
    setBusy('youtube');
    setError(null);
    try {
      const { url } = await api.youtubeConnectUrl();
      log.info('social', 'Opening Google sign-in for YouTube');
      window.location.assign(url);
    } catch (e) {
      setError(errorText(e));
      setBusy(null);
    }
  }

  async function connectInstagram() {
    setBusy('instagram');
    setError(null);
    try {
      const r = await api.connectInstagram(token.trim());
      setAccounts(r.accounts);
      setToken('');
      toasts.push('success', 'Instagram account connected.');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  async function disconnect(p: SocialPlatform) {
    setBusy(p);
    setError(null);
    try {
      setAccounts((await api.disconnectSocial(p)).accounts);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  if (!accounts) return <Spinner label="Loading your connections" />;
  const yt = byPlatform('youtube');
  const ig = byPlatform('instagram');

  return (
    <div className="space-y-6">
      <p className="text-sm text-ink-400">
        Connect your own accounts to see their numbers on the{' '}
        <Link to="/app/analytics" className="text-accent hover:underline">
          Analytics
        </Link>{' '}
        page. Motion Mind only reads: it never posts, comments or changes anything on your accounts.
      </p>
      {error && <Alert>{error}</Alert>}

      <Card>
        <h2 className="flex items-center gap-2 font-semibold">
          <PlatformIcon platform="youtube" className="h-5 w-5" /> YouTube
        </h2>
        <p className="mt-1 text-sm text-ink-400">Sign in with the Google account that owns your channel. Motion Mind asks only to view your channel and its analytics.</p>
        {yt ? (
          <AccountRow account={yt} busy={busy === 'youtube'} onDisconnect={() => void disconnect('youtube')} />
        ) : youtubeReady ? (
          <Button className="mt-4" loading={busy === 'youtube'} onClick={() => void connectYouTube()}>
            Connect YouTube
          </Button>
        ) : (
          <div className="mt-4">
            <Alert tone="info">YouTube sign-in is not set up on this computer yet. It needs a Google OAuth client in .env (GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET), with http://localhost:8787/api/social/youtube/callback as its redirect URI.</Alert>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="flex items-center gap-2 font-semibold">
          <PlatformIcon platform="instagram" className="h-5 w-5" /> Instagram
        </h2>
        <p className="mt-1 text-sm text-ink-400">Your account must be a Professional account (Creator or Business). Instagram shares insights only with those.</p>
        {ig ? (
          <AccountRow account={ig} busy={busy === 'instagram'} onDisconnect={() => void disconnect('instagram')} />
        ) : (
          <>
            <ol className="mt-4 list-decimal space-y-1.5 pl-5 text-sm text-ink-300">
              <li>
                Open your app on{' '}
                <a href="https://developers.facebook.com/apps/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
                  Meta for Developers <ExternalLink className="h-3 w-3" />
                </a>{' '}
                (one with the "Instagram API with Instagram Login" product).
              </li>
              <li>In "API setup with Instagram login", add your Instagram account and press "Generate token".</li>
              <li>Copy the token and paste it here. Motion Mind keeps it encrypted and refreshes it before its 60 days run out.</li>
            </ol>
            <textarea aria-label="Instagram access token" className="field mt-3 min-h-[84px] font-mono text-xs" placeholder="IGAA..." value={token} onChange={(e) => setToken(e.target.value)} />
            <Button className="mt-3" loading={busy === 'instagram'} disabled={token.trim().length < 20} onClick={() => void connectInstagram()}>
              Connect Instagram
            </Button>
          </>
        )}
      </Card>

      {(yt || ig) && (
        <p className="flex items-center gap-2 text-sm text-ink-400">
          <CheckCircle2 className="h-4 w-4 text-accent" />
          <Link to="/app/analytics" className="text-accent hover:underline">
            See your analytics
          </Link>
        </p>
      )}
    </div>
  );
});
