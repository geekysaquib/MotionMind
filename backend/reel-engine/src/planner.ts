import { hasGlyph } from './glyph';
import { ICON_WORDS, KIND_WORDS } from './lexicon';
import { bareDomain, type BrandRef, type Term } from './terms';
import type { Beat, IsoScene, PropKind, ScenePropSpec, Tone, WorldTheme } from './script';

// The graphics planner: reads a beat's words (headline, labels, narration, keywords, short forms, brand names) and
// designs its 3D scene. It works in five steps, all deterministic:
//   1. FIND the things the beat is about: brands, short forms, words that name a 3D model, icon words, capitalised names.
//   2. SCORE each by where it appears (a *highlighted* headline word counts most, narration least), how specific
//      the picture for it is (a logo or a real model beats an icon, which beats a generic tile), and whether it is
//      already in the world from an earlier scene (continuity).
//   3. CHOOSE the best few within a size budget (a train is bigger than a key), in the order the narration mentions them.
//   4. CONNECT them: the verbs between two mentions ("sends", "pays", "checks") become labelled links.
//   5. RATE the result, so the Storyboard can show which scenes are strong and which need a look.

export type PlanContext = { glossary?: Term[]; brands?: BrandRef[] };

export interface SceneReport {
  index: number;
  /** 0 to 100: how well the scene's objects cover what the beat talks about. */
  score: number;
  /** The score of the scene that was there before (null when there was none). */
  before: number | null;
  /** What the scene now shows. */
  shows: string[];
  notes: string[];
}

export type PlanMode = 'fill' | 'improve' | 'redesign';

export interface GraphicsPlan {
  beats: Beat[];
  report: SceneReport[];
  /** Companies found in the text (and the ones given), with their websites, for logos. */
  brands: BrandRef[];
  /** The 3D world look that suits the topic. */
  theme: WorldTheme;
}

// ---------------------------------------------------------------- lexicon

/** Companies, apps and bodies that come up in Indian explainers, with their websites. */
const KNOWN_BRANDS: [RegExp, string, string][] = [
  [/\birctc\b/i, 'IRCTC', 'irctc.co.in'],
  [/\bnpci\b/i, 'NPCI', 'npci.org.in'],
  [/\bbhim\b/i, 'BHIM', 'bhimupi.org.in'],
  [/\bpaytm\b/i, 'Paytm', 'paytm.com'],
  [/\bphone ?pe\b/i, 'PhonePe', 'phonepe.com'],
  [/\b(g ?pay|google pay)\b/i, 'Google Pay', 'pay.google.com'],
  [/\bhdfc\b/i, 'HDFC Bank', 'hdfcbank.com'],
  [/\bsbi\b|state bank/i, 'SBI', 'sbi.co.in'],
  [/\bicici\b/i, 'ICICI Bank', 'icicibank.com'],
  [/\baxis bank\b/i, 'Axis Bank', 'axisbank.com'],
  [/\brazorpay\b/i, 'Razorpay', 'razorpay.com'],
  [/\brbi\b|reserve bank/i, 'RBI', 'rbi.org.in'],
  [/\baadhaar\b|\buidai\b/i, 'Aadhaar', 'uidai.gov.in'],
  [/\bisro\b/i, 'ISRO', 'isro.gov.in'],
  [/\bfastag\b|\bnhai\b/i, 'FASTag', 'nhai.gov.in'],
  [/\bjio\b/i, 'Jio', 'jio.com'],
  [/\bairtel\b/i, 'Airtel', 'airtel.in'],
  [/\bgoogle\b/i, 'Google', 'google.com'],
  [/\bwhats ?app\b/i, 'WhatsApp', 'whatsapp.com'],
  [/\binstagram\b/i, 'Instagram', 'instagram.com'],
  [/\byou ?tube\b/i, 'YouTube', 'youtube.com'],
  [/\bnetflix\b/i, 'Netflix', 'netflix.com'],
  [/\bamazon\b/i, 'Amazon', 'amazon.in'],
  [/\bflipkart\b/i, 'Flipkart', 'flipkart.com'],
  [/\bswiggy\b/i, 'Swiggy', 'swiggy.com'],
  [/\bzomato\b/i, 'Zomato', 'zomato.com'],
  [/\buber\b/i, 'Uber', 'uber.com'],
  [/\bola\b(?= cabs?| app)/i, 'Ola', 'olacabs.com'],
  [/\bmicrosoft\b/i, 'Microsoft', 'microsoft.com'],
  [/\bapple\b(?! ?pay)|\biphone\b/i, 'Apple', 'apple.com'],
  [/\bopenai\b|\bchatgpt\b/i, 'OpenAI', 'openai.com'],
  [/\bgithub\b/i, 'GitHub', 'github.com'],
  [/\baws\b|amazon web services/i, 'AWS', 'aws.amazon.com'],
  [/\bredis\b/i, 'Redis', 'redis.io'],
  [/\bkafka\b/i, 'Kafka', 'kafka.apache.org'],
  [/\bpostgres(ql)?\b/i, 'PostgreSQL', 'postgresql.org'],
  [/\bmongo ?db\b/i, 'MongoDB', 'mongodb.com'],
  [/\bdocker\b/i, 'Docker', 'docker.com'],
  [/\bkubernetes\b|\bk8s\b/i, 'Kubernetes', 'kubernetes.io'],
  [/\bcloudflare\b/i, 'Cloudflare', 'cloudflare.com'],
];

