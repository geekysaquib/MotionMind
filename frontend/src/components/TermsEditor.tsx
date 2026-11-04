import { Building2, Plus, Trash2, Type } from 'lucide-react';
import type { ReelScript } from '@motionmind/shared';

const cls = 'rounded-lg border border-line/15 bg-transparent px-2.5 py-1.5 text-sm outline-none focus:border-accent';

/** Short forms with their full forms, and the companies whose logos the reel shows. Both come from the script and can be changed here. */
export function TermsEditor({ script, onChange }: { script: ReelScript; onChange: (next: ReelScript) => void }) {
  const glossary = script.glossary ?? [];
  const brands = script.brands ?? [];
  const setG = (next: typeof glossary) => onChange({ ...script, glossary: next });
  const setB = (next: typeof brands) => onChange({ ...script, brands: next });
  return (
    <div className="mt-4 grid gap-5 lg:grid-cols-2">
      <div>
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">
          <Type className="h-3.5 w-3.5" /> Short forms
        </span>
        <p className="mt-1 text-xs text-ink-400">Every scene that uses one shows its full form on screen.</p>
        <div className="mt-2 space-y-2">
          {glossary.length === 0 && <p className="text-xs text-ink-400">None in this script.</p>}
          {glossary.map((g, i) => (
            <div key={i} className="flex gap-2">
              <input aria-label={`Short form ${i + 1}`} className={`${cls} w-24 font-mono`} placeholder="PRS" maxLength={20} value={g.short} onChange={(e) => setG(glossary.map((x, j) => (j === i ? { ...x, short: e.target.value } : x)))} />
              <input aria-label={`Full form ${i + 1}`} className={`${cls} min-w-0 flex-1`} placeholder="Passenger Reservation System" maxLength={90} value={g.full} onChange={(e) => setG(glossary.map((x, j) => (j === i ? { ...x, full: e.target.value } : x)))} />
              <button type="button" aria-label={`Remove short form ${i + 1}`} onClick={() => setG(glossary.filter((_, j) => j !== i))} className="rounded-lg p-1.5 text-ink-400 hover:bg-line/[0.06] hover:text-ink-100">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button type="button" onClick={() => setG([...glossary, { short: '', full: '' }])} className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline">
            <Plus className="h-3.5 w-3.5" /> Add a short form
          </button>
        </div>
      </div>
      <div>
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">
          <Building2 className="h-3.5 w-3.5" /> Brands and logos
        </span>
        <p className="mt-1 text-xs text-ink-400">The logo is fetched from the website. In a scene, set an object to “custom” and type the website in its Logo box to draw it in 3D.</p>
        <div className="mt-2 space-y-2">
          {brands.length === 0 && <p className="text-xs text-ink-400">None in this script.</p>}
          {brands.map((b, i) => (
            <div key={i} className="flex items-center gap-2">
              {b.domain && <img src={`/api/logo/${encodeURIComponent(b.domain.trim())}?name=${encodeURIComponent(b.name)}`} alt="" className="h-7 w-7 shrink-0 rounded-md border border-line/10 object-contain" onError={(e) => ((e.currentTarget.style.visibility = 'hidden'))} />}
              <input aria-label={`Brand ${i + 1} name`} className={`${cls} w-28`} placeholder="IRCTC" maxLength={40} value={b.name} onChange={(e) => setB(brands.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
              <input aria-label={`Brand ${i + 1} website`} className={`${cls} min-w-0 flex-1`} placeholder="irctc.co.in" maxLength={80} value={b.domain} onChange={(e) => setB(brands.map((x, j) => (j === i ? { ...x, domain: e.target.value } : x)))} />
              <button type="button" aria-label={`Remove brand ${i + 1}`} onClick={() => setB(brands.filter((_, j) => j !== i))} className="rounded-lg p-1.5 text-ink-400 hover:bg-line/[0.06] hover:text-ink-100">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button type="button" onClick={() => setB([...brands, { name: '', domain: '' }])} className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline">
            <Plus className="h-3.5 w-3.5" /> Add a brand
          </button>
        </div>
      </div>
    </div>
  );
}
