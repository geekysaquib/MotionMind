import { z } from 'zod/v4';
import type { ResearchReport } from '@motionmind/shared';
import { researchSchema, reelScriptSchema, type ReelScript, type Research } from './reelSchema';

// One prompt for both ways of getting a script: the API call ("Write with Claude") and the
// copy-paste route through claude.ai for people with a Claude subscription but no API key.

export interface ReelBrief {
  topic: string;
  durationSec: number;
  language: 'en' | 'hi' | 'hinglish';
  niche: string | null;
  channelName: string | null;
  /** Approved research to write from, if any. */
  research?: ResearchReport | null;
}

const LANGUAGE: Record<ReelBrief['language'], string> = {
  en: 'English',
  hi: 'Hindi in Devanagari script',
  hinglish: 'Hinglish (Hindi written in Latin script, with common English tech words), like a friendly Indian tech creator',
};

export const REEL_SYSTEM = `You write scripts for short vertical explainer reels (Instagram Reels, 1080x1920).
The style: a curious hook in the first beat, then a clear step-by-step explanation of how something really works, then a short payoff.
Each beat is one or two short spoken sentences plus an on-screen card that makes the point visual (chips, a flow of 2-4 arrows, a key/value fact, or a note).
Be accurate. If a number or claim is uncertain, phrase it carefully or leave it out rather than invent it.
Narration is spoken aloud: no emoji, no hashtags, no markdown. Card headlines are punchy and under 9 words.

Short forms and brands (always do this):
- Never leave an abbreviation unexplained. The first time the narration uses a short form, say the full form once, like "IRCTC, the Indian Railway Catering and Tourism Corporation". On cards, write the full form with the short form in brackets the first time it appears, for example "Passenger Reservation System (PRS)". List EVERY short form you use in "glossary" as { short, full }, written exactly as it appears in the reel. The reel automatically shows the full form on screen in every scene that uses the short form.
- Every real company, brand, app or government body the narration names (IRCTC, NPCI, Paytm, HDFC Bank, Google, Aadhaar ...) goes in "brands" as { name, domain } with its official website (for example irctc.co.in), written exactly as it appears in the reel. Where such a brand is one of the scene's objects, make that prop kind "custom" with "logo" set to the website: the reel draws the company's real logo as a raised tile. Prefer a logo tile over a generic object whenever the narration is about that company or its system.

The reel is animated in a 3D isometric world, in a pastel style, with the camera gliding between objects. Set "world":
- "train" only for topics about trains, railways or train tracking. Then give every beat a "shot" (phone = the rider's phone close up on the moving train, tower = the nearest mobile tower, map = towers along the line from above, crowd = many phones logging data, station = the next station, accuracy = the track around the train, wide = the whole line) and "events" (rings = signal waves from tower to phone, towerIds = ID tags over towers, pins = map pins on the track, gpsLog = a phone recording GPS + tower ID, stationGlow = highlight the station, errorBand = an uncertainty band along the track, none).
- "iso" for everything else. Set "theme" to the look that fits the topic: city (apps, payments, services), nature (food, farming, biology, weather, outdoors), lab (science, chips, AI, engineering), night (security, hacking, space, late-night tech), sunset (stories, culture, lifestyle, travel), ocean (water, ships, climate, marine life), desert (energy, mining, history), plain (anything abstract). Then give every beat a "scene": 1 to 4 props, each with a short id and a 1 to 3 word label. The 3D scene must show the things the narration actually talks about, so be specific: use the named kinds when one really fits (phone, laptop, tower, server, cloud, bank, shop, building, house, factory, person, document, money, chip, car, satellite, and also qr, speaker, lock, database, router, battery, heart, gear, truck, plane, train, tree, hospital, school, cart, camera, bulb, globe, envelope, clock, rocket, syringe, chart, atm, brain, virus, dna, flask, microscope, sun, flame, solar, windmill, bus, ship, shield, book, bell, and for software topics key, receipt, pin, terminal, loadbalancer, cache, queue, datacenter, toggle, gauge, cable, chat: each is a proper 3D model, so prefer them over "custom"), and otherwise use kind "custom" for ANY other object (a heart, a battery, a pan, a plant, a planet, a vaccine, a train ticket). A custom prop needs a "glyph" (a Lucide icon name in kebab-case that shows what it is, for example microscope, wheat, stethoscope, shield-check, flame, dna, brain, utensils, droplets, sprout, atom, coins, book-open: it is drawn as a raised 3D tile, so prefer it) and a "tone" (its colour); an emoji "icon" and a "shape" (block, tall, wide, flat or round) are only the fallback. Named kinds may also take an "icon" when it makes them clearer; "links" for whatever moves between them (a request, money, data, a signal), with a short label; an "effect" (rings for broadcasting or signals, pulse to highlight, none); and a "focus" prop.
Keep each scene readable: at most 3 objects when they are large (vehicles, buildings, a plane, a train, a ship), 4 only when they are small, and never more than 4. Reuse the same prop id across beats for the same object (for example "you" for the viewer's phone), so the camera travels around one world instead of jumping between unrelated scenes. Introduce one or two new objects per beat, and pick props that make the explanation visible.`;

