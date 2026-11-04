import { useState } from 'react';
import { Plus, Trash2, Wand2 } from 'lucide-react';
import { SCENE_PROP_KINDS, SCENE_PROP_SHAPES, type ReelBeat, type ReelScene, type ReelTone, type ScenePropKind } from '@motionmind/shared';
import { Button } from './ui';
import { cn } from '../lib/cn';

type SceneProp = ReelScene['props'][number];

const inputCls = 'rounded-lg border border-line/15 bg-transparent px-2.5 py-1.5 text-sm outline-none focus:border-accent';
const MAX_PROPS = 4;
const TONES: ReelTone[] = ['teal', 'blue', 'purple', 'amber', 'red'];

const KIND_LABELS: Record<ScenePropKind, string> = {
  phone: 'Phone', laptop: 'Laptop', tower: 'Mobile tower', server: 'Server', cloud: 'Cloud', bank: 'Bank', shop: 'Shop', building: 'Building', house: 'House',
  factory: 'Factory', person: 'Person', document: 'Document', money: 'Money', chip: 'Chip', car: 'Car', satellite: 'Satellite', custom: 'Anything else (icon)',
  qr: 'QR code', speaker: 'Speaker', lock: 'Lock', database: 'Database', router: 'Wi-Fi router', battery: 'Battery', heart: 'Heart', gear: 'Gear', truck: 'Truck', plane: 'Plane', train: 'Train', tree: 'Tree',
  hospital: 'Hospital', school: 'School', cart: 'Shopping cart', camera: 'Camera', bulb: 'Light bulb', globe: 'Globe', envelope: 'Mail', clock: 'Clock', rocket: 'Rocket', syringe: 'Syringe', chart: 'Bar chart', atm: 'ATM',
};

interface Props {
  beat: ReelBeat;
  index: number;
  /** Objects other scenes already use, so a scene can reuse the same one and the camera stays in one world. */
  known: SceneProp[];
  /** The scene before this one, used when turning an automatic scene into an editable one. */
  previous?: ReelScene;
  onChange: (scene: ReelScene | undefined) => void;
}

/**
 * Edits one scene of the 3D world: the objects on screen (any object: pick a kind or use an emoji icon),
 * what moves between them, the effect and what the camera focuses on.
 */
