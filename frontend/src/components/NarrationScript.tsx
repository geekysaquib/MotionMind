import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Link } from 'react-router-dom';
import { ClipboardCopy, ExternalLink, Languages } from 'lucide-react';
import type { Project } from '@motionmind/shared';
import { useStores } from '../stores/RootStore';
import { Alert, Button, Card } from './ui';
import { errorText } from '../lib/format';
import { log } from '../lib/logger';
import { BRAND } from '@motionmind/shared';
import { closingLine, followName, LANGUAGE_LABELS, parseTranslation, translatePrompt, TranslationError, type ScriptLanguage } from '../lib/translate';

type Lang = 'en' | 'hi';
type Saved = Partial<Record<Lang, string[]>>;

const storeKey = (projectId: string) => `mm-translations-${projectId}`;

function load(projectId: string, count: number): Saved {
  try {
    const raw = JSON.parse(window.localStorage.getItem(storeKey(projectId)) ?? '{}') as Saved;
    const out: Saved = {};
    for (const l of ['en', 'hi'] as const) if (Array.isArray(raw[l]) && raw[l]!.length === count) out[l] = raw[l];
    return out;
  } catch {
    return {};
  }
}

/**
 * The voice step's script: the narration, ready to copy into a text-to-speech tool. It can be shown in English or Hindi:
 * Claude translates it with the server key, or you copy a prompt into claude.ai and paste the answer back.
 */