/** The user turn: what this particular reel is about. */
export function reelRequest(brief: ReelBrief): string {
  return [
    `Write a reel about: ${brief.topic}`,
    `Length: about ${brief.durationSec} seconds spoken (roughly ${Math.round(brief.durationSec * 2.7)} words of narration in total).`,
    `Language for narration, card text and step names: ${LANGUAGE[brief.language]}.`,
    brief.niche ? `Channel niche: ${brief.niche}.` : '',
    brief.channelName ? `Channel name: ${brief.channelName}.` : '',
    brief.research ? researchNotes(brief.research) : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function researchNotes(r: ResearchReport): string {
  const facts = r.facts.map((f) => `- ${f.claim} (${f.status.replace('_', ' ')})`);
  return [
    'Use this checked research. Prefer verified facts; say "about" for estimates; leave out anything conflicting.',
    `Summary: ${r.summary}`,
    'Facts:',
    ...facts,
  ].join('\n');
}

export const RESEARCH_SYSTEM = `You research topics for short explainer reels. Find out how the thing really works, from reliable sources (official docs, engineering blogs, reputable news, research papers).
For every claim, record which sources support it and how sure it is:
verified = two or more independent reliable sources agree; single_source = only one source; estimate = an approximate number; conflicting = sources disagree.
Do not invent sources or URLs. Only list pages you actually read.`;

export function researchRequest(brief: Pick<ReelBrief, 'topic'>): string {
  return `Research this topic for a reel: ${brief.topic}`;
}

/** The research prompt for claude.ai (turn on web search there). */
export function manualResearchPrompt(brief: Pick<ReelBrief, 'topic'>): string {
  return `${RESEARCH_SYSTEM}

${researchRequest(brief)}

Search the web first. Then answer with only one JSON object, no other text, that matches this JSON Schema:
${JSON.stringify(z.toJSONSchema(researchSchema))}`;
}

/** Everything to paste into claude.ai: instructions, the brief, and the exact JSON shape to answer in. */
export function manualReelPrompt(brief: ReelBrief): string {
  const schema = JSON.stringify(z.toJSONSchema(reelScriptSchema));
  return `${REEL_SYSTEM}

${reelRequest(brief)}

Answer with only one JSON object, no other text, that matches this JSON Schema:
${schema}`;
}

export class PastedScriptError extends Error {}

/** Finds the JSON object in a chat answer (with or without a ```json fence and text around it). */
export function extractJson(text: string, what: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new PastedScriptError(`That doesn't look like ${what}. Paste Claude's whole answer (the part in { }).`);
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new PastedScriptError(`The pasted ${what} isn't complete JSON. Copy Claude's whole answer and try again.`);
  }
}

function describeIssue(issue: { path: PropertyKey[]; message: string } | undefined) {
  return issue ? ` (${issue.path.join('.') || 'top level'}: ${issue.message})` : '';
}

/**
 * Reads a script pasted back from claude.ai. Accepts the JSON with or without a ```json fence
 * and with chat text around it; rejects anything that doesn't match the reel format.
 */
export function parsePastedScript(text: string): ReelScript {
  const parsed = reelScriptSchema.safeParse(extractJson(text, 'a script'));
  if (!parsed.success) {
    throw new PastedScriptError(`The script is missing something Claude should have included${describeIssue(parsed.error.issues[0])}. Ask Claude to fix it, or copy the prompt again.`);
  }
  if (parsed.data.beats.length === 0) throw new PastedScriptError('The script has no beats. Ask Claude to try again.');
  return parsed.data;
}

/** Same for research: also drops source indexes that point nowhere, so the UI never shows a broken link. */
export function parseResearch(text: string, what = 'research'): Research {
  const parsed = researchSchema.safeParse(extractJson(text, what));
  if (!parsed.success) {
    throw new PastedScriptError(`The research is missing something Claude should have included${describeIssue(parsed.error.issues[0])}. Ask Claude to fix it, or copy the prompt again.`);
  }
  if (parsed.data.facts.length === 0) throw new PastedScriptError('The research has no facts. Ask Claude to try again.');
  const n = parsed.data.sources.length;
  return { ...parsed.data, facts: parsed.data.facts.map((f) => ({ ...f, sources: f.sources.filter((i) => i >= 0 && i < n) })) };
}