export function SceneEditor({ beat, index, known, previous, onChange }: Props) {
  const [busy, setBusy] = useState(false);
  const scene = beat.scene;
  const n = index + 1;

  async function makeEditable() {
    setBusy(true);
    try {
      const { autoScene } = await import('@motionmind/reel-engine');
      onChange(autoScene(beat as never, previous as never) as ReelScene);
    } finally {
      setBusy(false);
    }
  }

  if (!scene) {
    return (
      <div className="mt-4 rounded-xl border border-dashed border-line/15 p-3 text-sm text-ink-400">
        <div className="font-medium text-ink-100">3D scene</div>
        <p className="mt-1">This scene is picked automatically from its words.</p>
        <Button className="mt-2" variant="secondary" icon={<Wand2 className="h-4 w-4" />} loading={busy} onClick={() => void makeEditable()} aria-label={`Edit the 3D scene of scene ${n}`}>
          Edit the objects
        </Button>
      </div>
    );
  }

  const set = (patch: Partial<ReelScene>) => onChange({ ...scene, ...patch });
  const setProp = (i: number, patch: Partial<SceneProp>) => set({ props: scene.props.map((p, j) => (j === i ? { ...p, ...patch } : p)) });
  const addProp = (p: SceneProp) => set({ props: [...scene.props, p], focus: scene.focus ?? p.id });
  const removeProp = (i: number) => {
    const gone = scene.props[i]!.id;
    const props = scene.props.filter((_, j) => j !== i);
    set({
      props,
      links: (scene.links ?? []).filter((l) => l.from !== gone && l.to !== gone),
      focus: scene.focus === gone ? props[0]?.id : scene.focus,
    });
  };
  const links = scene.links ?? [];
  const setLink = (i: number, patch: Partial<NonNullable<ReelScene['links']>[number]>) => set({ links: links.map((l, j) => (j === i ? { ...l, ...patch } : l)) });
  const labelOf = (id: string) => scene.props.find((p) => p.id === id)?.label || id;
  const reusable = known.filter((k) => !scene.props.some((p) => p.id === k.id));

  return (
    <div className="mt-4 space-y-3 rounded-xl border border-line/10 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">3D scene</span>
        <Button variant="ghost" onClick={() => onChange(undefined)} aria-label={`Back to the automatic scene for scene ${n}`}>
          Back to automatic
        </Button>
      </div>

      <ul className="space-y-2">
        {scene.props.map((p, i) => (
          <li key={p.id} className="rounded-lg bg-line/[0.04] p-2">
            <div className="flex flex-wrap items-center gap-2">
              <select className={inputCls} aria-label={`Scene ${n} object ${i + 1} kind`} value={p.kind} onChange={(e) => setProp(i, { kind: e.target.value as ScenePropKind })}>
                {SCENE_PROP_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABELS[k]}
                  </option>
                ))}
              </select>
              <input className={cn(inputCls, 'w-36')} aria-label={`Scene ${n} object ${i + 1} label`} placeholder="Label" maxLength={24} value={p.label ?? ''} onChange={(e) => setProp(i, { label: e.target.value })} />
              <input
                className={cn(inputCls, 'w-16 text-center')}
                aria-label={`Scene ${n} object ${i + 1} icon`}
                placeholder="🙂"
                title="One emoji shown above the object"
                maxLength={8}
                value={p.icon ?? ''}
                onChange={(e) => setProp(i, { icon: e.target.value || undefined })}
              />
              <button type="button" aria-label={`Remove object ${i + 1} from scene ${n}`} disabled={scene.props.length === 1} onClick={() => removeProp(i)} className="ml-auto rounded-lg p-1.5 text-ink-400 hover:bg-line/[0.06] hover:text-ink-100 disabled:opacity-30">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            {p.kind === 'custom' && (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-400">
                Icon name
                <input
                  className={cn(inputCls, 'w-36')}
                  aria-label={`Scene ${n} object ${i + 1} icon name`}
                  placeholder="e.g. microscope"
                  title="A Lucide icon name, drawn as a raised 3D tile. Leave empty to use the emoji and shape."
                  maxLength={40}
                  value={p.glyph ?? ''}
                  onChange={(e) => setProp(i, { glyph: e.target.value.trim().toLowerCase().replace(/\s+/g, '-') || undefined })}
                />
                Shape
                <select className={inputCls} aria-label={`Scene ${n} object ${i + 1} shape`} value={p.shape ?? 'block'} onChange={(e) => setProp(i, { shape: e.target.value as SceneProp['shape'] })}>
                  {SCENE_PROP_SHAPES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                Colour
                <select className={inputCls} aria-label={`Scene ${n} object ${i + 1} colour`} value={p.tone ?? beat.card.tone} onChange={(e) => setProp(i, { tone: e.target.value as ReelTone })}>
                  {TONES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </li>
        ))}
      </ul>
      {scene.props.length < MAX_PROPS && (
        <label className="flex items-center gap-2 text-xs text-ink-400">
          <Plus className="h-4 w-4" />
          <select
            className={inputCls}
            aria-label={`Add an object to scene ${n}`}
            value=""
            onChange={(e) => {
              const v = e.target.value;
              if (v === 'new') addProp({ id: `obj-${Math.random().toString(36).slice(2, 7)}`, kind: 'custom', label: 'New object', icon: '💡', shape: 'block', tone: beat.card.tone });
              else {
                const k = reusable.find((r) => r.id === v);
                if (k) addProp(k);
              }
            }}
          >
            <option value="">Add an object…</option>
            <option value="new">A new object</option>
            {reusable.map((k) => (
              <option key={k.id} value={k.id}>
                From another scene: {k.label || k.id}
              </option>
            ))}
          </select>
        </label>
      )}

      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-ink-400">What moves between them</div>
        {links.map((l, i) => (
          <div key={i} className="mt-2 flex flex-wrap items-center gap-2">
            <select className={inputCls} aria-label={`Scene ${n} link ${i + 1} from`} value={l.from} onChange={(e) => setLink(i, { from: e.target.value })}>
              {scene.props.map((p) => (
                <option key={p.id} value={p.id}>
                  {labelOf(p.id)}
                </option>
              ))}
            </select>
            <span className="text-ink-400">to</span>
            <select className={inputCls} aria-label={`Scene ${n} link ${i + 1} to`} value={l.to} onChange={(e) => setLink(i, { to: e.target.value })}>
              {scene.props.map((p) => (
                <option key={p.id} value={p.id}>
                  {labelOf(p.id)}
                </option>
              ))}
            </select>
            <input className={cn(inputCls, 'w-36')} aria-label={`Scene ${n} link ${i + 1} label`} placeholder="What moves" maxLength={24} value={l.label ?? ''} onChange={(e) => setLink(i, { label: e.target.value || undefined })} />
            <button type="button" aria-label={`Remove link ${i + 1} from scene ${n}`} onClick={() => set({ links: links.filter((_, j) => j !== i) })} className="rounded-lg p-1.5 text-ink-400 hover:bg-line/[0.06] hover:text-ink-100">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        <Button className="mt-2" variant="ghost" disabled={scene.props.length < 2 || links.length >= 3} aria-label={`Add a link to scene ${n}`} onClick={() => set({ links: [...links, { from: scene.props[0]!.id, to: scene.props[1]!.id }] })}>
          Add a link
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-ink-400">
        <label>
          Effect{' '}
          <select className={inputCls} aria-label={`Scene ${n} effect`} value={scene.effect ?? 'none'} onChange={(e) => set({ effect: e.target.value as ReelScene['effect'] })}>
            <option value="none">None</option>
            <option value="pulse">Glow</option>
            <option value="rings">Signal rings</option>
          </select>
        </label>
        <label>
          Camera focus{' '}
          <select className={inputCls} aria-label={`Scene ${n} focus`} value={scene.focus ?? scene.props[0]?.id ?? ''} onChange={(e) => set({ focus: e.target.value })}>
            {scene.props.map((p) => (
              <option key={p.id} value={p.id}>
                {labelOf(p.id)}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
