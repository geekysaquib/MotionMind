import { textOf } from './terms';
import type { Beat, ShotKind } from './script';

// A "shot" is the way one scene is staged in the flat world. The reels this app is modelled on do not draw every scene as
// boxes joined by arrows: they open on a giant question mark, count a number up, tick off a list, put two things side by
// side, type into a phone or a terminal, roll digits, fill a ring. `chooseShot` reads a beat and picks the shot that
// fits what it says; `shotPlan` does it for a whole reel, avoiding the same shot twice in a row.

export const ALL_SHOTS: ShotKind[] = ['hero', 'stat', 'compare', 'checklist', 'ui', 'tiles', 'ring', 'nodes'];

export interface Stat {
  /** The text as written: "₹825", "1.5 lakh", "30 minute". */
  text: string;
  /** The number inside it, for counting up. */
  value: number;
  /** What comes before and after the number. */
  prefix: string;
  suffix: string;
  decimals: number;
}

const NUM = /(₹|rs\.?\s?|\$)?\s?(\d[\d,]*(?:\.\d+)?)\s?(%|lakh|crore|thousand|k\b|m\b|x\b|sec(?:onds?)?\b|s\b|min(?:utes?)?\b|ms\b|hours?\b|baje\b|users?\b|requests?\b|digits?\b|\/min\b|\/s\b)?/gi;

/** Numbers with their units in some text, in order: "32,000", "1.5 lakh", "30s", "10 baje", "₹825". */
export function statsIn(text: string): Stat[] {
  const out: Stat[] = [];
  for (const m of text.matchAll(NUM)) {
    const raw = m[2]!;
    const value = Number(raw.replace(/,/g, ''));
    if (!Number.isFinite(value)) continue;
    const unit = m[3] ?? '';
    // A bare small number in prose ("step 2", "teen") is not a statistic.
    if (!m[1] && !unit && value < 10) continue;
    const decimals = raw.includes('.') ? raw.split('.')[1]!.length : 0;
    out.push({ text: m[0].trim(), value, prefix: (m[1] ?? '').trim(), suffix: unit ? ` ${unit}`.replace(/^ %/, '%').replace(/^ \/(min|s)/, '/$1') : '', decimals });
  }
  return out;
}

export interface KV {
  k: string;
  v: string;
  tone?: string;
}

export function kvRows(beat: Beat): KV[] {
  return (beat.card.rows ?? []).flatMap((r) => {
    const row = r as unknown as Record<string, unknown>;
    return row.kind === 'kv' ? [{ k: String(row.k ?? ''), v: String(row.v ?? ''), tone: row.tone as string | undefined }] : [];
  });
}

export function chipRows(beat: Beat): { text: string; strike?: boolean }[] {
  return (beat.card.rows ?? []).flatMap((r) => {
    const row = r as unknown as Record<string, unknown>;
    return row.kind === 'chips' ? ((row.items as { text: string; strike?: boolean }[]) ?? []) : [];
  });
}

export function flowItems(beat: Beat): string[] {
  const f = (beat.card.rows ?? []).find((r) => (r as { kind: string }).kind === 'flow') as { items?: string[] } | undefined;
  return f?.items ?? [];
}

const QUESTION = /\?|\b(kya|kyun|kyon|kaise|kaun|kab|kahan|why|how|what|who|which)\b/i;
const TYPING = /\b(type|likh|enter|login|log in|click|tap|search|command|code|comment|chat|message|reply|dm|sign ?in|password|book|submit|run)\b/i;
const VERSUS = /\b(vs|versus|ya|instead|badle|pehle|ab |before|after|old|new|naya|purana|jagah)\b/i;
const LISTY = /\b(sirf|only|teen|three|steps?|rules?|checks?|ye teen|these)\b/i;

const has = (set: Set<ShotKind>, k: ShotKind) => set.has(k);

/** How well each shot fits a beat, from what it says. Higher wins. */
export function scoreShots(beat: Beat, allowed: ShotKind[]): Map<ShotKind, number> {
  const set = new Set(allowed);
  const text = textOf(beat);
  const head = beat.card.headline.replace(/\*/g, '');
  const stats = statsIn(`${head} ${beat.narration} ${kvRows(beat).map((r) => r.v).join(' ')}`);
  const kvs = kvRows(beat);
  const chips = chipRows(beat);
  const props = beat.scene?.props ?? [];
  const links = beat.scene?.links?.length ?? 0;
  const s = new Map<ShotKind, number>();
  const add = (k: ShotKind, n: number) => has(set, k) && s.set(k, (s.get(k) ?? 0) + n);
  for (const k of allowed) s.set(k, 0);

  add('stat', stats.length ? 3 : 0);
  add('stat', kvs.length < 2 && kvs.some((r) => statsIn(r.v).length) ? 2 : 0);
  // Two labelled values are a comparison (before / after), even when both are numbers.
  add('compare', kvs.length >= 2 ? 5 : 0);
  add('compare', VERSUS.test(text) ? 1.5 : 0);
  add('compare', props.length === 2 && !links ? 1 : 0);
  // A card that lists things (chips, some struck out) is a checklist, however many objects the scene has.
  add('checklist', chips.length >= 2 ? 4.5 : 0);
  add('checklist', chips.some((c) => c.strike) ? 1 : 0);
  add('checklist', LISTY.test(text) ? 1 : 0);
  add('checklist', flowItems(beat).length >= 3 ? 1 : 0);
  add('ring', stats.some((x) => /%|s|sec|min|hour/i.test(x.suffix)) ? 2.5 : 0);
  // A long number written without commas is a code (an OTP, an id): its digits roll and lock.
  add('tiles', stats.some((x) => x.value >= 1000 && !x.suffix.trim() && /^\d{4,}$/.test(x.text)) ? 4.5 : 0);
  add('ui', TYPING.test(text) ? 2.5 : 0);
  add('ui', props.some((p) => ['phone', 'terminal', 'laptop', 'chat', 'envelope', 'bell'].includes(p.kind)) ? 1 : 0);
  add('hero', QUESTION.test(head) ? 2.5 : 0);
  add('hero', props.length <= 1 ? 1.5 : 0);
  add('hero', head.split(/\s+/).length <= 3 ? 1 : 0);
  add('nodes', links ? 2.5 : 0);
  add('nodes', props.length >= 3 ? 2 : 0);
  add('nodes', flowItems(beat).length >= 2 ? 2 : 0);
  return s;
}

/** The shot for a beat. `previous` is the shot before it: repeating it costs a little, so a reel varies. */
export function chooseShot(beat: Beat, allowed: ShotKind[] = ALL_SHOTS, previous?: ShotKind): ShotKind {
  const scores = scoreShots(beat, allowed);
  let best: ShotKind = allowed.includes('nodes') ? 'nodes' : allowed[0] ?? 'hero';
  let top = -Infinity;
  for (const k of allowed) {
    const v = (scores.get(k) ?? 0) - (k === previous ? 2 : 0);
    if (v > top + 1e-9) {
      top = v;
      best = k;
    }
  }
  return best;
}

/** The shots of a whole reel, one per beat. */
export function shotPlan(beats: Beat[], allowed: ShotKind[] = ALL_SHOTS): ShotKind[] {
  const out: ShotKind[] = [];
  for (const b of beats) out.push(chooseShot(b, allowed, out.at(-1)));
  return out;
}