/** What a short form's FULL form says it is, when no single word names a model: "Passenger Reservation System" is a server. */
const FULL_FORM_HINTS: [RegExp, PropKind][] = [
  [/password|authenticat|encrypt|secur|authoriz/i, 'lock'],
  [/database|storage|registry|records?/i, 'database'],
  [/bank|payments?|finance|financial|credit|wallet/i, 'bank'],
  [/network|interface|protocol|gateway|router|connectivity/i, 'router'],
  [/corporation|authority|ministry|board|council|limited|department|agency|organi[sz]ation|institute/i, 'building'],
  [/system|platform|service|backend|engine|portal|server|management|computer/i, 'server'],
];

/** Words that carry no picture: English and Hinglish connectors, so they never become objects. */
const STOP = new Set(
  ('a an the and or but if so as of on in at by to for from with without into onto over under up down out off than then this that these those it its is are was were be been being do does did done has have had will would can could should may might not no yes ' +
    'you your yours we our they their he she his her what when where why how which who whom whose all any some more most much many very just also only even still ever never about after before again here there now new old ' +
    'hai hain tha thi the ho hota hoti hote raha rahi rahe ka ki ke ko se me mein par pe aur ya toh to ye yeh woh wo kya kyun kyon kaise kab kahan jo jab tab bhi hi nahi na ek do teen phir fir lekin magar agar aap tum tumhare tumhara apna apne mera meri hum humne ' +
    'step one two three first next last good best bad real own').split(/\s+/),
);

/** Kinds that take a lot of room on the ground. They count for more in the size budget. */
const LARGE = new Set<PropKind>(['train', 'plane', 'ship', 'bus', 'truck', 'datacenter', 'bank', 'hospital', 'factory', 'school', 'building', 'windmill', 'solar', 'tower']);

const SIGNAL = /tower|signal|network|broadcast|bhej|send|wifi|wi-fi|notify|alert|otp|sms|ping|radio/i;

const VERBS: [RegExp, string][] = [
  [/respon|repl(y|ies)|return|wapas|answer|jawab|callback/i, 'response'],
  [/\bpay|paisa|money|debit|credit|transfer|\bbill|refund/i, 'payment'],
  [/verif|validat|confirm|match|authenticat|check|dekh/i, 'check'],
  [/\bsave|stor(e|es)|write|record|likh|insert/i, 'save'],
  [/\bread|fetch|\bget\b|look ?up|pull|query/i, 'read'],
  [/\bscan|detect|sens(e|or)/i, 'scan'],
  [/notif|alert|\bsms\b|\botp\b|message/i, 'notify'],
  [/encrypt|\block|secur/i, 'secure'],
  [/send|bhej|request|\bcall|\bhit\b|\bpost\b|submit|click|tap/i, 'request'],
];

