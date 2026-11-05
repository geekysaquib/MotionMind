import { useRef } from 'react';
import { Check, Info, Layers3 } from 'lucide-react';
import { TEMPLATES, TEMPLATE_IDS, type TemplateId } from '@motionmind/shared';
import { cn } from '../lib/cn';

/** A template's sample: a short clip of the reel style it is modelled on (plays while hovered or chosen), or a flat tile when it has none. */
function Sample({ id, playing }: { id: TemplateId; playing: boolean }) {
  const t = TEMPLATES[id];
  const ref = useRef<HTMLVideoElement>(null);
  const play = () => void ref.current?.play().catch(() => undefined);
  const stop = () => {
    if (!playing) ref.current?.pause();
  };
  if (!t.sample) {
    return (
      <div className="flex h-44 flex-col items-center justify-center gap-2 rounded-lg" style={{ backgroundColor: t.preview.ground }} aria-hidden>
        <Layers3 className="h-8 w-8" style={{ color: t.preview.accent }} />
        <span className="text-xs font-semibold" style={{ color: t.preview.ink }}>
          Classic look
        </span>
        <span className="h-1 w-16 rounded-full" style={{ backgroundColor: t.preview.accent }} />
      </div>
    );
  }
  return (
    <video
      ref={ref}
      src={t.sample.video}
      poster={t.sample.poster}
      muted
      loop
      playsInline
      preload="none"
      autoPlay={playing}
      onMouseEnter={play}
      onMouseLeave={stop}
      aria-label={`Sample of the ${t.name} style`}
      className="h-44 w-full rounded-lg bg-ink-800 object-cover object-top"
    />
  );
}

/** Choose the template (look) of a reel: each card plays a short sample of the style it is modelled on. */
export function TemplatePicker({ value, onChange }: { value: TemplateId; onChange: (id: TemplateId) => void }) {
  const chosen = TEMPLATES[value];
  return (
    <div>
      <div role="radiogroup" aria-label="Template" className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {TEMPLATE_IDS.map((id) => {
          const t = TEMPLATES[id];
          const on = value === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(id)}
              className={cn('group relative rounded-xl border bg-ink-900 p-2 text-left transition hover:-translate-y-0.5', on ? 'border-mint-500/70 ring-2 ring-mint-500/25' : 'border-line/[0.12] hover:border-line/25')}
            >
              <Sample id={id} playing={on} />
              <div className="mt-2 flex items-center gap-1.5 px-0.5 text-sm font-semibold">
                {t.name}
                {on && <Check className="h-3.5 w-3.5 animate-pop text-accent" />}
              </div>
              <p className="px-0.5 text-xs text-ink-400">{t.tagline}</p>
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex items-start gap-2 rounded-lg bg-ink-800 p-3 text-xs text-ink-300">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
        <div>
          <span className="font-semibold text-ink-100">{chosen.name}.</span> {chosen.description}
          {chosen.limits && <span className="mt-1 block text-ink-400">Not reproduced: {chosen.limits}</span>}
        </div>
      </div>
    </div>
  );
}
