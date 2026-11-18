import { z } from 'zod/v4';
import { approachOf, lengthPlan, styleOf, WORDS_PER_SECOND, type ApproachId, type ResearchReport, type StyleId } from '@motionmind/shared';
import { researchSchema, reelScriptSchema, type ReelScript, type Research } from './reelSchema';

// The script prompt. Every reel is made by copy and paste through claude.ai (Saquib, 2026-11-09).

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
  /** How the reel explains its topic (facts with examples, concept, theory ...). */
  approach?: ApproachId | null;
}

const LANGUAGE: Record<ReelBrief['language'], string> = {
  en: 'English',
  hi: 'Hindi in Devanagari script',
  hinglish: 'Hinglish: Hindi written in Latin script with the English words Indians really use (app, server, payment, seat), the way a popular Indian tech creator talks',
};

export const REEL_SYSTEM = `You are the head writer of a top Indian explainer channel on Instagram Reels and YouTube Shorts (1080x1920). Your audience is Indian: students, young professionals and families across India who watch on their phone, often with the sound off, and scroll away in two seconds if the reel is boring.

What makes the script great (follow all of it):
- Hook in the first 2 seconds: a relatable Indian moment, a surprising number or a question the viewer has wondered about ("Tatkal 10 baje khulta hai aur seat 1 minute mein khatam. Kaise?"). Never start with "Aaj hum baat karenge" or a greeting.
- Talk like a smart friend from India, not a textbook: short spoken sentences, everyday words, "aap" or "tum" consistently, Indian examples (UPI, IRCTC, Zomato, Aadhaar, the local kirana shop, the Mumbai local, cricket, board exams), amounts in rupees with ₹, numbers in lakh and crore, places Indians know.
- One idea per beat. Each beat answers the question the last one raised, so the viewer always wants the next line. Build to a payoff that makes the viewer feel smart, then end with a one-line takeaway (the app adds the follow line itself).
- Accurate: only facts from the approved research or that you are sure of. If a number is an estimate say "lagbhag" / "about"; never invent a statistic, a quote or a date.
- Explain jargon the first time in plain words. No emoji, hashtags or markdown in the narration (it is spoken aloud). Card headlines are punchy, under 9 words, with 1 or 2 key words in *stars*.
- Pacing: about ${WORDS_PER_SECOND} spoken words per second; each beat 1 or 2 sentences (about 6 to 7 seconds). The LENGTH below is exact: hit its word count and number of beats, whatever the length is.

Depth (the content must be bang on and explained in detail):
- Every beat carries at least one concrete specific: a number with its unit, a name, a date, a place, or a precise step of how it works. No vague lines ("bahut zyada", "kaafi important", "experts kehte hain") without the specific behind them.
- Explain the how and the why, not just the what: each step says what happens, then why it matters or what it causes. If the viewer could ask "but how?", the next beat answers it.
- Make big numbers feel real with one comparison the viewer knows (a cricket stadium, a Mumbai local, a month's salary).
- Name the real people, companies, places and documents involved. Do not simplify a fact until it becomes wrong.

Each beat has narration, an on-screen card (eyebrow, headline, tone and 1 or 2 short rows: "flow" steps, "kv" label + value, "chips" items with "strike": true for wrong or old ones, or a "note") and a "picture": a concrete description, for the animator, of what the viewer SEES in that scene. Write every "picture" like a shot list: the hero object or scene, 2 or 3 supporting details with the real numbers or names, which logo or person photo appears, and how the scene moves into the next one. Make the pictures vary from scene to scene (a device, then a map, then a person, then a chart) so the reel never looks repetitive.

Short forms, brands and people (always do this):
- Never leave an abbreviation unexplained. The first time the narration uses a short form, say the full form once, like "IRCTC, yaani Indian Railway Catering and Tourism Corporation". List EVERY short form in "glossary" as { short, full }, written exactly as it appears in the reel.
- Every real company, brand, app or government body named (IRCTC, NPCI, Paytm, HDFC Bank, Google, Aadhaar ...) goes in "brands" as { name, domain } with its official website (for example irctc.co.in).
- Every real person named (Jensen Huang, Narendra Modi, Ratan Tata ...) goes in "people" as { name, wiki } with the exact title of their English Wikipedia article, so their real photo can be shown. Mention their role the first time ("Nvidia ke CEO Jensen Huang").

Written for text-to-speech (the creator voices it with a TTS tool such as AI Awaaz, so the punctuation IS the delivery):
- Short spoken sentences of 6 to 14 words. One thought per sentence. A long sentence read by TTS sounds flat and rushed.
- Punctuation makes the pauses: a comma where a speaker takes a short breath, a full stop between thoughts, a question mark on every real question (TTS lifts the voice), and "..." at most once or twice in the whole reel for a dramatic pause before a reveal. Every beat ends with a full stop, a question mark or an exclamation mark, because the scene changes on that pause.
- Write everything the way it is SPOKEN, never as symbols: numbers, amounts, dates and units in words in the narration language ("dhai hazaar rupaye", not "₹2,500"; "pachaas pratishat" or "50 percent", not "50%"; "saal do hazaar chaubees", not "2024"; "teen sau kilometre", not "300 km"). No %, ₹, $, &, /, +, =, #, brackets, quotes or emoji in the narration (cards and captions may show the numbers in figures).
- Short forms: write them the way they are said. Letter-by-letter ones with spaces or dots so TTS spells them (U P I, I R C T C); ones said as a word as a word (NASA, ISRO).
- In Hindi (Devanagari) narration, write the English words people use in Devanagari as they sound (सर्वर, पेमेंट, ऐप), so the Hindi voice pronounces them correctly. In Hinglish, write Hindi words in simple, common Latin spellings (hai, nahi, kyunki).
- Natural rhythm: vary sentence length a little, put the key word at the end of the sentence where the voice lands, and avoid tongue-twisters and runs of similar sounds. Read every line aloud in your head: if you would stumble, rewrite it.

Before you answer, check your own script once: is the hook strong, is every fact right, is it natural for an Indian viewer, does every beat lead to the next, would every line sound natural read by a text-to-speech voice? Fix it, then answer.`;

