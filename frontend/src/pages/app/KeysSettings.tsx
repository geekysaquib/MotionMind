import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { ExternalLink, ShieldCheck, Trash2, Zap } from 'lucide-react';
import { PROVIDER_INFO, type ProviderId } from '@motionmind/shared';
import { useStores } from '../../stores/RootStore';
import { Alert, Badge, Button, Card, Spinner } from '../../components/ui';
import { errorText, timeAgo } from '../../lib/format';

const CAP_LABEL = { llm: 'Writing', research: 'Research', image: 'Images', voice: 'Voice', video: 'Video' } as const;

const KeyRow = observer(function KeyRow({ id }: { id: ProviderId }) {
  const { keys, toasts } = useStores();
  const info = PROVIDER_INFO[id];
  const row = keys.rows.find((r) => r.id === id)!;
  const [value, setValue] = useState('');
  const [editing, setEditing] = useState(false);

  async function run(fn: () => Promise<unknown>, ok?: string) {
    try {
      await fn();
      if (ok) toasts.push('success', ok);
    } catch (err) {
      toasts.push('error', errorText(err));
    }
  }

  const saved = row.key;
  return (
    <div className="py-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{info.label}</span>
            {info.capabilities.map((c) => (
              <Badge key={c}>{CAP_LABEL[c]}</Badge>
            ))}
          </div>
          <div className="mt-1 text-xs text-ink-400">
            {saved ? (
              <>
                Saved key ••••{saved.last4} · updated {timeAgo(saved.updatedAt)}
                {saved.lastTestOk === true && <span className="text-accent"> · works</span>}
                {saved.lastTestOk === false && <span className="text-danger"> · last test failed</span>}
              </>
            ) : (
              'Not set'
            )}
          </div>
        </div>
        {saved && !editing && (
          <>
            <Button size="sm" variant="secondary" loading={row.busy} icon={<Zap className="h-3.5 w-3.5" />} onClick={() => void run(() => keys.test(id))}>
              Test
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
              Replace
            </Button>
            <Button size="sm" variant="ghost" aria-label={`Remove ${info.label} key`} onClick={() => void run(() => keys.remove(id), `${info.label} key removed.`)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
        {!saved && !editing && (
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
            Add key
          </Button>
        )}
      </div>
      {editing && (
        <form
          className="mt-3 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await keys.save(id, value.trim());
              setValue('');
              setEditing(false);
            }, `${info.label} key saved.`);
          }}
        >
          <input
            type="password"
            autoComplete="off"
            aria-label={`${info.label} API key`}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={info.keyHint}
            className="field min-w-0 flex-1 font-mono"
            autoFocus
          />
          <Button type="submit" loading={row.busy} disabled={value.trim().length < 8}>
            Save
          </Button>
          <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
          <a href={info.docsUrl} target="_blank" rel="noreferrer" className="flex w-full items-center gap-1 text-xs text-ink-400 hover:text-accent">
            Get a {info.label} key <ExternalLink className="h-3 w-3" />
          </a>
        </form>
      )}
      {row.result && <div className="mt-3"><Alert tone={row.result.ok ? 'success' : 'error'}>{row.result.detail}</Alert></div>}
    </div>
  );
});

export const KeysSettings = observer(function KeysSettings() {
  const { keys, services } = useStores();
  useEffect(() => {
    void keys.load();
  }, [keys]);
  return (
    <div className="space-y-4">
      <Alert tone="info">
        <span className="inline-flex items-start gap-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          Keys are sent once to the Motion Mind server, encrypted (AES-256-GCM) and never shown again. This browser only sees the last 4 characters.
          {services.mode === 'memory' && ' Demo mode: the API keeps keys in memory until it restarts.'}
        </span>
      </Alert>
      {keys.error && <Alert>{keys.error}</Alert>}
      <Card className="divide-y divide-line/[0.06] py-1">
        {!keys.loaded ? <div className="py-6"><Spinner /></div> : keys.rows.map((r) => <KeyRow key={r.id} id={r.id} />)}
      </Card>
    </div>
  );
});
