import { z } from 'zod/v4';
import { styleOf, type ResearchReport, type StyleId } from '@motionmind/shared';
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
- Pacing: about 2.7 spoken words per second; 7 to 11 beats; each beat 1 or 2 sentences.

Each beat has narration plus an on-screen card (eyebrow, headline, tone and 1 or 2 short rows: "flow" steps, "kv" label + value, "chips" items with "strike": true for wrong or old ones, or a "note"). A motion designer animates every scene later from this script, so make each beat's card say concretely what should be on screen.

Short forms and brands (always do this):
- Never leave an abbreviation unexplained. The first time the narration uses a short form, say the full form once, like "IRCTC, yaani Indian Railway Catering and Tourism Corporation". List EVERY short form in "glossary" as { short, full }, written exactly as it appears in the reel.
- Every real company, brand, app or government body named (IRCTC, NPCI, Paytm, HDFC Bank, Google, Aadhaar ...) goes in "brands" as { name, domain } with its official website (for example irctc.co.in).

Before you answer, check your own script once: is the hook strong, is every fact right, is it natural for an Indian viewer, does every beat lead to the next? Fix it, then answer.`;

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