const THEME_WORDS: [WorldTheme, RegExp][] = [
  ['night', /hack|security|password|\botp\b|encrypt|attack|breach|privacy|dark|space|galaxy|ai model|deepfake|scam|fraud/gi],
  ['nature', /plant|farm|food|weather|forest|animal|crop|rain|river|health|vaccine|body|cell|biology|disease/gi],
  ['lab', /science|chip|engineer|algorithm|server|database|system design|latency|cache|\bapi\b|queue|replica|consistency|code|software|cloud|network/gi],
  ['ocean', /\bocean|\bsea\b|\bship\b|marine|climate|water|fish|port\b/gi],
  ['desert', /energy|mining|oil|history|ancient|solar|desert|fuel/gi],
  ['sunset', /story|culture|festival|travel|lifestyle|journey|memory|cricket|film|music/gi],
  ['city', /\bapp\b|payment|bank|upi|ticket|booking|service|delivery|shopping|train|metro|city|traffic/gi],
];

// ---------------------------------------------------------------- helpers

const idFor = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9ऀ-ॿ]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24) || 'thing';

const starred = (headline: string) => [...headline.matchAll(/\*([^*]+)\*/g)].map((m) => m[1]!);

const clean = (s: string) => s.replace(/\*/g, '');

const titleCase = (s: string) => s.replace(/\b[a-z]/g, (c) => c.toUpperCase());

/** The words of a beat, split by where they are, because a highlighted headline word says more than a passing word in the narration. */
function zones(beat: Beat) {
  const rows = (beat.card.rows ?? []).flatMap((r) => {
    const row = r as unknown as Record<string, unknown>;
    switch (row.kind) {
      case 'chips':
        return ((row.items as { text: string }[]) ?? []).map((i) => i.text);
      case 'flow':
        return (row.items as string[]) ?? [];
      case 'kv':
        return [String(row.k ?? ''), String(row.v ?? '')];
      default:
        return [String(row.text ?? '')];
    }
  });
  const labels = [...(beat.scene?.props.map((p) => p.label ?? '') ?? []), ...(beat.scene?.links?.map((l) => l.label ?? '') ?? [])];
  return {
    star: starred(beat.card.headline).join(' '),
    headline: clean(beat.card.headline),
    eyebrow: beat.card.eyebrow,
    rows: [...rows, ...labels].join(' \n '),
    keywords: (beat.keywords ?? []).join(' '),
    narration: beat.narration,
  };
}

const ZONE_WEIGHT = { star: 3, headline: 2.2, rows: 1.6, keywords: 1.4, eyebrow: 1.0, narration: 1.0 } as const;

type Look = { kind: PropKind; icon?: string; glyph?: string; shape?: ScenePropSpec['shape']; tone?: Tone; logo?: string };

interface Entity {
  /** Stable name: the same words in a later scene give the same object. */
  id: string;
  label: string;
  look: Look;
  /** 1 = a logo or a real 3D model, 0.7 = an icon tile, 0.35 = a generic tile. */
  specificity: number;
  score: number;
  /** Where the narration first mentions it (for ordering), or Infinity. */
  at: number;
}

function firstIndex(text: string, re: RegExp): number {
  const m = new RegExp(re.source, re.flags.replace('g', '')).exec(text);
  return m ? m.index : -1;
}

function weightOf(z: ReturnType<typeof zones>, re: RegExp): number {
  let w = 0;
  for (const k of Object.keys(ZONE_WEIGHT) as (keyof typeof ZONE_WEIGHT)[]) if (re.test(z[k])) w += ZONE_WEIGHT[k];
  return w;
}

const escapeRe = (s: string) => [...s].map((c) => (/[.*+?^${}()|[\]\\]/.test(c) ? String.fromCharCode(92) + c : c)).join('');

