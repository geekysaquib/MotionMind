import { z } from 'zod/v4';
import { styleOf, type ResearchReport, type StyleId } from '@motionmind/shared';
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
  /** The style the user picked: the scenes are designed for it. */
  style?: StyleId | null;
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
- Every real company, brand, app or government body the narration names (IRCTC, NPCI, Paytm, HDFC Bank, Google, Aadhaar ...) goes in "brands" as { name, domain } with its official website (for example irctc.co.in), written exactly as it appears in the reel. The reel shows the company's logo in every scene that names it.

You also DESIGN THE PICTURE of every scene ("visual"): you are the motion designer, and the app animates what you lay out. The picture must show what this scene's narration is about, specific to this topic, never a generic decoration. For a backend topic show the real parts (users, load balancer, servers, database, queue, captcha, OTP on a phone, a PNR); for a money topic show the accounts, the amounts and the apps; for a science topic show the actual things and the numbers.
Each "visual" has 2 to 5 "elements" placed in the scene area (a box under the headline and above the captions, about 960 x 800 px) with "x" and "y" (their centre, in percent of that area) and optional "w" (width in percent):
- card: an actor or a thing, with a Lucide "icon" (server, database, smartphone, users, user, train-front, ticket, shield-check, credit-card, lock, alarm-clock, split, cpu, cloud, globe, wifi, bot, landmark, building-2, file-text, map-pin, package, truck, send, bell, key-round, qr-code ...) or a "logo" website, a "label" and a short "sub".
- phone / window: an app screen; "items" are the lines on it (an OTP, a chat, a form, a status), shown one by one.
- code: terminal, log or query lines that type out ("items"; ok false shows a line in red).
- number: one value that counts up ("value" with its unit, "label" what it is).
- list: rows with a tick (ok true) or a cross (ok false).
- bars: a tiny bar chart ("items" with text + value).
- ring: a percentage ("value": "80%").
- queue: a moving line of requests, people or messages ("label", "value" = how many tokens).
- stamp: one big word stamped as the verdict (CONFIRMED, WAITLIST, FAILED, BLOCKED).
- logo: a company logo with its name.
- text: a short big statement, only when nothing else can show it.
Add "links" (arrows by element id, with a 1 to 2 word "label") for whatever moves between pieces: a request, data, money, a signal. A packet travels along each link.
Make it play in time with the voice: give each element "on" = one word of this scene's narration, so it appears exactly when that word is spoken; links can have "on" too. Put the pieces in reading order (top to bottom or left to right, in the order the narration mentions them), leave space between them (pieces in the same row need x at least 45 apart; a phone is tall, give it the whole height), mark the one that matters with "focus": true, and vary the kind of picture from scene to scene (a flow, then a number, then a phone, then a verdict) so the reel keeps moving.
Also fill the card "rows": 1 or 2 short rows that sum up the point ("flow" steps, "kv" label + value, "chips" items with "strike" for wrong ones, or a "note"); they are used for the cover and as a fallback.`;

/** The user turn: what this particular reel is about. */
export function reelRequest(brief: ReelBrief): string {
  return [
    `Write a reel about: ${brief.topic}`,
    `Length: about ${brief.durationSec} seconds spoken (roughly ${Math.round(brief.durationSec * 2.7)} words of narration in total).`,
    `Language for narration, card text and step names: ${LANGUAGE[brief.language]}.`,
    brief.niche ? `Channel niche: ${brief.niche}.` : '',
    brief.channelName ? `Channel name: ${brief.channelName}.` : '',
    styleNotes(brief.style),
    brief.research ? researchNotes(brief.research) : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/** The chosen style's design rules, so the scenes are designed for the look they will be drawn in. */
function styleNotes(style: StyleId | null | undefined): string {
  const st = styleOf(style);
  return `Style: the reel is drawn in the "${st.name}" style. ${st.direction} Design every scene's visual for this style.`;
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
