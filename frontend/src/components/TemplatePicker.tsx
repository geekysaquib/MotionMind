import { Check, Database, Dna, Heart, Landmark, Laptop, Lock, RadioTower, Router, Server, ShieldCheck, Smartphone, Syringe, type LucideIcon } from 'lucide-react';
import { TEMPLATES, TEMPLATE_IDS, type TemplateId } from '@motionmind/shared';
import { cn } from '../lib/cn';

const OBJECT_ICONS: Record<string, LucideIcon> = {
  phone: Smartphone,
  tower: RadioTower,
  bank: Landmark,
  server: Server,
  database: Database,
  router: Router,
  laptop: Laptop,
  lock: Lock,
  shield: ShieldCheck,
  syringe: Syringe,
  dna: Dna,
  heart: Heart,
};

/** A small flat preview of a template: its ground colour, three of its objects and its accent. */
function Swatch({ id }: { id: TemplateId }) {
  const t = TEMPLATES[id];
  return (
    <div className="relative flex h-20 items-center justify-center gap-3 overflow-hidden rounded-lg" style={{ backgroundColor: t.preview.ground }} aria-hidden>
      {t.preview.objects.map((o, i) => {
        const Icon = OBJECT_ICONS[o] ?? Server;
        return (
          <span key={o} className="flex h-9 w-9 items-center justify-center rounded-lg bg-white shadow-sm" style={{ transform: `translateY(${i === 1 ? -6 : 4}px)`, color: t.preview.accent }}>
            <Icon className="h-5 w-5" />
          </span>
        );
      })}
      <span className="absolute inset-x-0 bottom-0 h-1.5" style={{ backgroundColor: t.preview.accent }} />
    </div>
  );
}

/** Choose the template a reel starts from. */
export function TemplatePicker({ value, onChange, compact }: { value: TemplateId; onChange: (id: TemplateId) => void; compact?: boolean }) {
  return (
    <div role="radiogroup" aria-label="Template" className={cn('grid gap-3', compact ? 'sm:grid-cols-3 xl:grid-cols-5' : 'sm:grid-cols-2 xl:grid-cols-3')}>
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
            className={cn('group relative rounded-xl border bg-ink-900 p-2.5 text-left transition hover:-translate-y-0.5', on ? 'border-mint-500/70 ring-2 ring-mint-500/25' : 'border-line/[0.12] hover:border-line/25')}
          >
            <Swatch id={id} />
            <div className="mt-2 flex items-center gap-1.5 px-0.5 text-sm font-semibold">
              {t.name}
              {on && <Check className="h-3.5 w-3.5 animate-pop text-accent" />}
            </div>
            <p className="px-0.5 text-xs text-ink-400">{t.tagline}</p>
          </button>
        );
      })}
    </div>
  );
}
