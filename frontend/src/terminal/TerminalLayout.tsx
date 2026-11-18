import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { QrCode } from 'lucide-react';
import { useStores } from '../stores/RootStore';
import { errorText } from '../lib/format';
import { log } from '../lib/logger';
import { TButton, TNote } from './parts';

/** The prompt line at the top of every Terminal screen. */
export function TBrand() {
  return (
    <Link to="/t" className="font-mono text-sm text-ink-300">
      <span className="text-accent">motionmind</span>
      <span className="text-ink-400">:~/terminal$</span>
      <span className="ml-0.5 inline-block h-4 w-2 translate-y-0.5 animate-pulse bg-accent" aria-hidden />
    </Link>
  );
}

/**
 * Motion Mind Terminal: the reel flow on a phone or tablet, one step per screen. Same app, same API, same projects;
 * a simpler frame (no sidebar), the actions at the bottom, room for the notch and the home bar.
 */
export const TerminalLayout = observer(function TerminalLayout() {
  const { auth } = useStores();
  if (!auth.ready) return <div className="flex min-h-[100dvh] items-center justify-center bg-ink-950 font-mono text-sm text-ink-400">connecting…</div>;
  return (
    <div className="min-h-[100dvh] bg-ink-950 text-ink-100" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="mx-auto w-full max-w-xl px-4 pb-10 pt-4 md:max-w-3xl">{auth.isSignedIn ? <Outlet /> : <TerminalWelcome />}</div>
    </div>
  );
});

/** Not signed in on this phone yet: pair it from the PC, or sign in with an email code. */
function TerminalWelcome() {
  return (
    <div className="space-y-6 pt-6">
      <TBrand />
      <div>
        <h1 className="font-display text-3xl font-bold leading-tight">Make reels from your phone</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-400">Pair this phone with Motion Mind on your PC once, then go step by step: copy the prompt, ask Claude, paste the answer. Your PC does the rendering.</p>
      </div>
      <ol className="space-y-3 font-mono text-sm text-ink-300">
        <li>1. On your PC, open Motion Mind → Settings → Open on your phone.</li>
        <li>2. Scan the QR code with this phone's camera.</li>
        <li>3. That's it: this phone is signed in.</li>
      </ol>
      <TNote>Your phone and your PC must be on the same Wi-Fi.</TNote>
      <Link to="/login" className="block text-center text-sm font-semibold text-accent">
        Or sign in with an email code
      </Link>
    </div>
  );
}

/** Opened from the QR code: /t/pair#<code>. Trades the code for a session, then goes to the Terminal's home. */
export const TerminalPair = observer(function TerminalPair() {
  const { auth } = useStores();
  const nav = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const code = typeof window !== 'undefined' ? window.location.hash.replace(/^#/, '') : '';

  useEffect(() => {
    if (!auth.ready) return;
    if (!code) {
      setError('This link has no pairing code. Scan the QR code on your PC again.');
      return;
    }
    let live = true;
    void (async () => {
      try {
        if (auth.isSignedIn) await auth.signOut();
        await auth.pair(code);
        log.info('terminal', 'Phone paired');
        // The code is used up: keep it out of the history.
        if (live) nav('/t', { replace: true });
      } catch (e) {
        if (live) setError(errorText(e));
      }
    })();
    return () => {
      live = false;
    };
  }, [auth.ready]);

  return (
    <div className="min-h-[100dvh] bg-ink-950 px-4 pt-10 text-ink-100">
      <div className="mx-auto max-w-xl space-y-5">
        <TBrand />
        {error ? (
          <>
            <TNote tone="error">{error}</TNote>
            <TButton icon={<QrCode className="h-5 w-5" />} onClick={() => nav('/t', { replace: true })}>
              Back
            </TButton>
          </>
        ) : (
          <p className="font-mono text-sm text-ink-300">pairing this phone…</p>
        )}
      </div>
    </div>
  );
});