function lookForText(text: string, tone: Tone): Look | null {
  const named = KIND_WORDS.find(([, re]) => re.test(text));
  if (named) return { kind: named[0] };
  const icon = ICON_WORDS.find(([re]) => re.test(text));
  if (icon) return { kind: 'custom', icon: icon[1], shape: icon[2], glyph: icon[3], tone };
  const name = text.toLowerCase().split(/[^a-z-]+/).find((w) => w.length > 2 && hasGlyph(w));
  return name ? { kind: 'custom', glyph: name, icon: '💡', shape: 'block', tone } : null;
}

/** Every companies in `text` that we know or were told about. */
export function findBrands(text: string, given: BrandRef[] = []): BrandRef[] {
  const out: BrandRef[] = [];
  const add = (b: BrandRef) => {
    const d = bareDomain(b.domain);
    if (d && !out.some((o) => bareDomain(o.domain) === d)) out.push({ name: b.name, domain: d });
  };
  for (const b of given) if (b.name.trim() && new RegExp(`(?<![A-Za-z0-9])${escapeRe(b.name.trim())}(?![A-Za-z0-9])`, 'i').test(text)) add(b);
  for (const [re, name, domain] of KNOWN_BRANDS) if (re.test(text)) add({ name, domain });
  return out;
}

