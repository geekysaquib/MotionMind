import { useEffect, useState, type FormEvent } from 'react';
import { observer } from 'mobx-react-lite';
import { Sparkles } from 'lucide-react';
import { useStores } from '../../stores/RootStore';
import { Alert, Badge, Button, Card, Field, Spinner } from '../../components/ui';
import { errorText } from '../../lib/format';
import { log } from '../../lib/logger';
import type { ClaudeAnswer, ClaudeStatus } from '../../services/claudeHttp';

const TEST_PROMPT = 'In one short sentence, confirm you are connected to Motion Mind and say which Claude model you are.';

/** Settings > Claude: connect an Anthropic key, check it works, and try Claude with your own prompt. */
export const ClaudeSettings = observer(function ClaudeSettings() {
  const { services, auth, keys, toasts } = useStores();
  const claude = services.claude(() => auth.session?.accessToken ?? null);
  const [status, setStatus] = useState<ClaudeStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState('');
  const [prompt, setPrompt] = useState('Give me 3 surprising reel topics about everyday tech in India, one line each.');
  const [answer, setAnswer] = useState<ClaudeAnswer | null>(null);
  const [askError, setAskError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'save' | 'ask' | null>(null);

  async function refresh() {
    try {
      setStatus(await claude.status());
      setStatusError(null);
    } catch (e) {
      setStatusError(errorText(e));
    }
  }
  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function connect(e: FormEvent) {
    e.preventDefault();
    setBusy('save');
    try {
      await keys.save('anthropic', keyInput.trim());
      setKeyInput('');
      log.info('claude', 'Anthropic key saved');
      await refresh();
      await ask(TEST_PROMPT);
    } catch (err) {
      toasts.push('error', errorText(err));
    } finally {
      setBusy(null);
    }
  }

  async function ask(text: string) {
    setBusy('ask');
    setAskError(null);
    try {
      const res = await claude.ask(text);
      setAnswer(res);
      void refresh();
      log.info('claude', 'Claude answered', { model: res.reply.model, ms: res.ms, outputTokens: res.reply.outputTokens });
    } catch (err) {
      setAnswer(null);
      setAskError(errorText(err));
      void refresh();
    } finally {
      setBusy(null);
    }
  }

  if (!status && !statusError) return <Spinner label="Checking Claude" />;

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-semibold">
              <Sparkles className="h-4 w-4 text-accent" /> Claude
            </h2>
            <p className="mt-1 text-sm text-ink-400">Claude writes your reel scripts. It runs on the Motion Mind server with your own Anthropic API key.</p>
          </div>
          {status &&
            (!status.connected ? (
              <Badge>Not connected</Badge>
            ) : status.working === false ? (
              <Badge tone="coral">Key not working · ends {status.last4}</Badge>
            ) : status.working ? (
              <Badge tone="mint">Connected · key ends {status.last4}</Badge>
            ) : (
              <Badge>Key saved · ends {status.last4}</Badge>
            ))}
        </div>
        {statusError && <div className="mt-4"><Alert>{statusError}</Alert></div>}
        {status && <p className="mt-3 text-xs text-ink-400">Model: <span className="font-mono">{status.model}</span></p>}

        <form onSubmit={connect} className="mt-5 flex flex-wrap items-start gap-3">
          <Field
            className="min-w-[260px] flex-1"
            label={status?.connected ? 'Replace Anthropic API key' : 'Anthropic API key'}
            type="password"
            autoComplete="off"
            placeholder="sk-ant-..."
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            hint={
              <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" className="text-accent hover:underline">
                Get a key
              </a>
            }
          />
          <Button type="submit" className="mt-6" loading={busy === 'save'} disabled={keyInput.trim().length < 8}>
            {status?.connected ? 'Replace' : 'Connect'}
          </Button>
          {status?.connected && (
            <Button type="button" variant="secondary" className="mt-6" loading={busy === 'ask' && !prompt} onClick={() => void ask(TEST_PROMPT)}>
              Test connection
            </Button>
          )}
        </form>
      </Card>

      {status?.connected && (
        <Card>
          <h2 className="font-semibold">Ask Claude</h2>
          <p className="mt-1 text-sm text-ink-400">Try it here. The answer shows below, with how long it took.</p>
          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void ask(prompt);
            }}
          >
            <label className="block">
              <span className="sr-only">Prompt</span>
              <textarea
                aria-label="Prompt"
                className="min-h-[96px] w-full rounded-xl border border-line/15 bg-transparent p-3 text-sm outline-none focus:border-accent"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                maxLength={4000}
              />
            </label>
            <Button type="submit" loading={busy === 'ask'} disabled={!prompt.trim()}>
              Ask Claude
            </Button>
          </form>
        </Card>
      )}

      {(answer || askError || busy === 'ask') && (
        <Card>
          <h2 className="font-semibold">Result</h2>
          {busy === 'ask' && <div className="mt-4"><Spinner label="Claude is thinking" /></div>}
          {askError && <div className="mt-4"><Alert>{askError}</Alert></div>}
          {answer && busy !== 'ask' && (
            <>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed" data-testid="claude-answer">
                {answer.reply.text}
              </p>
              <p className="mt-4 text-xs text-ink-400">
                {answer.reply.model} · {(answer.ms / 1000).toFixed(1)}s · {answer.reply.inputTokens} in / {answer.reply.outputTokens} out tokens
              </p>
            </>
          )}
        </Card>
      )}
    </div>
  );
});
