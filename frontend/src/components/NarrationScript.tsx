import { observer } from 'mobx-react-lite';
import { Link } from 'react-router-dom';
import { ClipboardCopy } from 'lucide-react';
import { BRAND, type Project } from '@motionmind/shared';
import { useStores } from '../stores/RootStore';
import { Button, Card } from './ui';
import { closingLine, followName } from '../lib/closing';

/** The voice step's script: what to record, scene by scene, with a copy button for each line. */
export const NarrationScript = observer(function NarrationScript({ project }: { project: Project }) {
  const { toasts, profile } = useStores();
  const script = project.script!;
  const lines = script.beats.map((b) => b.narration.trim());
  const closing = closingLine(profile.profile?.language ?? 'hinglish', followName(profile.profile, BRAND.name), project.platforms);
  const fullText = [...lines, closing].join('\n\n');
  const words = fullText.split(/\s+/).filter(Boolean).length;

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      toasts.push('success', `${what} copied.`);
    } catch {
      toasts.push('error', "Couldn't copy. Select the text and copy it by hand.");
    }
  }

  return (
    <Card>
      <h2 className="font-semibold">What to record</h2>
      <p className="mt-1 text-sm text-ink-400">Read the scenes in order in your own voice, with a short pause between scenes. Then upload the recording below.</p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-ink-400">
          {words} words, about {Math.max(1, Math.round(words / 2.5))} seconds spoken
        </span>
        <Button variant="secondary" icon={<ClipboardCopy className="h-4 w-4" />} onClick={() => void copy(fullText, 'Script')}>
          Copy the whole script
        </Button>
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
      <p className="mt-3 text-xs text-ink-400">
        Want to change a line? Edit it on the{' '}
        <Link to={`/app/projects/${project.id}/storyboard`} className="text-accent hover:underline">
          Storyboard
        </Link>{' '}
        first. If you change a line after recording, the fit is marked out of date and you can fit again.
      </p>
    </Card>
  );
});
