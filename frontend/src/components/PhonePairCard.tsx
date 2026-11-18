import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { QrCode, RefreshCw, Smartphone } from 'lucide-react';
import { useStores } from '../stores/RootStore';
import { Alert, Button, Card } from './ui';
import { errorText } from '../lib/format';
import { log } from '../lib/logger';

/** Settings: a QR code that opens Motion Mind Terminal on a phone on this Wi-Fi and signs it in, once. */
export const PhonePairCard = observer(function PhonePairCard() {
  const { services, auth } = useStores();
  const [pair, setPair] = useState<{ urls: string[]; qr: string | null; expiresAt: string } | null>(null);
  const [left, setLeft] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function make() {
    setBusy(true);
    setError(null);
    try {
      const port = Number(window.location.port) || undefined;
      const r = await services.claude(() => auth.session?.accessToken ?? null).pairCode(port);
      setPair(r);
      log.info('terminal', 'Pairing QR code made', { addresses: r.urls.length });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  // The code lives 5 minutes: count it down, then ask for a new one.
  useEffect(() => {
    if (!pair) return;
    const tick = () => setLeft(Math.max(0, Math.round((Date.parse(pair.expiresAt) - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [pair]);

  const expired = pair !== null && left === 0;
  return (
    <Card>
      <h2 className="flex items-center gap-2 font-semibold">
        <Smartphone className="h-4 w-4 text-accent" /> Open on your phone
      </h2>
      <p className="mt-1 text-sm text-ink-400">Motion Mind Terminal: make reels step by step on your phone or tablet, with copy and paste into the Claude app. Your PC keeps doing the rendering. The phone must be on the same Wi-Fi as this PC.</p>
      {!pair || expired ? (
        <div className="mt-4">
          <Button icon={<QrCode className="h-4 w-4" />} loading={busy} onClick={() => void make()}>
            {expired ? 'Make a new QR code' : 'Show the QR code'}
          </Button>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-start gap-5">
          {pair.qr ? (
            <div className="h-48 w-48 shrink-0 rounded-xl bg-white p-2 [&>svg]:h-full [&>svg]:w-full" role="img" aria-label="QR code to open Motion Mind Terminal" dangerouslySetInnerHTML={{ __html: pair.qr }} />
          ) : (
            <Alert>This PC is not on a network the phone can reach. Connect it to Wi-Fi and try again.</Alert>
          )}
          <div className="min-w-0 flex-1 space-y-2 text-sm">
            <p>Scan it with your phone's camera. It signs the phone in once; the code works for {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')} more.</p>
            {pair.urls.length > 1 && <p className="text-ink-400">If the phone cannot open it, try one of these addresses (with the code): {pair.urls.slice(1).map((u) => u.split('/t/')[0]).join(', ')}</p>}
            <p className="text-ink-400">The first time, Windows may ask whether Node.js may use the network: allow it on private networks.</p>
            <Button variant="secondary" icon={<RefreshCw className="h-4 w-4" />} onClick={() => void make()}>
              New code
            </Button>
          </div>
        </div>
      )}
      {error && <div className="mt-3"><Alert>{error}</Alert></div>}
    </Card>
  );
});