/** What the beat is about, best first. */
function entitiesOf(beat: Beat, ctx: PlanContext, world: Map<string, Look>, tone: Tone): Entity[] {
  const z = zones(beat);
  const all = `${z.star} ${z.headline} ${z.rows} ${z.eyebrow} ${z.keywords} ${z.narration}`;
  const found = new Map<string, Entity>();
  const put = (e: Entity) => {
    const have = found.get(e.id);
    if (!have) found.set(e.id, e);
    else if (e.score > have.score) found.set(e.id, { ...e, at: Math.min(e.at, have.at) });
    else have.at = Math.min(e.at, have.at);
  };
  const atOf = (re: RegExp) => {
    const i = firstIndex(z.narration, re);
    return i >= 0 ? i : firstIndex(z.headline, re) >= 0 ? 1000 + firstIndex(z.headline, re) : Infinity;
  };

  // 1. Brands: a real logo is the strongest picture there is.
  for (const b of findBrands(all, ctx.brands)) {
    const re = new RegExp(`(?<![A-Za-z0-9])${escapeRe(b.name)}(?![A-Za-z0-9])`, 'i');
    const w = weightOf(z, re) || 1;
    put({ id: `b-${idFor(b.name)}`, label: b.name, look: { kind: 'custom', logo: b.domain, tone }, specificity: 1, score: w * 1.5 + 0.5, at: atOf(re) });
  }

  // 2. Short forms: the full form tells us what the thing is (PRS = Passenger Reservation System -> a server).
  for (const t of ctx.glossary ?? []) {
    const re = new RegExp(`(?<![A-Za-z0-9])${escapeRe(t.short.trim())}(?![A-Za-z0-9])`);
    if (!t.short.trim() || !re.test(all)) continue;
    if (findBrands(t.short, ctx.brands).length) continue; // already a brand logo
    // The last word of a full form says what the thing IS (a "Reservation System" is a system, whoever it serves).
    const head = t.full.trim().split(/\s+/).at(-1) ?? '';
    const headHint = FULL_FORM_HINTS.find(([h]) => h.test(head));
    const hint = headHint ?? FULL_FORM_HINTS.find(([h]) => h.test(t.full));
    const look: Look | null = (headHint ? { kind: headHint[1] } : null) ?? lookForText(t.full, tone) ?? (hint ? { kind: hint[1] } : null) ?? lookForText(t.short, tone);
    if (!look) continue;
    put({ id: idFor(t.short), label: t.short.trim().slice(0, 14), look, specificity: look.kind === 'custom' ? 0.7 : 1, score: (weightOf(z, re) || 1) * 1.2 + 0.4, at: atOf(re) });
  }

  // 3. Words that name a 3D model (the rich lexicon), then icon words. Each stretch of text is used once: "load balancer"
  //    is one load balancer, not a load balancer plus a "load" gauge.
  const spans: [number, number][] = [];
  const claim = (re: RegExp): string | null => {
    const m = new RegExp(re.source, re.flags.replace('g', '')).exec(all);
    if (!m) return null;
    let a = m.index;
    let b = a + m[0].length;
    while (a > 0 && /[A-Za-z]/.test(all[a - 1]!)) a--;
    while (b < all.length && /[A-Za-z]/.test(all[b]!)) b++;
    if (spans.some(([x, y]) => a < y && b > x)) return null;
    spans.push([a, b]);
    return all.slice(a, b);
  };
  for (const [kind, re] of KIND_WORDS) {
    const w = weightOf(z, re);
    if (!w) continue;
    const word = claim(re);
    if (word === null) continue;
    const id = idFor(word.length > 2 ? word : kind);
    put({ id, label: titleCase(clean(word.trim())).slice(0, 18), look: { kind }, specificity: 1, score: w * 1.2, at: atOf(re) });
  }
  for (const [re, icon, shape, glyph] of ICON_WORDS) {
    const w = weightOf(z, re);
    if (!w) continue;
    const word = claim(re);
    if (word === null) continue;
    put({ id: idFor(word), label: titleCase(clean(word.trim())).slice(0, 18), look: { kind: 'custom', icon, shape, glyph, tone }, specificity: 0.7, score: w * 0.9, at: atOf(re) });
  }

  // 4. Highlighted headline words that nothing above explained: a generic tile, but they are what the card is about.
  for (const word of starred(beat.card.headline)) {
    if (STOP.has(word.toLowerCase().trim())) continue;
    const id = idFor(word);
    if ([...found.values()].some((e) => e.label.toLowerCase() === word.toLowerCase().slice(0, 18) || e.id === id)) continue;
    const look = lookForText(word, tone) ?? { kind: 'custom' as const, glyph: 'sparkles', icon: '💡', shape: 'block' as const, tone };
    put({ id, label: titleCase(word).slice(0, 18), look, specificity: look.glyph === 'sparkles' ? 0.35 : 0.7, score: 2.6, at: atOf(new RegExp(escapeRe(word), 'i')) });
  }

  // Continuity: what is already standing in the world scores higher, and keeps the look it had.
  const list = [...found.values()].map((e) => {
    const seen = world.get(e.id);
    const base = seen ? { ...e, look: seen, score: e.score + 0.8 } : e;
    // A specific picture is worth more than the same words drawn as a generic tile.
    return { ...base, score: base.score * (0.6 + 0.4 * base.specificity) };
  });
  return list.sort((a, b) => b.score - a.score);
}

const cost = (e: Entity) => (LARGE.has(e.look.kind) ? 1.5 : 1);

/** The best objects that fit the budget, in the order the narration mentions them. */
function choose(entities: Entity[], beat: Beat): Entity[] {
  const picked: Entity[] = [];
  let budget = 4.5;
  let generic = 0;
  // Specific pictures first (logos, models, icons); a generic tile only if there is room left over.
  const ordered = [...entities.filter((e) => e.specificity >= 0.5), ...entities.filter((e) => e.specificity < 0.5)];
  for (const e of ordered) {
    if (picked.length >= 4) break;
    // A generic tile only when there is little else: it is a guess, and a real model beside it reads better.
    if (e.specificity < 0.5 && (generic >= 1 || picked.length >= 2)) continue;
    if (picked.some((p) => p.look.kind === e.look.kind && e.look.kind !== 'custom' && p.id !== e.id && p.label === e.label)) continue;
    if (budget - cost(e) < 0) continue;
    picked.push(e);
    budget -= cost(e);
    if (e.specificity < 0.5) generic++;
  }
  // The viewer is in the story ("your phone", "tum"): keep a phone in it when there is room.
  const you = /\b(you|your|aap|aapka|aapke|tum|tumhara|tumhare|apna|apne|user|viewer)\b/i.test(`${beat.narration} ${beat.card.headline}`);
  if (you && picked.length < 4 && !picked.some((p) => p.look.kind === 'phone')) picked.unshift({ id: 'you', label: 'You', look: { kind: 'phone' }, specificity: 1, score: 1, at: -1 });
  return picked.sort((a, b) => a.at - b.at).slice(0, 4);
}

