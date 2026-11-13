import { observer } from 'mobx-react-lite';
import { Link, useOutletContext } from 'react-router-dom';
import type { Project } from '@motionmind/shared';
import { Badge, Card } from '../../components/ui';
import { timeAgo } from '../../lib/format';
import { AnimationPreview } from '../../components/AnimationPreview';
import { PasteScriptPanel } from './PasteScriptPanel';
import { STYLES } from '@motionmind/shared';
import { pickedStyle } from '../../lib/pickedStyle';


/** Script stage: Claude writes the reel script from the topic, and the embedded engine plays it. */
export const ScriptStagePage = observer(function ScriptStagePage() {
  const project = useOutletContext<Project>();
    const script = project.script;
  const style = pickedStyle(project);

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-400">
              {style ? (
                <>
                  Claude designs every scene for the <span className="font-semibold text-ink-100">{STYLES[style].name}</span> style.
                </>
              ) : (
                'Pick a style first: Claude designs every scene for the style you choose.'
              )}
            </p>
            <Link to={`/app/projects/${project.id}/graphics`} className="text-sm font-semibold text-accent hover:underline">
              {style ? 'Change the style' : 'Pick a style'}
            </Link>
          </div>
          {script && style && script.style && script.style !== style && <p className="mt-2 text-xs text-amber-700">This script was designed for another style. Write it again for the best fit.</p>}
        </Card>
        {script ? (
          <details className="group card overflow-hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 text-sm font-semibold">
              <span>Replace the script with a new answer from claude.ai</span>
              <span className="text-lg text-ink-400 transition group-open:rotate-45">+</span>
            </summary>
            <div className="border-t border-line/[0.08] p-4">
              <PasteScriptPanel project={project} />
            </div>
          </details>
        ) : (
          <PasteScriptPanel project={project} />
        )}

        {script && (
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-xl font-bold">{script.title}</h3>
              <div className="flex flex-wrap gap-2">
                {script.steps.map((s, i) => (
                  <Badge key={s}>{`${i + 1}. ${s}`}</Badge>
                ))}
              </div>
            </div>
            <ol className="mt-5 space-y-4">
              {script.beats.map((b, i) => (
                <li key={b.id} className="rounded-xl border border-line/10 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-ink-400">
                    {i + 1}. {b.card.eyebrow}
                  </div>
                  <div className="mt-1 font-semibold" dangerouslySetInnerHTML={{ __html: highlight(b.card.headline) }} />
                  <p className="mt-2 text-sm text-ink-400">{b.narration}</p>
                </li>
              ))}
            </ol>
            {script.model && (
              <p className="mt-4 text-xs text-ink-400">
                {script.model === 'claude.ai (pasted)' ? 'Pasted from claude.ai' : `Written by ${script.model}`}
                {script.writtenAt ? ` · ${timeAgo(script.writtenAt)}` : ''}
              </p>
            )}
          </Card>
        )}
      </div>

      <div className="xl:sticky xl:top-6 xl:self-start">
        <h3 className="mb-3 text-sm font-semibold text-ink-400">Preview</h3>
        <AnimationPreview project={project} />
      </div>
    </div>
  );
});

/** *word* -> highlighted, with everything else escaped. */
function highlight(text: string) {
  const esc = text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  return esc.replace(/\*([^*]+)\*/g, '<span class="text-accent">$1</span>');
}
