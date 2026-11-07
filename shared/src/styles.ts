import type { ReelScript } from './projects';

// Styles: the look a whole reel is drawn in. The user picks one on the Style step, after the storyboard.
// Same id list as the reel engine's STYLE_IDS (the engine doesn't import this package; a test keeps them equal).

export const STYLE_IDS = ['live-map', 'whiteboard', 'dark-keynote', 'transit-map', 'newsroom'] as const;
export type StyleId = (typeof STYLE_IDS)[number];
export const DEFAULT_STYLE: StyleId = 'live-map';

export interface ReelStyle {
  id: StyleId;
  name: string;
  tagline: string;
  /** What it looks like. */
  description: string;
  /** Topics it suits; used to suggest a style for a script. */
  bestFor: string;
  /** Words that point to this style when a script uses them. */
  cues: string[];
  /** Two colours for the picker's swatch. */
  swatch: [string, string];
  /** Where the style comes from. */
  credit: string;
  /** How Claude should design scenes for this style (goes into the script prompt). */
  direction: string;
}

const LEMO = 'Written from a style rulebook in lemo-opuscar by LemoLab (MIT).';

export const STYLES: Record<StyleId, ReelStyle> = {
  'live-map': {
    id: 'live-map',
    name: 'Live Map',
    tagline: 'A living city map',
    description: 'A flat, light city map with cars driving and location pings. The camera moves to a new district every scene, with notification cards, routes, live numbers and a heat grid on top.',
    bestFor: 'Apps, delivery, rides, payments, anything that happens across a city.',
    cues: ['uber', 'ola', 'swiggy', 'zomato', 'zepto', 'delivery', 'ride', 'driver', 'map', 'gps', 'location', 'city', 'traffic', 'surge', 'order', 'rapido'],
    swatch: ['#F7F7F5', '#FFD60A'],
    credit: "Motion Mind's own, from the Uber heatmap reel made with the video kit.",
    direction: "Live Map: a flat, light motion-graphics look: white rounded cards with black ink, a yellow marker highlight, bold sans type, things sliding and popping in. Set \"map\": true ONLY on scenes that really happen in a city or on a map (rides, deliveries, a place, a route between places); every other scene sits on a plain light grid. Favour cards for actors, phones for app screens, numbers that count up, and arrows with a moving dot for what travels between them.",
  },
  whiteboard: {
    id: 'whiteboard',
    name: 'Whiteboard',
    tagline: 'Written live in marker',
    description: 'One dry-erase board. Headlines, boxes, arrows, ticks and circled numbers are written stroke by stroke by a floating marker, and the camera travels across the board from idea to idea.',
    bestFor: 'Science, "how does it work", money maths, step-by-step reasoning.',
    cues: ['science', 'how', 'why', 'formula', 'body', 'brain', 'interest', 'tax', 'loan', 'study', 'exam', 'learn', 'physics', 'chemistry', 'biology'],
    swatch: ['#FBFAF6', '#d97757'],
    credit: LEMO,
    direction: "Whiteboard: everything is drawn live in marker on a white board, one idea per scene, the camera moving across the board. Keep scenes simple like a teacher's sketch: 2 to 4 pieces, a clear left-to-right or top-to-bottom order, arrows for cause and effect, one focus piece circled. Lists with ticks and crosses, a number written big, and short labels work best. Avoid busy screens with many lines.",
  },
  'dark-keynote': {
    id: 'dark-keynote',
    name: 'Dark Keynote',
    tagline: 'A software launch stage',
    description: 'Near-black stage, hairline grid, one lime accent. Interface panels snap into place, numbers scramble and lock, and captions arrive as a toast.',
    bestFor: 'Software, AI, startups, product launches, big numbers.',
    cues: ['ai', 'app', 'software', 'server', 'cloud', 'api', 'startup', 'launch', 'data', 'code', 'chatgpt', 'openai', 'google', 'apple', 'redis', 'kafka', 'database'],
    swatch: ['#07080B', '#B7F34A'],
    credit: LEMO,
    direction: "Dark Keynote: a software launch stage: near-black, a hairline grid, one lime accent reserved for the thing that matters. Interface pieces (windows, phones, code that types out, notification-like cards) snap into place; one giant number per scene at most. Use red (tone red) only for the problem (errors, failures, bots) and never after the fix. Keep a lot of empty space: 2 to 4 pieces.",
  },
  'transit-map': {
    id: 'transit-map',
    name: 'Transit Map',
    tagline: 'One metro line, stop by stop',
    description: 'A printed metro map. Every scene is a station, a glowing pen tip draws the line between them, lists become branch lines and numbers roll on a ticket counter.',
    bestFor: 'Journeys, processes with steps, trains, travel, supply chains, history.',
    cues: ['train', 'metro', 'railway', 'irctc', 'journey', 'travel', 'route', 'station', 'flight', 'supply', 'step', 'process', 'history', 'timeline'],
    swatch: ['#F2EEE5', '#E3002B'],
    credit: LEMO,
    direction: "Transit Map: a printed metro map. The reel is one line and each scene is a station; the pieces of a scene are station plates joined by eight-direction lines with stops. Design each scene as a short route or a junction: 2 to 4 cards connected by links in the order things happen, the destination as the focus. Numbers sit on a ticket-counter; a stamp works as the verdict at the end of a line.",
  },
  newsroom: {
    id: 'newsroom',
    name: 'Newsroom',
    tagline: 'Big captions, hard facts',
    description: 'Social news that reads with the sound off: huge captions slammed in with the keyword on a yellow block, over dark ledger cards with rolling counters, numbered panels and a before/after split.',
    bestFor: 'News, controversies, money and markets, "what changed", explainers of a headline.',
    cues: ['news', 'government', 'rbi', 'budget', 'price', 'market', 'stock', 'ban', 'rule', 'law', 'court', 'election', 'crore', 'scam', 'policy', 'fine'],
    swatch: ['#151512', '#FFC21A'],
    credit: LEMO,
    direction: "Newsroom: social news that reads with the sound off: dark ledger cards with a honey-yellow accent, big slammed captions under them. Every number should feel like evidence: number pieces with a clear label, bars to compare, a stamp for the verdict (BANNED, CONFIRMED, FAILED), lists with crosses for what changed. Red (tone red) means losses or the bad number. 2 to 4 pieces, hard and factual.",
  },
};

export const styleOf = (id: string | null | undefined): ReelStyle => STYLES[(STYLE_IDS as readonly string[]).includes(id ?? '') ? (id as StyleId) : DEFAULT_STYLE];

/**
 * Styles ranked for a script: the ones whose cue words its title and narration use most come first.
 * `avoid` (the styles of the channel's last reels) go last, so reels don't all look the same.
 */
export function suggestStyles(script: Pick<ReelScript, 'title' | 'beats'>, avoid: string[] = []): StyleId[] {
  const text = ` ${[script.title, ...script.beats.map((b) => `${b.narration} ${b.card.headline}`)].join(' ').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ')} `;
  const score = (id: StyleId) => STYLES[id].cues.reduce((n, cue) => n + (text.split(` ${cue} `).length - 1), 0) - (avoid.includes(id) ? 1000 : 0);
  return [...STYLE_IDS].sort((a, b) => score(b) - score(a) || STYLE_IDS.indexOf(a) - STYLE_IDS.indexOf(b));
}