/** Links from the verbs between two mentions: "sends" -> request, "checks" -> check, "pays" -> payment. */
function linksFor(chosen: Entity[], beat: Beat): { from: string; to: string; label?: string }[] {
  if (chosen.length < 2) return [];
  const text = beat.narration;
  const links: { from: string; to: string; label?: string }[] = [];
  const used = new Set<string>();
  for (let i = 0; i < chosen.length - 1 && links.length < 3; i++) {
    const a = chosen[i]!;
    const b = chosen[i + 1]!;
    const from = a.at >= 0 && a.at < 1000 ? a.at : 0;
    const to = b.at >= 0 && b.at < 1000 && b.at > from ? b.at : text.length;
    const between = text.slice(from, to);
    const verb = VERBS.find(([re]) => re.test(between)) ?? VERBS.find(([re]) => re.test(text));
    // One label per kind of link in a scene: a second "payment" arrow needs no second word.
    const label = verb && !used.has(verb[1]) ? verb[1] : undefined;
    if (label) used.add(label);
    links.push({ from: a.id, to: b.id, ...(label ? { label } : {}) });
  }
  return links;
}

/** 0 to 100: how well these objects cover what the beat talks about. */
function rate(chosen: { look: Look; specificity: number }[], all: Entity[], hasLinks: boolean): number {
  if (!chosen.length) return 0;
  const top = all.slice(0, 5).reduce((n, e) => n + e.score, 0) || 1;
  const covered = all.filter((e) => chosen.some((c) => (c as Entity).id === e.id)).slice(0, 5).reduce((n, e) => n + e.score, 0);
  const specific = chosen.reduce((n, c) => n + c.specificity, 0) / chosen.length;
  const dense = chosen.length > 4 ? 0.7 : 1;
  return Math.round(100 * dense * (0.5 * Math.min(1, covered / top) + 0.35 * specific + 0.15 * (hasLinks || chosen.length < 2 ? 1 : 0.6)));
}

/** The score of a scene that already exists, judged against what its own beat talks about. */
export function scoreScene(beat: Beat, scene: IsoScene | undefined, ctx: PlanContext = {}): number {
  if (!scene?.props.length) return 0;
  const tone = beat.card.tone;
  const all = entitiesOf({ ...beat, scene: undefined }, ctx, new Map(), tone);
  const reps = scene.props.map((p) => {
    const label = `${p.label ?? ''} ${p.kind}`.toLowerCase();
    const hit = all.find((e) => e.look.kind === p.kind && p.kind !== 'custom') ?? all.find((e) => label.includes(e.label.toLowerCase().slice(0, 6)) || (p.logo && e.look.logo && bareDomain(p.logo) === bareDomain(e.look.logo)));
    return { id: hit?.id ?? `x-${p.id}`, look: p as Look, specificity: p.logo || p.kind !== 'custom' ? 1 : p.glyph ? 0.7 : 0.35 };
  });
  return rate(reps as unknown as Entity[], all, Boolean(scene.links?.length));
}

/** The theme that suits the whole script: the one whose words come up most. */
export function themeFor(beats: Beat[]): WorldTheme {
  const text = beats.map((b) => `${b.card.headline} ${b.card.eyebrow} ${b.narration}`).join(' ');
  let best: WorldTheme = 'city';
  let n = 0;
  for (const [theme, re] of THEME_WORDS) {
    const c = (text.match(re) ?? []).length;
    if (c > n) {
      n = c;
      best = theme;
    }
  }
  return best;
}

