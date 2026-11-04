import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { AudioLines, ClipboardCopy, KeyRound, Sparkles } from 'lucide-react';
import { useStores } from '../../stores/RootStore';
import { Alert, Badge, Button, Card, Spinner } from '../../components/ui';
import { errorText } from '../../lib/format';
import { log } from '../../lib/logger';
import { cn } from '../../lib/cn';
import type { AiMode } from '../../stores/AiModeStore';
import type { ClaudeAnswer, Connector, ElevenLabsCheck } from '../../services/claudeHttp';

const TEST_PROMPT = 'In one short sentence, confirm you are connected to Motion Mind and say which Claude model you are.';
const ICONS = { claude: Sparkles, elevenlabs: AudioLines } as const;

/**
 * Settings > Connectors: the two services Motion Mind uses, Claude and ElevenLabs.
 * Both run on the server's own keys, so there is nothing for the user to set up; this page shows
 * whether each is ready and lets you test them.
 */
export const ConnectorsSettings = observer(function ConnectorsSettings() {
  const { services, auth, aiMode } = useStores();
  const api = services.claude(() => auth.session?.accessToken ?? null);
  const [list, setList] = useState<Connector[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  useEffect(() => {
    if (aiMode.paste) return;
    api
      .connectors()
      .then(setList)
      .catch((e) => setListError(errorText(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiMode.mode]);

  const claude = list?.find((c) => c.id === 'claude');
  const eleven = list?.find((c) => c.id === 'elevenlabs');

  return (
    <div className="space-y-6">
      <ModePicker />
      {aiMode.paste ? (
        <Card>
          <h2 className="font-semibold">Copy and paste is on</h2>
          <p className="mt-2 text-sm text-ink-400">
            Research and the script show a ready-made prompt. Copy it, run it in claude.ai, and paste the answer back. Nothing here needs a key.
            For the voice, upload your own recording on the Voice tab.
          </p>
        </Card>
      ) : listError ? (
        <Alert>{listError}</Alert>
      ) : !list ? (
        <Spinner label="Checking connectors" />
      ) : (
        <>
          <p className="text-sm text-ink-400">Motion Mind connects to these for you. There are no keys to add.</p>
          {claude && <ClaudeCard connector={claude} ask={api.ask} />}
          {eleven && <ElevenLabsCard connector={eleven} test={api.testElevenLabs} />}
        </>
      )}
    </div>
  );
});

const MODES: { id: AiMode; title: string; text: string; icon: typeof ClipboardCopy }[] = [
  { id: 'paste', title: 'Copy and paste', text: 'No key needed. Copy a prompt into claude.ai (your own subscription), then paste the answer back. You upload your own voiceover.', icon: ClipboardCopy },
  { id: 'keys', title: 'API keys', text: "One click does the research, the script and the voice, using this server's Claude and ElevenLabs keys.", icon: KeyRound },
];

/** Picks how AI work is done. Every stage shows only the chosen way. */
const ModePicker = observer(function ModePicker() {
  const { aiMode } = useStores();
  return (
    <fieldset>
      <legend className="text-sm font-semibold">How do you want to work with AI?</legend>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {MODES.map((m) => {
          const on = aiMode.mode === m.id;
          return (
            <label key={m.id} className={cn('cursor-pointer rounded-2xl border p-4 transition-colors', on ? 'border-accent bg-accent/5' : 'border-line/15 hover:border-line/30')}>
              <input
                type="radio"
                name="ai-mode"
                className="sr-only"
                checked={on}
                onChange={() => {
                  aiMode.set(m.id);
                  log.info('settings', `AI mode: ${m.id}`);
                }}
              />
              <span className="flex items-center gap-2 font-semibold">
                <m.icon className="h-4 w-4 text-accent" /> {m.title}
                {on && <Badge tone="mint">On</Badge>}
              </span>
              <span className="mt-1 block text-sm text-ink-400">{m.text}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
});

function Header({ connector }: { connector: Connector }) {
  const Icon = ICONS[connector.id];
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="flex items-center gap-2 font-semibold">
          <Icon className="h-4 w-4 text-accent" /> {connector.name}
        </h2>
        <p className="mt-1 text-sm text-ink-400">{connector.purpose}.</p>
      </div>
      {connector.connected ? <Badge tone="mint">Ready</Badge> : <Badge tone="coral">Not available</Badge>}
    </div>
  );
}

function NotConfigured({ envVar }: { envVar: string }) {
  return (
    <div className="mt-4">
      <Alert tone="info">Not set up on this server yet. Whoever runs Motion Mind needs to add {envVar}.</Alert>
    </div>
  );
}

function ClaudeCard({ connector, ask }: { connector: Connector; ask: (prompt: string) => Promise<ClaudeAnswer> }) {
  const [prompt, setPrompt] = useState('Give me 3 surprising reel topics about everyday tech in India, one line each.');
  const [answer, setAnswer] = useState<ClaudeAnswer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(text: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await ask(text);
      setAnswer(res);
      log.info('claude', 'Claude answered', { model: res.reply.model, ms: res.ms, outputTokens: res.reply.outputTokens });
    } catch (err) {
      setAnswer(null);
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <Header connector={connector} />
      {!connector.connected ? (
        <NotConfigured envVar="ANTHROPIC_API_KEY" />
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button variant="secondary" loading={busy} onClick={() => void run(TEST_PROMPT)}>
              Test Claude
            </Button>
            {connector.detail && (
              <span className="text-xs text-ink-400">
                Model: <span className="font-mono">{connector.detail}</span>
              </span>
            )}
          </div>
          <form
            className="mt-5 space-y-3 border-t border-line/[0.06] pt-5"
            onSubmit={(e) => {
              e.preventDefault();
              void run(prompt);
            }}
          >
            <h3 className="text-sm font-semibold">Ask Claude</h3>
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
          {busy && <div className="mt-4"><Spinner label="Claude is thinking" /></div>}
          {error && <div className="mt-4"><Alert>{error}</Alert></div>}
          {answer && !busy && (
            <div className="mt-4 rounded-xl bg-line/[0.04] p-4">
              <p className="whitespace-pre-wrap text-sm leading-relaxed" data-testid="claude-answer">
                {answer.reply.text}
              </p>
              <p className="mt-3 text-xs text-ink-400">
                {answer.reply.model} · {(answer.ms / 1000).toFixed(1)}s · {answer.reply.inputTokens} in / {answer.reply.outputTokens} out tokens
              </p>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

function ElevenLabsCard({ connector, test }: { connector: Connector; test: () => Promise<ElevenLabsCheck> }) {
  const [result, setResult] = useState<ElevenLabsCheck | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await test();
      setResult(res);
      log.info('elevenlabs', `ElevenLabs test: ${res.ok ? 'ok' : 'failed'}`, { voices: res.voices?.length });
    } catch (err) {
      setResult(null);
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <Header connector={connector} />
      {!connector.connected ? (
        <NotConfigured envVar="ELEVENLABS_API_KEY" />
      ) : (
        <>
          <div className="mt-4">
            <Button variant="secondary" loading={busy} onClick={() => void run()}>
              Test ElevenLabs
            </Button>
          </div>
          {error && <div className="mt-4"><Alert>{error}</Alert></div>}
          {result && (
            <div className="mt-4">
              <Alert tone={result.ok ? 'success' : 'error'}>{result.detail}</Alert>
              {result.voices && result.voices.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {result.voices.map((v) => (
                    <Badge key={v.id}>{v.name}</Badge>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </Card>
  );
}
