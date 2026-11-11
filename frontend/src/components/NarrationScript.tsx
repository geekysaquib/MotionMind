import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Link } from 'react-router-dom';
import { ClipboardCopy, Languages } from 'lucide-react';
import { BRAND, type Project } from '@motionmind/shared';
import { useStores } from '../stores/RootStore';
import { Alert, Button, Card } from './ui';
import { ClaudeAiPanel } from '../pages/app/PasteScriptPanel';
import { errorText } from '../lib/format';
import { closingLine, followName } from '../lib/closing';
import { LANGUAGES, parseTranslation, translatePrompt } from '../lib/translate';

const AS_WRITTEN = 'As written';
const OTHER = 'Other language';

/** The voice step's script: what to record, scene by scene, in the language it was written in or any other. */
export const NarrationScript = observer(function NarrationScript({ project }: { project: Project }) {
  const { toasts, profile, projects } = useStores();
  const script = project.script!;
  const original = script.beats.map((b) => b.narration.trim());
  const [choice, setChoice] = useState<string>(AS_WRITTEN);
  const [other, setOther] = useState('');
  const language = choice === OTHER ? other.trim() : choice;
  // Translations are kept per language for this visit, so switching back and forth does not ask Claude again.
  const [translated, setTranslated] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showing = choice === AS_WRITTEN ? original : language ? (translated[language] ?? null) : null;
  const closingLanguage = choice === 'English' ? 'en' : choice === 'Hindi' ? 'hi' : choice === 'Hinglish' ? 'hinglish' : choice === AS_WRITTEN ? (profile.profile?.language ?? 'hinglish') : null;
  const closing = closingLine(closingLanguage ?? 'en', followName(profile.profile, BRAND.name), project.platforms);
  const fullText = showing ? [...showing, closing].join('\n\n') : '';
  const words = fullText.split(/\s+/).filter(Boolean).length;

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      toasts.push('success', `${what} copied.`);
    } catch {
      toasts.push('error', "Couldn't copy. Select the text and copy it by hand.");
    }
  }

  async function useInReel() {
    if (!showing || choice === AS_WRITTEN) return;
    setBusy(true);
    setError(null);
    try {
      await projects.saveScript(project.id, { ...script, beats: script.beats.map((b, i) => ({ ...b, narration: showing[i]! })) });
      toasts.push('success', `The reel's narration is now in ${language}. Record it, upload it, and the fit follows.`);
      setChoice(AS_WRITTEN);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">What to record</h2>
          <p className="mt-1 text-sm text-ink-400">Read the scenes in order, or paste them into a text-to-speech tool. Then upload the audio below: the fit follows it on its own.</p>
        </div>
        <div className="flex items-end gap-2">
          <label className="text-xs text-ink-400">
            <span className="flex items-center gap-1">
              <Languages className="h-3.5 w-3.5" /> Language
            </span>
            <select
              aria-label="Language"
              className="field mt-1 py-2"
              value={choice}
              onChange={(e) => {
                setChoice(e.target.value);
                setError(null);
              }}
            >
              <option>{AS_WRITTEN}</option>
              {LANGUAGES.map((l) => (
                <option key={l}>{l}</option>
              ))}
              <option>{OTHER}</option>
            </select>
          </label>
          {choice === OTHER && <input aria-label="Language name" className="field w-40 py-2" placeholder="e.g. Malayalam" value={other} onChange={(e) => setOther(e.target.value)} />}
        </div>
      </div>

      {showing ? (
        <>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-ink-400">
              {words} words, about {Math.max(1, Math.round(words / 2.5))} seconds spoken
            </span>
            <div className="flex flex-wrap gap-2">
              {choice !== AS_WRITTEN && (
                <Button variant="secondary" loading={busy} onClick={() => void useInReel()}>
                  Use in the reel
                </Button>
              )}
              <Button variant="secondary" icon={<ClipboardCopy className="h-4 w-4" />} onClick={() => void copy(fullText, 'Script')}>
                Copy the whole script
              </Button>
            </div>
          </div>
          <ol className="mt-4 space-y-3">
            {showing.map((line, i) => (
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
              {closingLanguage === null && <p className="mt-1 text-xs text-ink-400">This closing line is in English. Translate it yourself if you need it in {language}.</p>}
            </li>
          </ol>
          {choice === AS_WRITTEN ? (
            <p className="mt-3 text-xs text-ink-400">
              Want to change a line? Edit it on the{' '}
              <Link to={`/app/projects/${project.id}/storyboard`} className="text-accent hover:underline">
                Storyboard
              </Link>{' '}
              first. If you change a line after recording, the fit is marked out of date and you can fit again.
            </p>
          ) : (
            <p className="mt-3 text-xs text-ink-400">
              This translation is only for copying until you press "Use in the reel". That replaces the narration, and the words the animation is timed to, so record it in {language}.
            </p>
          )}
        </>
      ) : (
        <div className="mt-4">
          {language ? (
            <ClaudeAiPanel
              title={`Translate it to ${language} in claude.ai`}
              placeholder='["...", "..."]'
              logScope="Translate"
              getPrompt={async (note) => translatePrompt(original, language, note)}
              onImport={async (text) => setTranslated({ ...translated, [language]: parseTranslation(text, original.length) })}
            />
          ) : (
            <p className="text-sm text-ink-400">Type the language above.</p>
          )}
        </div>
      )}
      {error && (
        <div className="mt-4">
          <Alert>{error}</Alert>
        </div>
      )}
    </Card>
  );
});
