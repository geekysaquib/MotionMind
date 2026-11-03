import { useEffect, useState, useSyncExternalStore } from 'react';
import { log, type LogLevel } from '../../lib/logger';
import { Button, Card } from '../../components/ui';
import { cn } from '../../lib/cn';

const LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error'];
const TONE: Record<LogLevel, string> = { debug: 'text-ink-400', info: 'text-ink-100', warn: 'text-amber-500', error: 'text-danger' };

/** Settings > Diagnostics: the recent UI log, to understand what happened when something went wrong. */
export function DiagnosticsSettings() {
  const version = useSyncExternalStore(
    (cb) => log.subscribe(cb),
    () => log.all().length + (log.all().at(-1)?.t ?? ''),
  );
  const [min, setMin] = useState<LogLevel>('info');
  const [debug, setDebug] = useState(log.debugEnabled);
  const [copied, setCopied] = useState(false);
  const entries = log.all(min).slice().reverse();

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  function download() {
    const blob = new Blob([JSON.stringify(log.all(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `motionmind-log-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">App log</h2>
          <p className="mt-1 text-sm text-ink-400">What the app did recently, newest first. Tokens, keys and codes are never recorded. Errors are also sent to the server log.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={async () => {
              await navigator.clipboard.writeText(log.toText());
              setCopied(true);
            }}
          >
            {copied ? 'Copied' : 'Copy'}
          </Button>
          <Button variant="secondary" onClick={download}>
            Download
          </Button>
          <Button variant="secondary" onClick={() => log.clear()}>
            Clear
          </Button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
        <div className="inline-flex rounded-xl border border-line/15 p-1" role="group" aria-label="Minimum level">
          {LEVELS.map((l) => (
            <button key={l} aria-pressed={min === l} onClick={() => setMin(l)} className={cn('rounded-lg px-3 py-1 capitalize', min === l ? 'bg-line/[0.08] text-ink-100' : 'text-ink-400 hover:text-ink-100')}>
              {l}
            </button>
          ))}
        </div>
        <label className="inline-flex items-center gap-2 text-ink-400">
          <input
            type="checkbox"
            checked={debug}
            onChange={(e) => {
              log.setDebug(e.target.checked);
              setDebug(e.target.checked);
            }}
          />
          Record debug details (every API call)
        </label>
      </div>

      <div className="mt-4 max-h-[28rem] overflow-auto rounded-xl bg-ink-900 p-3 font-mono text-xs" data-version={version}>
        {entries.length === 0 ? (
          <p className="text-ink-400">Nothing logged yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {entries.map((e, i) => (
              <li key={`${e.t}-${i}`} className={TONE[e.level]}>
                <span className="text-ink-400">{new Date(e.t).toLocaleTimeString()}</span> <span className="uppercase">{e.level}</span> [{e.scope}] {e.msg}
                {e.data && <span className="block whitespace-pre-wrap break-all pl-4 text-ink-400">{JSON.stringify(e.data)}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