export const NarrationScript = observer(function NarrationScript({ project }: { project: Project }) {
  const { aiMode, projects, services, auth, toasts, profile } = useStores();
  const script = project.script!;
  const original = script.beats.map((b) => b.narration.trim());
  const [lang, setLang] = useState<ScriptLanguage>('original');
  const [saved, setSaved] = useState<Saved>(() => load(project.id, original.length));
  const [busy, setBusy] = useState<'translate' | 'apply' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pasted, setPasted] = useState('');

  const translated = lang === 'original' ? null : saved[lang];
  const lines = lang === 'original' ? original : translated ?? null;
  // Every voice script ends by asking the viewer to follow the channel, in the language being shown.
  const closing = closingLine(lang === 'original' ? (profile.profile?.language ?? 'hinglish') : lang, followName(profile.profile, BRAND.name), project.platforms);
  const fullText = lines ? [...lines, closing].join('\n\n') : '';
  const words = fullText.split(/\s+/).filter(Boolean).length;

  function keep(l: Lang, result: string[]) {
    const next = { ...saved, [l]: result };
    setSaved(next);
    try {
      window.localStorage.setItem(storeKey(project.id), JSON.stringify(next));
    } catch {
      /* the translation stays for this visit */
    }
  }

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      toasts.push('success', `${what} copied.`);
    } catch {
      toasts.push('error', "Couldn't copy. Select the text and copy it by hand.");
    }
  }

  async function translateWithClaude() {
    if (lang === 'original') return;
    setBusy('translate');
    setError(null);
    try {
      const api = services.claude(() => auth.session?.accessToken ?? null);
      const res = await api.ask(translatePrompt(original, lang));
      keep(lang, parseTranslation(res.reply.text, original.length));
      log.info('voice', `Script translated to ${lang}`);
    } catch (e) {
      setError(e instanceof TranslationError ? `${e.message} Try again.` : errorText(e));
    } finally {
      setBusy(null);
    }
  }

  function usePasted() {
    if (lang === 'original') return;
    setError(null);
    try {
      keep(lang, parseTranslation(pasted, original.length));
      setPasted('');
    } catch (e) {
      setError(errorText(e));
    }
  }

  async function useInReel() {
    if (!translated || lang === 'original') return;
    setBusy('apply');
    setError(null);
    try {
      await projects.saveScript(project.id, { ...script, beats: script.beats.map((b, i) => ({ ...b, narration: translated[i]! })) });
      toasts.push('success', `The reel's narration and captions are now in ${LANGUAGE_LABELS[lang]}.`);
      setLang('original');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Your narration script</h2>
          <p className="mt-1 text-sm text-ink-400">Copy it into any text-to-speech tool (or read it yourself), then upload the recording below.</p>
        </div>
        <label className="text-xs text-ink-400">
          <span className="flex items-center gap-1">
            <Languages className="h-3.5 w-3.5" /> Language
          </span>
          <select
            className="mt-1 block rounded-lg border border-line/15 bg-transparent px-3 py-2 text-sm text-ink-100"
            value={lang}
            onChange={(e) => {
              setLang(e.target.value as ScriptLanguage);
              setError(null);
            }}
          >
            {(Object.keys(LANGUAGE_LABELS) as ScriptLanguage[]).map((l) => (
              <option key={l} value={l}>
                {LANGUAGE_LABELS[l]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {lines ? (
        <>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-ink-400">
              {words} words, about {Math.max(1, Math.round(words / 2.5))} seconds spoken
            </span>
            <div className="flex flex-wrap gap-2">
              {translated && (
                <Button variant="secondary" loading={busy === 'apply'} onClick={() => void useInReel()}>
                  Use in the reel
                </Button>
              )}
              <Button variant="secondary" icon={<ClipboardCopy className="h-4 w-4" />} onClick={() => void copy(fullText, 'Script')}>
                Copy the whole script
              </Button>
            </div>
          </div>
          <ol className="mt-4 space-y-3">
            {lines.map((line, i) => (
              <li key={script.beats[i]!.id} className="rounded-xl border border-line/10 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">Scene {i + 1}</span>
                  <Button variant="ghost" aria-label={`Copy scene ${i + 1}`} onClick={() => void copy(line, `Scene ${i + 1}`)}>
                    Copy
                  </Button>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{line}</p>
              </li>
            ))}
            <li className="rounded-xl border border-mint-400/40 bg-mint-400/[0.06] p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-accent">Closing line · always last</span>
                <Button variant="ghost" aria-label="Copy the closing line" onClick={() => void copy(closing, 'Closing line')}>
                  Copy
                </Button>
              </div>
              <p className="mt-1 text-sm leading-relaxed">{closing}</p>
            </li>
          </ol>
          {translated ? (
            <p className="mt-3 text-xs text-ink-400">This translation is only for copying until you press "Use in the reel", which replaces the narration and captions with it.</p>
          ) : (
            <p className="mt-3 text-xs text-ink-400">
              Want to change a line? Edit it on the{' '}
              <Link to={`/app/projects/${project.id}/storyboard`} className="text-accent hover:underline">
                Storyboard
              </Link>
              . Speak the scenes in order, with a short pause between them: you set where each scene starts after you upload.
            </p>
          )}
        </>
      ) : aiMode.paste ? (
        <ol className="mt-4 space-y-4 text-sm">
          <li>
            <div className="font-medium">1. Copy the translation prompt</div>
            <Button className="mt-2" variant="secondary" icon={<ClipboardCopy className="h-4 w-4" />} onClick={() => void copy(translatePrompt(original, lang as Lang), 'Prompt')}>
              Copy prompt
            </Button>
          </li>
          <li>
            <div className="font-medium">2. Paste it into claude.ai and send it</div>
            <a href="https://claude.ai/new" target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-accent hover:underline">
              Open claude.ai <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </li>
          <li>
            <div className="font-medium">3. Paste Claude's answer here</div>
            <textarea
              aria-label="Translated lines"
              className="mt-2 min-h-[100px] w-full rounded-xl border border-line/15 bg-transparent p-3 font-mono text-xs outline-none focus:border-accent"
              placeholder='["...", "..."]'
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
            />
            <Button className="mt-2" disabled={!pasted.trim()} onClick={usePasted}>
              Use this translation
            </Button>
          </li>
        </ol>
      ) : (
        <div className="mt-4">
          <p className="text-sm text-ink-400">
            Claude will translate all {original.length} scenes into {LANGUAGE_LABELS[lang]}.
          </p>
          <Button className="mt-3" loading={busy === 'translate'} onClick={() => void translateWithClaude()}>
            Translate with Claude
          </Button>
        </div>
      )}
      {error && <div className="mt-4"><Alert>{error}</Alert></div>}
    </Card>
  );
});
