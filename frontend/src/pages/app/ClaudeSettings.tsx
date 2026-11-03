import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Sparkles } from 'lucide-react';
import { useStores } from '../../stores/RootStore';
import { Alert, Badge, Button, Card, Spinner } from '../../components/ui';
import { errorText } from '../../lib/format';
import { log } from '../../lib/logger';
import type { ClaudeAnswer, ClaudeStatus } from '../../services/claudeHttp';

const TEST_PROMPT = 'In one short sentence, confirm you are connected to Motion Mind and say which Claude model you are.';

/** Settings > Claude: Claude is built in (no keys to set up). Check it's working and try it with your own prompt. */
export const ClaudeSettings = observer(function ClaudeSettings() {
  const { services, auth } = useStores();
  const claude = services.claude(() => auth.session?.accessToken ?? null);
  const [status, setStatus] = useState<ClaudeStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('Give me 3 surprising reel topics about everyday tech in India, one line each.');
  const [answer, setAnswer] = useState<ClaudeAnswer | null>(null);
  const [askError, setAskError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    claude
      .status()
      .then(setStatus)
      .catch((e) => setStatusError(errorText(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function ask(text: string) {
    setBusy(true);
    setAskError(null);
    try {
      const res = await claude.ask(text);
      setAnswer(res);
      log.info('claude', 'Claude answered', { model: res.reply.model, ms: res.ms, outputTokens: res.reply.outputTokens });
    } catch (err) {
      setAnswer(null);
      setAskError(errorText(err));
    } finally {
      setBusy(false);
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
            <p className="mt-1 text-sm text-ink-400">Claude is built into Motion Mind and writes your reel scripts. There's nothing to set up.</p>
          </div>
          {status && (status.connected ? <Badge tone="mint">Ready</Badge> : <Badge tone="coral">Not available</Badge>)}
        </div>
        {statusError && <div className="mt-4"><Alert>{statusError}</Alert></div>}
        {status && !status.connected && (
          <div className="mt-4">
            <Alert tone="info">Claude isn't set up on this server yet. Whoever runs Motion Mind needs to add ANTHROPIC_API_KEY.</Alert>
          </div>
        )}
        {status?.connected && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button variant="secondary" loading={busy} onClick={() => void ask(TEST_PROMPT)}>
              Test Claude
            </Button>
            <span className="text-xs text-ink-400">
              Model: <span className="font-mono">{status.model}</span>
            </span>
          </div>
        )}
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
            <textarea
              aria-label="Prompt"
              className="min-h-[96px] w-full rounded-xl border border-line/15 bg-transparent p-3 text-sm outline-none focus:border-accent"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              maxLength={4000}
            />
            <Button type="submit" loading={busy} disabled={!prompt.trim()}>
              Ask Claude
            </Button>
          </form>
        </Card>
      )}

      {(answer || askError || busy) && (
        <Card>
          <h2 className="font-semibold">Result</h2>
          {busy && <div className="mt-4"><Spinner label="Claude is thinking" /></div>}
          {askError && <div className="mt-4"><Alert>{askError}</Alert></div>}
          {answer && !busy && (
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
