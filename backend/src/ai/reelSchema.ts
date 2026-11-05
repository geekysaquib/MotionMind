import { z } from 'zod/v4';

// The reel format Claude writes, matching the engine's Beat/ReelSpec (backend/reel-engine/src/script.ts).
// Kept to plain strings, enums and arrays so it works as a structured-output schema. World, scene and
// train fields are optional so scripts written before the 3D worlds still load.

const tone = z.enum(['red', 'teal', 'purple', 'blue', 'amber']);

const row = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('chips'), items: z.array(z.object({ text: z.string(), tone: tone.optional(), strike: z.boolean().optional() })) }),
  z.object({ kind: z.literal('flow'), items: z.array(z.string()) }),
  z.object({ kind: z.literal('kv'), k: z.string(), v: z.string(), tone: tone.optional() }),
  z.object({ kind: z.literal('note'), text: z.string() }),
]);

// Same lists as PROP_KINDS / TRAIN_SHOTS / WorldEvent in the engine.
const propKind = z.enum(['phone', 'laptop', 'tower', 'server', 'cloud', 'bank', 'shop', 'building', 'house', 'factory', 'person', 'document', 'money', 'chip', 'car', 'satellite', 'qr', 'speaker', 'lock', 'database', 'router', 'battery', 'heart', 'gear', 'truck', 'plane', 'train', 'tree', 'hospital', 'school', 'cart', 'camera', 'bulb', 'globe', 'envelope', 'clock', 'rocket', 'syringe', 'chart', 'atm', 'brain', 'virus', 'dna', 'flask', 'microscope', 'sun', 'flame', 'solar', 'windmill', 'bus', 'ship', 'shield', 'book', 'bell', 'key', 'receipt', 'pin', 'terminal', 'loadbalancer', 'cache', 'queue', 'datacenter', 'toggle', 'gauge', 'cable', 'chat', 'custom']);

const scene = z
  .object({
    props: z
      .array(z.object({ id: z.string().describe('short id; reuse the same id in later scenes for the same object'), kind: propKind.describe("one of the named kinds, or 'custom' for anything else"), label: z.string().optional().describe('1 to 3 words shown above it'), logo: z.string().max(80).optional().describe("custom only: the website of a real company or product (like 'irctc.co.in' or 'npci.org.in') to show its LOGO as a raised tile. Use it for every brand or company the narration names. Takes the place of glyph."), glyph: z.string().max(40).optional().describe("custom only: a Lucide icon name like 'microscope' or 'wheat', drawn as a raised 3D tile. Preferred over an emoji."), icon: z.string().max(8).optional().describe("ONE emoji that shows what it is; required for 'custom'"), shape: z.enum(['block', 'tall', 'wide', 'flat', 'round']).optional().describe("custom only: body shape"), tone: tone.optional().describe("custom only: body colour") }))
      .describe('1 to 4 objects this scene shows'),
    links: z.array(z.object({ from: z.string(), to: z.string(), label: z.string().optional() })).optional().describe('signals or money moving between two of the props'),
    effect: z.enum(['rings', 'pulse', 'none']).optional().describe('rings = signal waves from the focus; pulse = it glows'),
    focus: z.string().optional().describe('id of the prop the camera and effect centre on'),
  })
  .describe('The 3D isometric scene for this beat (iso world)');

const trainShot = z.enum(['phone', 'tower', 'map', 'crowd', 'station', 'accuracy', 'wide']);
const trainEvent = z.enum(['rings', 'towerIds', 'pins', 'gpsLog', 'stationGlow', 'errorBand', 'none']);

export const reelScriptSchema = z.object({
  world: z.enum(['iso', 'train']).optional().describe("'train' only for railway / train-tracking topics; 'iso' for everything else"),
  theme: z.enum(['city', 'nature', 'lab', 'plain', 'night', 'sunset', 'ocean', 'desert']).optional().describe('iso world: the look of the ground and background that fits the topic'),
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
          rows: z.array(row).describe('0 to 2 visual rows that make the point concrete'),
        }),
        scene: scene.optional(),
        shot: trainShot.optional().describe('train world: phone (rider close-up), tower, map (towers along the line), crowd, station, accuracy, wide'),
        events: z.array(trainEvent).optional().describe('train world effects for this beat'),
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
