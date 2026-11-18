import { useState, type ReactNode } from 'react';
import { ClipboardPaste, Copy, ExternalLink, Plus, X } from 'lucide-react';
import { canReadClipboard, copyText, readText } from '../lib/clipboard';
import { errorText } from '../lib/format';
import { log } from '../lib/logger';
import { cn } from '../lib/cn';

// The pieces every Terminal screen is built from: big buttons in thumb reach, a mono log, and the copy-paste flow.

/** A full-width button; `main` is the one action the screen is for. */
export function TButton({ children, onClick, main, disabled, busy, icon, href, className }: { children: ReactNode; onClick?: () => void; main?: boolean; disabled?: boolean; busy?: boolean; icon?: ReactNode; href?: string; className?: string }) {
  const cls = cn(
    'flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl px-4 text-base font-semibold transition active:scale-[0.98] disabled:opacity-50',
    main ? 'bg-brand text-white shadow-glow' : 'border border-line/15 bg-line/[0.04] text-ink-100',
    className,
  );
  const inner = (
    <>
      {busy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden /> : icon}
      {children}
    </>
  );
  if (href)
    return (
      <a href={href} target="_blank" rel="noreferrer" className={cls}>
        {inner}
      </a>
    );
  return (
    <button type="button" className={cls} disabled={disabled || busy} onClick={onClick}>
      {inner}
    </button>
  );
}

/** A plain notice under a step: an error, a tip or a warning. */
export function TNote({ tone = 'info', children }: { tone?: 'info' | 'error' | 'warn' | 'ok'; children: ReactNode }) {
  const tones = { info: 'border-line/10 text-ink-300', error: 'border-danger/40 text-danger', warn: 'border-amber-500/40 text-amber-700', ok: 'border-emerald-500/40 text-emerald-700' };
  return <div className={cn('rounded-xl border px-3 py-2.5 text-sm leading-relaxed', tones[tone])}>{children}</div>;
}

/** The step's title and one line of help. */
export function TStepHead({ title, help }: { title: string; help?: string }) {
  return (
    <div>
      <h1 className="font-display text-[26px] font-bold leading-tight tracking-tight">{title}</h1>
      {help && <p className="mt-1.5 text-[15px] leading-relaxed text-ink-400">{help}</p>}
    </div>
  );
}

/**
 * Copy the prompt, run it in the Claude app, paste the answer back. Long answers (the animation) can come in several
 * messages: each part goes in its own box and they are joined in order.
 */
export function CopyPasteFlow({ getPrompt, onImport, multiPart, chatHint, logScope, placeholder }: { getPrompt: (note: string) => Promise<string>; onImport: (text: string) => Promise<unknown>; multiPart?: boolean; chatHint?: string; logScope: string; placeholder?: string }) {
  const [note, setNote] = useState('');
  const [showNote, setShowNote] = useState(false);
  const [copied, setCopied] = useState(false);
  const [manual, setManual] = useState<string | null>(null);
  const [parts, setParts] = useState<string[]>(['']);
  const [busy, setBusy] = useState<'copy' | 'import' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const filled = parts.filter((p) => p.trim()).length;

  async function copy() {
    setBusy('copy');
    setError(null);
    try {
      const prompt = await getPrompt(note.trim());
      if (await copyText(prompt)) {
        setCopied(true);
        setManual(null);
        log.info('terminal', `${logScope} prompt copied`);
      } else setManual(prompt);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  async function pasteInto(i: number) {
    const text = await readText();
    if (text) setParts((ps) => ps.map((p, j) => (j === i ? text : p)));
  }

  async function use() {
    setBusy('import');
    setError(null);
    try {
      await onImport(parts.filter((p) => p.trim()).join('\n'));
      setParts(['']);
      log.info('terminal', `${logScope} answer pasted`, { parts: filled });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <section className="space-y-2.5">
        <div className="font-mono text-xs uppercase tracking-[0.14em] text-ink-400">1 · copy the prompt</div>
        {showNote ? (
          <textarea aria-label="Your instructions for Claude" className="field min-h-[72px] text-base" maxLength={1500} placeholder="Optional: anything Claude should do differently" value={note} onChange={(e) => (setNote(e.target.value), setCopied(false))} />
        ) : (
          <button type="button" className="text-sm font-semibold text-accent" onClick={() => setShowNote(true)}>
            + Add your own instructions
          </button>
        )}
        <TButton main busy={busy === 'copy'} icon={<Copy className="h-5 w-5" />} onClick={() => void copy()}>
          {copied ? 'Copied. Copy again' : 'Copy prompt'}
        </TButton>
        {manual && (
          <div className="space-y-2">
            <TNote tone="warn">This browser blocked copying. Press and hold in the box, choose Select all, then Copy.</TNote>
            <textarea readOnly aria-label="Prompt to copy" className="field h-40 font-mono text-xs" value={manual} onFocus={(e) => e.currentTarget.select()} />
          </div>
        )}
      </section>

      <section className="space-y-2.5">
        <div className="font-mono text-xs uppercase tracking-[0.14em] text-ink-400">2 · send it to Claude</div>
        {chatHint && <p className="text-sm text-ink-400">{chatHint}</p>}
        <TButton href="https://claude.ai/new" icon={<ExternalLink className="h-5 w-5" />}>
          Open Claude
        </TButton>
      </section>

      <section className="space-y-2.5">
        <div className="font-mono text-xs uppercase tracking-[0.14em] text-ink-400">3 · paste the whole answer</div>
        {multiPart && <p className="text-sm text-ink-400">If Claude's answer came in more than one message (you said "continue"), paste each message as its own part, in order.</p>}
        {parts.map((p, i) => (
          <div key={i} className="space-y-2">
            {parts.length > 1 && (
              <div className="flex items-center justify-between text-xs text-ink-400">
                <span className="font-mono">part {i + 1}</span>
                <button type="button" aria-label={`Remove part ${i + 1}`} className="p-1" onClick={() => setParts((ps) => ps.filter((_, j) => j !== i))}>
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            <textarea aria-label={parts.length > 1 ? `Answer part ${i + 1}` : "Claude's answer"} className="field min-h-[120px] font-mono text-sm" placeholder={placeholder ?? 'Press and hold here, then Paste'} value={p} onChange={(e) => setParts((ps) => ps.map((x, j) => (j === i ? e.target.value : x)))} />
            {canReadClipboard() && (
              <button type="button" className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent" onClick={() => void pasteInto(i)}>
                <ClipboardPaste className="h-4 w-4" /> Paste from clipboard
              </button>
            )}
          </div>
        ))}
        {multiPart && (
          <button type="button" className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent" onClick={() => setParts((ps) => [...ps, ''])}>
            <Plus className="h-4 w-4" /> Add the next part
          </button>
        )}
        <TButton main disabled={!filled} busy={busy === 'import'} onClick={() => void use()}>
          Use this answer
        </TButton>
      </section>
      {error && <TNote tone="error">{error}</TNote>}
    </div>
  );
}
