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