/** One scene for one beat. `world` is what the earlier scenes already put on the ground, by object id. */
export function planScene(beat: Beat, ctx: PlanContext = {}, world: Map<string, Look> = new Map()): { scene: IsoScene; score: number; shows: string[]; entities: Entity[] } {
  const tone = beat.card.tone;
  const all = entitiesOf(beat, ctx, world, tone);
  let chosen = choose(all, beat);
  if (!chosen.length) chosen = [{ id: 'idea', label: titleCase(clean(beat.card.headline).split(/\s+/).slice(0, 2).join(' ')), look: { kind: 'custom', glyph: 'sparkles', icon: '💡', shape: 'block', tone }, specificity: 0.35, score: 1, at: 0 }];
  const props: ScenePropSpec[] = chosen.map((e) => ({ id: e.id, kind: e.look.kind, label: e.label, ...(e.look.icon ? { icon: e.look.icon } : {}), ...(e.look.glyph ? { glyph: e.look.glyph } : {}), ...(e.look.shape ? { shape: e.look.shape } : {}), ...(e.look.tone ? { tone: e.look.tone } : {}), ...(e.look.logo ? { logo: e.look.logo } : {}) }));
  const links = linksFor(chosen, beat);
  const text = `${beat.card.headline} ${beat.narration}`;
  const effect: IsoScene['effect'] = props.length >= 4 ? 'none' : SIGNAL.test(text) ? 'rings' : 'pulse';
  const focus = links.length ? links.at(-1)!.to : [...chosen].sort((a, b) => b.score - a.score)[0]!.id;
  const scene: IsoScene = { props, ...(links.length ? { links } : {}), effect, focus };
  return { scene, score: rate(chosen, all, links.length > 0), shows: chosen.map((c) => c.label), entities: chosen };
}

/**
 * Designs the scenes of a whole script. `fill` only adds scenes where a beat has none; `improve` also replaces
 * scenes that rate below 65; `redesign` replaces every scene. Objects keep one id across scenes, so the camera still
 * travels around a single world, and scenes that stay are left exactly as the user made them.
 */
export function planGraphics(beats: Beat[], ctx: PlanContext = {}, mode: PlanMode = 'improve'): GraphicsPlan {
  const world = new Map<string, Look>();
  const report: SceneReport[] = [];
  const brandText = beats.map((b) => `${b.narration} ${b.card.headline} ${b.card.eyebrow}`).join(' \n ');
  const brands = findBrands(brandText, ctx.brands);
  const full: PlanContext = { glossary: ctx.glossary, brands: [...(ctx.brands ?? []), ...brands] };
  const out = beats.map((beat, index) => {
    const existing = beat.scene?.props.length ? beat.scene : undefined;
    const before = existing ? scoreScene(beat, existing, full) : null;
    const keep = existing && (mode === 'fill' || (mode === 'improve' && (before ?? 0) >= 65));
    if (keep) {
      for (const p of existing!.props) world.set(p.id, p as Look);
      report.push({ index, score: before ?? 0, before, shows: existing!.props.map((p) => p.label ?? p.kind), notes: ['kept'] });
      return beat;
    }
    const plan = planScene(beat, full, world);
    for (const p of plan.scene.props) world.set(p.id, p as Look);
    const notes: string[] = [];
    if (existing) notes.push(`was ${before}, now ${plan.score}`);
    if (plan.scene.props.some((p) => p.logo)) notes.push('company logo');
    if (plan.scene.links?.length) notes.push(`${plan.scene.links.length} link${plan.scene.links.length > 1 ? 's' : ''}`);
    report.push({ index, score: plan.score, before, shows: plan.shows, notes });
    // Never make a scene worse than the one the user had.
    if (existing && (before ?? 0) > plan.score) {
      for (const p of existing.props) world.set(p.id, p as Look);
      report[index] = { index, score: before ?? 0, before, shows: existing.props.map((p) => p.label ?? p.kind), notes: ['kept (already as good)'] };
      return beat;
    }
    return { ...beat, scene: plan.scene };
  });
  return { beats: out, report, brands: full.brands ?? [], theme: themeFor(beats) };
}