/** The user turn: what this particular reel is about. */
export function reelRequest(brief: ReelBrief): string {
  return [
    `Write a reel about: ${brief.topic}`,
    lengthNotes(brief.durationSec),
    `APPROACH: ${approachOf(brief.approach).script}`,
    `Language for narration, card text and step names: ${LANGUAGE[brief.language]}.`,
    brief.niche ? `Channel niche: ${brief.niche}.` : '',
    brief.channelName ? `Channel name: ${brief.channelName}.` : '',
    styleNotes(brief.style),
    brief.research ? researchNotes(brief.research) : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/** The exact length the creator chose, as a word count and a number of beats Claude must hit. */
function lengthNotes(durationSec: number): string {
  const p = lengthPlan(durationSec);
  return [
    `LENGTH (exact, the creator chose it): ${p.seconds} seconds of narration when spoken at a natural pace.`,
    `- Write ${p.words.target} words of narration in total (never fewer than ${p.words.min}, never more than ${p.words.max}), spread over ${p.beats.min} to ${p.beats.max} beats.`,
    `- Count the words of all narration before you answer. If you are short, add another step of the explanation, an example or a number from the research, not filler. A ${p.seconds}-second reel written as a 60-second one is wrong.`,
  ].join('\n');
}

/** The chosen style's design rules, so the scenes are designed for the look they will be drawn in. */
function styleNotes(style: StyleId | null | undefined): string {
  const st = styleOf(style);
  return `Style: the reel will be animated in the "${st.name}" style (${st.tagline.toLowerCase()}). Write cards that suit it: ${st.bestFor}`;
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

export function researchRequest(brief: Pick<ReelBrief, 'topic'> & { durationSec?: number; approach?: ApproachId | null }): string {
  const p = lengthPlan(brief.durationSec ?? 60);
  return `Research this topic for a reel: ${brief.topic}\nThe reel is ${p.seconds} seconds long (about ${p.beats.max} scenes), so find at least ${p.facts} distinct, specific facts (numbers, dates, names, how each step works), enough to fill every scene without repeating.\nThe reel's approach is "${approachOf(brief.approach).label}": ${approachOf(brief.approach).research} Put these in the facts too.`;
}

/** The research prompt for claude.ai (turn on web search there). */
export function manualResearchPrompt(brief: Pick<ReelBrief, 'topic'> & { durationSec?: number; approach?: ApproachId | null }): string {
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
