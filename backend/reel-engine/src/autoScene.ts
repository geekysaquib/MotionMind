import { hasGlyph } from './glyph';
import { ICON_WORDS, kindFor } from './lexicon';
import { findBrands, planScene } from './planner';
import { bareDomain, textOf } from './terms';
import { reelTiming } from './script';
import type { Beat, IsoScene, ReelSpec, ScenePropSpec, Tone, TrainShot, WorldEvent } from './script';

// Fills in 3D scenes for beats that don't describe one (older scripts, hand-added scenes), so every
// reel plays in a 3D world. Objects are guessed from the card's words; the same word gives the same
// object id, so the camera still travels around one persistent world.


type PropLook = Pick<ScenePropSpec, 'kind' | 'icon' | 'glyph' | 'shape' | 'tone'>;

/** The object for some words, or null when nothing fits: a named kind, otherwise a custom object with an emoji. */
function matchFor(text: string, tone: Tone): PropLook | null {
  const kind = kindFor(text);
  if (kind) return { kind };
  const hit = ICON_WORDS.find(([re]) => re.test(text));
  if (hit) return { kind: 'custom', icon: hit[1], shape: hit[2], glyph: hit[3], tone };
  // Any word that is the name of a Lucide icon (microscope, wheat, magnet...) becomes that icon.
  const name = text.toLowerCase().split(/[^a-z-]+/).find((w) => w.length > 2 && hasGlyph(w));
  return name ? { kind: 'custom', glyph: name, icon: '💡', shape: 'block', tone } : null;
}

/** Like matchFor, trying each text in turn (most telling first), and never failing: unknown things become a generic custom object. */
function propFor(tone: Tone, ...texts: string[]): PropLook {
  for (const t of texts) {
    const m = matchFor(t, tone);
    if (m) return m;
  }
  return { kind: 'custom', icon: '💡', glyph: 'sparkles', shape: 'block', tone };
}

const idFor =(text: string) => text.toLowerCase().replace(/[^a-z0-9ऀ-ॿ]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'thing';
const starred = (headline: string) => headline.match(/\*([^*]+)\*/)?.[1];

export function autoScene(beat: Beat, previous: IsoScene | undefined): IsoScene {
  const rows = beat.card.rows ?? [];
  const flow = rows.find((r) => r.kind === 'flow');
  if (flow && flow.kind === 'flow') {
    const items = flow.items.slice(0, 4);
    const props = items.map((t) => ({ id: idFor(t), ...propFor(beat.card.tone, t), label: t }));
    return { props, links: props.slice(1).map((p, i) => ({ from: props[i]!.id, to: p.id })), effect: 'pulse', focus: props.at(-1)!.id };
  }
  const chips = rows.find((r) => r.kind === 'chips');
  if (chips && chips.kind === 'chips') {
    const props = chips.items.slice(0, 3).map((c) => ({ id: idFor(c.text), ...propFor(beat.card.tone, c.text), label: c.text }));
    return { props, effect: 'pulse', focus: props[0]?.id };
  }
  const kv = rows.find((r) => r.kind === 'kv');
  const word = starred(beat.card.headline) ?? beat.keywords[0] ?? beat.card.eyebrow;
  const main = { id: idFor(word), ...propFor(beat.card.tone, word, `${beat.card.eyebrow} ${beat.card.headline}`, beat.narration), label: kv && kv.kind === 'kv' ? `${kv.k}: ${kv.v}` : word.replace(/[.,!?]+$/, '') };
  // Keep the last scene's main object in view, so consecutive beats feel connected.
  const prev = previous?.props.find((p) => p.id === previous.focus) ?? previous?.props[0];
  const props = prev && prev.id !== main.id ? [prev, main] : [main];
  const signal = /tower|signal|network|broadcast|send|bhej/i.test(`${beat.card.headline} ${beat.narration}`);
  return { props, links: props.length > 1 ? [{ from: props[0]!.id, to: main.id }] : [], effect: signal ? 'rings' : 'pulse', focus: main.id };
}

/** Train world without named shots: pick them from the step and the card's words. */
function autoTrain(beat: Beat, index: number, total: number): { shot: TrainShot; events: WorldEvent[] } {
  const text = `${beat.card.eyebrow} ${beat.card.headline} ${beat.narration}`.toLowerCase();
  if (index === 0) return { shot: 'phone', events: ['none'] };
  if (index === total - 1) return { shot: 'wide', events: ['none'] };
  if (/station|timetable|schedule|delay|late/.test(text)) return { shot: 'station', events: ['stationGlow'] };
  if (/map|naksha|database|mapping|track/.test(text)) return { shot: 'map', events: ['towerIds', 'pins'] };
  if (/accura|error|galti|exact/.test(text)) return { shot: 'accuracy', events: ['errorBand'] };
  if (/gps|crowd|traveller|data se/.test(text)) return { shot: 'crowd', events: ['gpsLog', 'pins'] };
  if (/tower|signal|cell|id\b/.test(text)) return { shot: 'tower', events: /id\b/.test(text) ? ['rings', 'towerIds'] : ['rings'] };
  return { shot: 'phone', events: ['none'] };
}

/** Returns the spec with every beat ready for its 3D world. Beats that already say what to show are untouched. */
export function withScenes(spec: ReelSpec): ReelSpec {
  if (spec.world === 'iso') {
    // Beats that did not say what to show get a scene designed from their words (see planner.ts); the rest are untouched.
    const world = new Map<string, Parameters<typeof planScene>[2] extends Map<string, infer L> | undefined ? L : never>();
    const ctx = { glossary: spec.glossary, brands: spec.brands };
    const beats = spec.beats.map((b) => {
      if (b.scene?.props.length) {
        for (const p of b.scene.props) world.set(p.id, p as never);
        return b;
      }
      const { scene } = planScene(b, ctx, world);
      for (const p of scene.props) world.set(p.id, p as never);
      return { ...b, scene };
    });
    // Companies named in the words get their logo chips even when the script did not list them.
    const brands = [...(spec.brands ?? [])];
    for (const f of findBrands(spec.beats.map((b) => textOf(b)).join(' '), spec.brands)) if (!brands.some((x) => bareDomain(x.domain) === bareDomain(f.domain))) brands.push(f);
    return { ...spec, beats, brands };
  }
  if (spec.world === 'train') {
    const beats = spec.beats.map((b, i) => {
      if (b.camera || b.shot) return b;
      const auto = autoTrain(b, i, spec.beats.length);
      return { ...b, shot: auto.shot, events: b.events ?? auto.events };
    });
    return { ...spec, beats };
  }
  return spec;
}

/** Where the engine puts every 3D object right now (given the scenes and any locked spots), keyed by object id. */
export function computeLayout(spec: ReelSpec, layoutProps: (timed: ReturnType<typeof reelTiming>['timed'], locked?: ReelSpec['layout']) => Map<string, { pos: { x: number; y: number } }>): Record<string, { x: number; y: number }> {
  const full = withScenes(spec);
  const placed = layoutProps(reelTiming(full).timed, full.layout);
  return Object.fromEntries([...placed].map(([id, p]) => [id, { x: Math.round(p.pos.x * 100) / 100, y: Math.round(p.pos.y * 100) / 100 }]));
}
