import type { Beat, IsoScene, PropKind, ReelSpec, TrainShot, WorldEvent } from './script';

// Fills in 3D scenes for beats that don't describe one (older scripts, hand-added scenes), so every
// reel plays in a 3D world. Objects are guessed from the card's words; the same word gives the same
// object id, so the camera still travels around one persistent world.

const KIND_WORDS: [PropKind, RegExp][] = [
  ['satellite', /satellite|gps|isro|orbit/i],
  ['tower', /tower|signal|network|cell|antenna|5g|4g|wifi|wi-fi|broadcast/i],
  ['phone', /phone|mobile|app\b|apps\b|whatsapp|sms|otp|smartphone/i],
  ['laptop', /laptop|computer|website|browser|pc\b|screen/i],
  ['bank', /bank|upi|npci|rbi|account|loan|emi/i],
  ['server', /server|database|data ?cent|backend|api|switch|storage|record/i],
  ['cloud', /cloud|internet|online/i],
  ['money', /money|₹|rs\.?|rupee|paisa|paise|payment|pay\b|price|cost|cash|salary|fee/i],
  ['shop', /shop|store|merchant|dukaan|seller|market|restaurant/i],
  ['chip', /chip|processor|cpu|gpu|\bai\b|model|algorithm|sensor/i],
  ['document', /document|receipt|ticket|timetable|schedule|map|naksha|list|report|form|bill|id\b/i],
  ['factory', /factory|plant|manufactur|industry/i],
  ['car', /car\b|vehicle|bus\b|truck|delivery|uber|ola/i],
  ['person', /person|people|user|you\b|aap|traveller|passenger|customer|driver|doctor|friend/i],
  ['house', /house|home|ghar/i],
];

function kindFor(text: string, fallback: PropKind = 'building'): PropKind {
  return KIND_WORDS.find(([, re]) => re.test(text))?.[0] ?? fallback;
}

const idFor = (text: string) => text.toLowerCase().replace(/[^a-z0-9ऀ-ॿ]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'thing';
const starred = (headline: string) => headline.match(/\*([^*]+)\*/)?.[1];

export function autoScene(beat: Beat, previous: IsoScene | undefined): IsoScene {
  const rows = beat.card.rows ?? [];
  const flow = rows.find((r) => r.kind === 'flow');
  if (flow && flow.kind === 'flow') {
    const items = flow.items.slice(0, 4);
    const props = items.map((t) => ({ id: idFor(t), kind: kindFor(t), label: t }));
    return { props, links: props.slice(1).map((p, i) => ({ from: props[i]!.id, to: p.id })), effect: 'pulse', focus: props.at(-1)!.id };
  }
  const chips = rows.find((r) => r.kind === 'chips');
  if (chips && chips.kind === 'chips') {
    const props = chips.items.slice(0, 3).map((c) => ({ id: idFor(c.text), kind: kindFor(c.text, 'phone'), label: c.text }));
    return { props, effect: 'pulse', focus: props[0]?.id };
  }
  const kv = rows.find((r) => r.kind === 'kv');
  const word = starred(beat.card.headline) ?? beat.keywords[0] ?? beat.card.eyebrow;
  const main = { id: idFor(word), kind: kindFor(`${word} ${beat.card.eyebrow} ${beat.narration}`), label: kv && kv.kind === 'kv' ? `${kv.k}: ${kv.v}` : word.replace(/[.,!?]+$/, '') };
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
    let prev: IsoScene | undefined;
    const beats = spec.beats.map((b) => {
      const scene = b.scene?.props.length ? b.scene : autoScene(b, prev);
      prev = scene;
      return scene === b.scene ? b : { ...b, scene };
    });
    return { ...spec, beats };
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
