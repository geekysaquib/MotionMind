import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { ClipboardCopy, ExternalLink } from 'lucide-react';
import type { Project } from '@motionmind/shared';
import { useStores } from '../../stores/RootStore';
import { pickedStyle } from '../../lib/pickedStyle';
import { Alert, Button, Card } from '../../components/ui';
import { errorText } from '../../lib/format';
import { log } from '../../lib/logger';

interface ClaudeAiPanelProps {
  title: string;
  /** Extra hint for step 2, e.g. turning on web search. */
  chatHint?: string;
  placeholder: string;
  disabled?: boolean;
  getPrompt: () => Promise<string>;
  onImport: (text: string) => Promise<unknown>;
  logScope: string;
}

/**
 * The no-API-key route: copy a ready-made prompt, run it in claude.ai (for example on a Claude Pro plan),
 * and paste Claude's answer back. Used for both research and the script.
 */
export function ClaudeAiPanel({ title, chatHint, placeholder, disabled, getPrompt, onImport, logScope }: ClaudeAiPanelProps) {
  const [copied, setCopied] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState<'copy' | 'import' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function copyPrompt() {
    setBusy('copy');
    setError(null);
    try {
      await navigator.clipboard.writeText(await getPrompt());
      setCopied(true);
      log.info('claude', `${logScope} prompt copied for claude.ai`);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  async function importText() {
    setBusy('import');
    setError(null);
    try {
      await onImport(text);
      setText('');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-ink-400">No API key needed. Works with your Claude subscription.</p>
      <ol className="mt-4 space-y-4 text-sm">
        <li>
          <div className="font-medium">1. Copy the prompt</div>
          <div className="mt-2">
            <Button variant="secondary" icon={<ClipboardCopy className="h-4 w-4" />} loading={busy === 'copy'} disabled={disabled} onClick={() => void copyPrompt()}>
              {copied ? 'Copied' : 'Copy prompt'}
            </Button>
          </div>
        </li>
        <li>
          <div className="font-medium">2. Paste it into a new chat in claude.ai and send it</div>
          {chatHint && <p className="mt-1 text-ink-400">{chatHint}</p>}
          <a href="https://claude.ai/new" target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-accent hover:underline">
            Open claude.ai <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </li>
        <li>
          <div className="font-medium">3. Copy Claude's whole answer and paste it here</div>
          <textarea
            aria-label="Claude's answer"
            className="mt-2 min-h-[120px] w-full rounded-xl border border-line/15 bg-transparent p-3 font-mono text-xs outline-none focus:border-accent"
            placeholder={placeholder}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <Button className="mt-2" loading={busy === 'import'} disabled={!text.trim()} onClick={() => void importText()}>
            Use this answer
          </Button>
        </li>
      </ol>
      {error && <div className="mt-4"><Alert>{error}</Alert></div>}
    </Card>
  );
}

/** Script stage: write the script in claude.ai instead of with the server's API key. */
export const PasteScriptPanel = observer(function PasteScriptPanel({ project }: { project: Project }) {
  const { projects, services, auth } = useStores();
  const style = pickedStyle(project);
  return (
    <ClaudeAiPanel
      title="Write it in claude.ai"
      placeholder='{ "title": "...", "steps": [...], "beats": [...] }'
      disabled={!project.topic}
      logScope="Script"
      getPrompt={() => services.claude(() => auth.session?.accessToken ?? null).scriptPrompt(project.id, style)}
      onImport={(text) => projects.importScript(project.id, text, style)}
    />
  );
});
