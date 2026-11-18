import { z } from 'zod/v4';

// The reel format Claude writes, matching the engine's Beat/ReelSpec (backend/reel-engine/src/script.ts).
// Kept to plain strings, enums and arrays so it works as a structured-output schema. Fields of the old 3D
// worlds (world, theme, scene, shot, events) in older scripts are dropped when a script is read.

const tone = z.enum(['red', 'teal', 'purple', 'blue', 'amber']);

const row = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('chips'), items: z.array(z.object({ text: z.string(), tone: tone.optional(), strike: z.boolean().optional() })) }),
  z.object({ kind: z.literal('flow'), items: z.array(z.string()) }),
  z.object({ kind: z.literal('kv'), k: z.string(), v: z.string(), tone: tone.optional() }),
  z.object({ kind: z.literal('note'), text: z.string() }),
]);

export const reelScriptSchema = z.object({
  title: z.string().describe('Short reel title, 2 to 6 words'),
  steps: z.array(z.string()).describe('3 or 4 one-word step names for the progress header'),
  glossary: z
    .array(z.object({ short: z.string().max(20).describe('The short form exactly as written in the reel, e.g. "PRS"'), full: z.string().max(90).describe('What it stands for, e.g. "Passenger Reservation System"') }))
    .optional()
    .describe('EVERY abbreviation or acronym used anywhere in the reel (IRCTC, PRS, OTP, UPI, CAPTCHA, API ...) with its full form. The reel shows the full form next to the short form.'),
  brands: z
    .array(z.object({ name: z.string().max(40).describe('The name exactly as written in the reel, e.g. "IRCTC"'), domain: z.string().max(80).describe('The official website, e.g. "irctc.co.in", no https://') }))
    .optional()
    .describe('Every real company, brand, app or government body named in the reel, with its official website, so its logo can be shown.'),
  people: z
    .array(z.object({ name: z.string().max(60).describe('The name exactly as written in the reel, e.g. "Jensen Huang"'), wiki: z.string().max(90).describe('The exact title of their English Wikipedia article, e.g. "Jensen Huang"') }))
    .optional()
    .describe('Every real person named in the reel, with their English Wikipedia article title, so their real photo can be shown. Empty if nobody is named.'),
  beats: z
    .array(
      z.object({
        id: z.string().describe('kebab-case id, unique'),
        narration: z.string().describe('What the voice says in this beat: one or two short spoken sentences'),
        keywords: z.array(z.string()).describe('2 to 4 lower-case words from the narration to highlight in captions, copied exactly with punctuation'),
        chapter: z.number().int().describe('0 for the hook, then 1..steps.length'),
        picture: z
          .string()
          .max(600)
          .optional()
          .describe('What the viewer SEES in this scene, concretely, for the animator: the hero object or scene, 2 or 3 supporting details with real numbers or names, any logo or person photo, and how it moves into the next scene. E.g. "An Nvidia H100 chip on a dark stage, its gold pins lit; a price tag reading 25,000 dollars; the Nvidia logo top left; the chip slides right as a world map takes over."'),
        card: z.object({
          eyebrow: z.string().describe('Tiny label above the headline, e.g. "Step 1 · Mobile tower"'),
          headline: z.string().describe('Under 9 words. Wrap 1 or 2 key words in *asterisks* to highlight them'),
          tone,
          rows: z.array(row).describe('1 or 2 short rows that sum up the point (used for the cover and as a fallback picture)'),
        }),
      }),
    )
    .describe('As many beats as the LENGTH asks for: a hook, the explanation in steps, and a short payoff'),
});

export type ReelScript = z.infer<typeof reelScriptSchema>;

export const researchSchema = z.object({
  summary: z.string().describe('2 to 4 sentences: how it really works, in plain words'),
  facts: z
    .array(
      z.object({
        claim: z.string().describe('One checkable fact useful for the reel'),
        status: z.enum(['verified', 'single_source', 'estimate', 'conflicting']).describe('verified = 2+ independent reliable sources agree'),
        sources: z.array(z.number().int()).describe('Indexes into sources[] that support this claim'),
      }),
    )
    .describe('As many facts as the request asks for, each specific (a number, a name, a date or a mechanism)'),
  sources: z.array(z.object({ title: z.string(), url: z.string() })).describe('Every page used, most reliable first'),
});

export type Research = z.infer<typeof researchSchema>;
