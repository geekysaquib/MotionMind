import { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { ImagePlus, Trash2 } from 'lucide-react';
import { useStores } from '../stores/RootStore';
import { Alert, Button, Card } from './ui';
import { errorText } from '../lib/format';
import { log } from '../lib/logger';
import { MAX_LOGO_FILE_BYTES, prepareLogo } from '../lib/logoImage';

/** The creator's Instagram or YouTube picture: it goes on the end card and the cover of every reel. */
export const ChannelLogo = observer(function ChannelLogo() {
  const { services, auth, toasts } = useStores();
  const api = services.claude(() => auth.session?.accessToken ?? null);
  const [url, setUrl] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.resolve()
      .then(() => api.logo())
      .then((r) => setUrl(r.url))
      .catch(() => undefined)
      .finally(() => setLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function choose(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      if (file.size > MAX_LOGO_FILE_BYTES) throw new Error('That picture is over 8 MB. Choose a smaller one.');
      if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error('Use a PNG, JPEG or WebP picture.');
      const r = await api.uploadLogo(await prepareLogo(file));
      setUrl(r.url);
      log.info('logo', 'Channel logo uploaded', { bytes: file.size });
      toasts.push('success', 'Logo saved. It is on the end card and the cover of your next export.');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await api.removeLogo();
      setUrl(null);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <h2 className="font-semibold">Channel logo</h2>
      <p className="mt-1 text-sm text-ink-400">Your Instagram or YouTube picture. It shows as a round badge on the end card above your handle, and next to the handle on the cover. A square picture works best.</p>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-line/15 bg-line/[0.05]">
          {url ? <img src={url} alt="Your channel logo" className="h-full w-full object-cover" /> : <span className="px-2 text-center text-xs text-ink-400">{loaded ? 'No logo yet' : ''}</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" icon={<ImagePlus className="h-4 w-4" />} loading={busy} onClick={() => input.current?.click()}>
            {url ? 'Replace the logo' : 'Upload your logo'}
          </Button>
          <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" aria-label="Logo file" onChange={(e) => void choose(e.target.files?.[0])} />
          {url && (
            <Button variant="ghost" icon={<Trash2 className="h-4 w-4" />} disabled={busy} onClick={() => void remove()}>
              Remove
            </Button>
          )}
        </div>
      </div>
      {error && (
        <div className="mt-3">
          <Alert>{error}</Alert>
        </div>
      )}
    </Card>
  );
});
