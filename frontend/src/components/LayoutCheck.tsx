import { useCallback, useEffect, useRef, useState } from 'react';
import { ClipboardCopy, ScanSearch } from 'lucide-react';
import type { Project } from '@motionmind/shared';
import { useStores } from '../stores/RootStore';
import { Alert, Badge, Button, Card, Spinner } from './ui';
import { errorText } from '../lib/format';
import { log } from '../lib/logger';
import type { LayoutCheck as Result } from '../services/claudeHttp';

/**
 * After Claude's animation is pasted, opens it in Chrome on this PC and measures every text box over the timeline:
 * text that overlaps other text, hides under a panel or spills out is listed, with a request to paste back into Claude.
 */
export function LayoutCheck({ project }: { project: Project }) {
  const { services, auth, toasts } = useStores();
  const api = services.claude(() => auth.session?.accessToken ?? null);
  const writtenAt = project.script?.animation?.writtenAt;
  const [state, setState] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const checked = useRef<string | null>(null);

  const run = useCallback(async () => {
    setState('running');
    setError(null);
    try {
      const r = await api.checkLayout(project.id);
      setResult(r);
      setState('done');
      log.info('animate', 'Layout checked', { projectId: project.id, issues: r.report.total });
    } catch (e) {
      setError(errorText(e));
      setState('error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  // Each new animation is checked once, automatically.
  useEffect(() => {
    if (!writtenAt || checked.current === writtenAt) return;
    checked.current = writtenAt;
    void run();
  }, [writtenAt, run]);

  if (!writtenAt) return null;

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toasts.push('success', 'Fix request copied. Paste it into the same claude.ai chat.');
    } catch {
      toasts.push('error', "Couldn't copy. Select the text and copy it by hand.");
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold">
          <ScanSearch className="h-4 w-4 text-accent" /> Layout check
        </h3>
        {state === 'done' && result && (result.report.ok ? <Badge tone="mint">Clean</Badge> : <Badge tone="amber">{result.report.total} to fix</Badge>)}
      </div>
      <p className="mt-1 text-sm text-ink-400">Opens the animation in Chrome and looks for text that overlaps other text, hides under a panel or runs out of its box.</p>
      {state === 'running' && (
        <div className="mt-3">
          <Spinner label="Checking the layout, about 20 seconds" />
        </div>
      )}
      {state === 'error' && (
        <div className="mt-3">
          <Alert tone="info">{error}</Alert>
        </div>
      )}
      {state === 'done' && result?.report.ok && (
        <div className="mt-3">
          <Alert tone="success">No overlapping, hidden or cut-off text found at the points I checked across the reel.</Alert>
        </div>
      )}
      {state === 'done' && result && !result.report.ok && result.request && (
        <div className="mt-3 space-y-3">
          <ul className="space-y-1 text-sm">
            {result.report.issues.map((i, k) => (
              <li key={k} className="flex gap-2">
                <span className="w-12 shrink-0 font-mono text-xs text-ink-400">{i.time.toFixed(1)} s</span>
                <span>
                  {i.text ? <span className="font-medium">“{i.text}”: </span> : null}
                  {i.message}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-sm text-ink-400">Copy this request, paste it into the same claude.ai chat, then paste Claude's new answer above.</p>
          <textarea readOnly aria-label="Fix request for Claude" className="field min-h-[140px] font-mono text-xs" value={result.request} />
          <Button variant="secondary" icon={<ClipboardCopy className="h-4 w-4" />} onClick={() => void copy(result.request!)}>
            Copy fix request
          </Button>
        </div>
      )}
      <div className="mt-3">
        <Button variant="ghost" disabled={state === 'running'} onClick={() => void run()}>
          Check again
        </Button>
      </div>
    </Card>
  );
}
