import type { Beat } from './script';

/** Short forms with their full forms, and companies with their websites: what a beat shows next to its card. */
export type Term = { short: string; full: string };
export type BrandRef = { name: string; domain: string };

const SPECIAL = '.*+?^${}()|[]' + String.fromCharCode(92);
const esc = (t: string) => [...t].map((c) => (SPECIAL.includes(c) ? String.fromCharCode(92) + c : c)).join('');

/** Every piece of text a beat puts on screen or says: the narration and the card. */
export function textOf(beat: Beat): string {
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
  return [beat.narration, beat.card.eyebrow, beat.card.headline, ...rows].join(' \n ');
}

const wordRe = (word: string, flags: string) => new RegExp(`(?<![A-Za-z0-9])${esc(word)}(?![A-Za-z0-9])`, flags);

/** The short forms this beat uses whose full form is not already written on its card. At most `max`. */
export function termsFor(beat: Beat, glossary: Term[] | undefined, max = 2): Term[] {
  if (!glossary?.length) return [];
  const text = textOf(beat);
  const card = [beat.card.eyebrow, beat.card.headline].join(' ').toLowerCase();
  const out: Term[] = [];
  for (const t of glossary) {
    if (!t.short.trim() || !t.full.trim() || out.some((o) => o.short === t.short)) continue;
    if (!wordRe(t.short.trim(), '').test(text)) continue;
    if (card.includes(t.full.trim().toLowerCase())) continue; // already spelled out on the card
    out.push({ short: t.short.trim(), full: t.full.trim() });
    if (out.length >= max) break;
  }
  return out;
}

export const bareDomain = (d: string) => d.trim().toLowerCase().replace(/^[a-z]+:\/\//, '').replace(/^www\./, '').split(/[/?#]/)[0] ?? '';

/** The companies this beat names (in its text, or as a logo tile in its scene). At most `max`. */
export function brandsFor(beat: Beat, brands: BrandRef[] | undefined, max = 3): BrandRef[] {
  if (!brands?.length) return [];
  const text = textOf(beat);
  const out: BrandRef[] = [];
  for (const b of brands) {
    const domain = bareDomain(b.domain);
    if (!domain || out.some((o) => bareDomain(o.domain) === domain)) continue;
    if (!wordRe(b.name.trim(), 'i').test(text)) continue;
    out.push({ name: b.name.trim(), domain });
    if (out.length >= max) break;
  }
  return out;
}

/** Where a logo image is served from: the API's `/api/logo/<website>`. */
export function logoUrl(base: string | undefined, domain: string, name?: string): string {
  const root = (base ?? '').endsWith(String.fromCharCode(47)) ? (base ?? '').slice(0, -1) : base ?? '';
  const q = name?.trim() ? `?name=${encodeURIComponent(name.trim())}` : '';
  return `${root}/api/logo/${encodeURIComponent(bareDomain(domain))}${q}`;
}
