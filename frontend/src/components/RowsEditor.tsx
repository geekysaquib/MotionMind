import { Plus, Trash2 } from 'lucide-react';
import type { ReelRow } from '@motionmind/shared';
import { cn } from '../lib/cn';

const inputCls = 'w-full rounded-lg border border-line/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-accent';

const KINDS: { id: ReelRow['kind']; label: string; hint: string }[] = [
  { id: 'flow', label: 'Steps (a flow)', hint: 'One step per line. Drawn as a route, boxes with arrows or a branch line.' },
  { id: 'kv', label: 'A number', hint: 'A label and a value with its unit, like "4 sec" or "25,000". It counts up on screen.' },
  { id: 'chips', label: 'Items', hint: 'One item per line. Start a line with ~ to cross it out (a wrong or old option).' },
  { id: 'note', label: 'A note', hint: 'One short sentence: a caveat or a fun fact.' },
];

const blank = (kind: ReelRow['kind']): ReelRow =>
  kind === 'flow' ? { kind, items: ['First', 'Then', 'Finally'] } : kind === 'kv' ? { kind, k: 'Label', v: '100' } : kind === 'chips' ? { kind, items: [{ text: 'Item' }] } : { kind, text: 'A short note.' };

/**
 * What a scene shows: its card rows. Every style draws the FIRST row as the scene's main picture
 * (a route, big counting numbers, a checklist, a note), so this is where a scene's graphics are chosen.
 */
export function RowsEditor({ rows, onChange, index }: { rows: ReelRow[]; onChange: (rows: ReelRow[]) => void; index: number }) {
  const set = (i: number, row: ReelRow) => onChange(rows.map((r, j) => (j === i ? row : r)));
  return (
    <div className="mt-4 rounded-xl border border-line/10 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">Scene picture</span>
        {rows.length < 3 && (
          <button type="button" className="flex items-center gap-1 text-xs font-semibold text-accent hover:underline" onClick={() => onChange([...rows, blank(rows.length ? 'note' : 'flow')])} aria-label={`Add a row to scene ${index + 1}`}>
            <Plus className="h-3.5 w-3.5" /> Add
          </button>
        )}
      </div>
      {!rows.length && <p className="mt-2 text-xs text-ink-400">No picture: the style shows the headline on its own. Add steps, a number, items or a note.</p>}
      {rows.map((r, i) => (
        <div key={i} className="mt-3 space-y-2">
          <div className="flex items-center gap-2">
            <select aria-label={`Row ${i + 1} kind, scene ${index + 1}`} className={cn(inputCls, 'max-w-[200px]')} value={r.kind} onChange={(e) => set(i, blank(e.target.value as ReelRow['kind']))}>
              {KINDS.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.label}
                </option>
              ))}
            </select>
            {i === 0 && <span className="text-xs text-ink-400">main picture</span>}
            <button type="button" aria-label={`Delete row ${i + 1} of scene ${index + 1}`} className="ml-auto rounded-lg p-1.5 text-ink-400 hover:text-ink-100" onClick={() => onChange(rows.filter((_, j) => j !== i))}>
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          {r.kind === 'flow' && (
            <textarea aria-label={`Steps, scene ${index + 1}`} className={cn(inputCls, 'min-h-[72px]')} value={r.items.join('\n')} onChange={(e) => set(i, { kind: 'flow', items: e.target.value.split('\n').slice(0, 6) })} />
          )}
          {r.kind === 'chips' && (
            <textarea
              aria-label={`Items, scene ${index + 1}`}
              className={cn(inputCls, 'min-h-[72px]')}
              value={r.items.map((c) => (c.strike ? `~${c.text}` : c.text)).join('\n')}
              onChange={(e) => set(i, { kind: 'chips', items: e.target.value.split('\n').slice(0, 5).map((t) => (t.startsWith('~') ? { text: t.slice(1), strike: true, tone: 'red' as const } : { text: t })) })}
            />
          )}
          {r.kind === 'kv' && (
            <div className="grid grid-cols-2 gap-2">
              <input aria-label={`Number label, scene ${index + 1}`} className={inputCls} value={r.k} onChange={(e) => set(i, { ...r, k: e.target.value })} />
              <input aria-label={`Number value, scene ${index + 1}`} className={cn(inputCls, 'font-semibold')} value={r.v} onChange={(e) => set(i, { ...r, v: e.target.value })} />
            </div>
          )}
          {r.kind === 'note' && <input aria-label={`Note, scene ${index + 1}`} className={inputCls} value={r.text} onChange={(e) => set(i, { kind: 'note', text: e.target.value })} />}
          <p className="text-[11px] text-ink-400">{KINDS.find((k) => k.id === r.kind)?.hint}</p>
        </div>
      ))}
    </div>
  );
}

/** Rows as they are saved: blank lines dropped. */
export function cleanRows(rows: ReelRow[]): ReelRow[] {
  return rows
    .map((r) => (r.kind === 'flow' ? { ...r, items: r.items.map((x) => x.trim()).filter(Boolean) } : r.kind === 'chips' ? { ...r, items: r.items.filter((x) => x.text.trim()) } : r))
    .filter((r) => (r.kind === 'flow' ? r.items.length > 0 : r.kind === 'chips' ? r.items.length > 0 : r.kind === 'kv' ? r.k.trim() || r.v.trim() : r.text.trim()));
}
