import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { ClipboardCopy, ExternalLink } from 'lucide-react';
import type { Project } from '@motionmind/shared';
import { useStores } from '../../stores/RootStore';
import { Alert, Button, Card } from '../../components/ui';
import { errorText } from '../../lib/format';
import { log } from '../../lib/logger';

/**
 * Option 2 for the script: no API key needed. Copy a ready-made prompt, run it in claude.ai
 * (for example on a Claude Pro plan), and paste Claude's answer back here.
 */
export const PasteScriptPanel = observer(function PasteScriptPanel({ project, onDone }: { project: Project; onDone?: () => void }) {
  const { projects, services, auth } = useStores();
  const [copied, setCopied] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState<'copy' | 'import' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function copyPrompt() {
    setBusy('copy');
    setError(null);
    try {
      const prompt = await services.claude(() => auth.session?.accessToken ?? null).scriptPrompt(project.id);
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      log.info('claude', 'Script prompt copied for claude.ai', { projectId: project.id });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  async function importScript() {
    setBusy('import');
    setError(null);
    try {
      await projects.importScript(project.id, text);
      setText('');
      onDone?.();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <h2 className="font-semibold">Or write it in claude.ai</h2>
      <p className="mt-1 text-sm text-ink-400">No API key needed. Works with your Claude subscription.</p>
      <ol className="mt-4 space-y-4 text-sm">
        <li>
          <div className="font-medium">1. Copy the prompt</div>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Button variant="secondary" icon={<ClipboardCopy className="h-4 w-4" />} loading={busy === 'copy'} disabled={!project.topic} onClick={() => void copyPrompt()}>
              {copied ? 'Copied' : 'Copy prompt'}
            </Button>
          </div>
        </li>
        <li>
          <div className="font-medium">2. Paste it into a new chat in claude.ai and send it</div>
          <a href="https://claude.ai/new" target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-accent hover:underline">
            Open claude.ai <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </li>
        <li>
          <div className="font-medium">3. Copy Claude's whole answer and paste it here</div>
          <textarea
            aria-label="Claude's answer"
            className="mt-2 min-h-[120px] w-full rounded-xl border border-line/15 bg-transparent p-3 font-mono text-xs outline-none focus:border-accent"
            placeholder='{ "title": "...", "steps": [...], "beats": [...] }'
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <Button className="mt-2" loading={busy === 'import'} disabled={!text.trim()} onClick={() => void importScript()}>
            Use this script
          </Button>
        </li>
      </ol>
      {error && <div className="mt-4"><Alert>{error}</Alert></div>}
    </Card>
  );
});
