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

const element = z.object({
  id: z.string().max(40).describe('short id, unique in the scene; links use it'),
  kind: z
    .enum(['card', 'phone', 'window', 'code', 'number', 'list', 'bars', 'ring', 'queue', 'stamp', 'logo', 'text'])
    .describe('card = a thing or actor with an icon (server, user, bank, train); phone = a phone screen with lines (OTP, app, chat); window = an app or web page with lines; code = terminal / log / query lines that type out; number = a big value that counts up; list = items with ticks and crosses; bars = a small bar chart; ring = a percentage ring; queue = a moving line of requests or people; stamp = one big word stamped (CONFIRMED, WAITLIST, FAILED); logo = a company logo; text = a short big statement'),
  label: z.string().max(60).optional().describe('the main text; *stars* highlight a word'),
  sub: z.string().max(60).optional().describe('a short second line'),
  icon: z.string().max(40).optional().describe("a Lucide icon name in kebab-case that shows the thing: server, database, smartphone, users, train-front, ticket, shield-check, credit-card, lock, alarm-clock, split, cpu, globe, wifi, bot, landmark, file-text, map-pin ..."),
  logo: z.string().max(80).optional().describe('the website of a real company to show its logo, e.g. irctc.co.in'),
  value: z.string().max(30).optional().describe('number: the value with its unit ("3 lakh", "5 min", "2.5 sec"); ring: a percentage ("80%"); queue: how many tokens'),
  items: z.array(z.object({ text: z.string().max(60), value: z.number().optional(), ok: z.boolean().optional() })).max(8).optional().describe('list: rows (ok true = tick, false = cross); bars: label + value; code / phone / window: the lines shown; queue: the tokens'),
  x: z.number().min(0).max(100).optional().describe('centre, percent of the scene area width (0 left, 100 right)'),
  y: z.number().min(0).max(100).optional().describe('centre, percent of the scene area height (0 top, 100 bottom)'),
  w: z.number().min(15).max(100).optional().describe('width, percent of the scene area (leave out for the default size)'),
  tone: tone.optional(),
  on: z.string().max(40).optional().describe('appears when the narration says this word (copy one word of the narration)'),
  at: z.number().min(0).max(30).optional().describe('or appears this many seconds into the scene'),
  focus: z.boolean().optional().describe('the one piece the scene is about: drawn larger with the accent'),
});

const visual = z
  .object({
    elements: z.array(element).min(1).max(6).describe('2 to 5 pieces that SHOW what the narration says, specific to this topic'),
    links: z.array(z.object({ from: z.string(), to: z.string(), label: z.string().max(24).optional(), on: z.string().max(40).optional(), dashed: z.boolean().optional() })).max(6).optional().describe('arrows between pieces (by id) for whatever moves: a request, data, money, a signal'),
    map: z.boolean().optional().describe('Live Map style only: true when the scene happens in a city (rides, deliveries, places); otherwise leave out'),
  })
  .describe('The picture of this scene, designed by you for this topic and drawn in the chosen style');

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
  beats: z
    .array(
      z.object({
        id: z.string().describe('kebab-case id, unique'),
        narration: z.string().describe('What the voice says in this beat: one or two short spoken sentences'),
        keywords: z.array(z.string()).describe('2 to 4 lower-case words from the narration to highlight in captions, copied exactly with punctuation'),
        chapter: z.number().int().describe('0 for the hook, then 1..steps.length'),
        card: z.object({
          eyebrow: z.string().describe('Tiny label above the headline, e.g. "Step 1 · Mobile tower"'),
          headline: z.string().describe('Under 9 words. Wrap 1 or 2 key words in *asterisks* to highlight them'),
          tone,
          rows: z.array(row).describe('1 or 2 short rows that sum up the point (used for the cover and as a fallback picture)'),
        }),
        visual: visual.optional(),
      }),
    )
    .describe('7 to 11 beats: a hook, the explanation in steps, and a short payoff'),
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
    .describe('6 to 12 facts'),
  sources: z.array(z.object({ title: z.string(), url: z.string() })).describe('Every page used, most reliable first'),
});

export type Research = z.infer<typeof researchSchema>;
