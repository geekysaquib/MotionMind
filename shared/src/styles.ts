import type { ReelScript } from './projects';

// Styles: the look a whole reel is drawn in. The user picks one on the Style step, after the storyboard.
// Same id list as the reel engine's STYLE_IDS (the engine doesn't import this package; a test keeps them equal).

export const STYLE_IDS = ['live-map', 'whiteboard', 'dark-keynote', 'transit-map', 'newsroom', 'spotlight-noir', 'night-3d', 'system-terminal', 'host-dark', 'host-light', 'pixel-duo', 'deep-blue'] as const;
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
const REF = "Motion Mind's own, written from reference reels Saquib shared (2026-11-16).";

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
  'spotlight-noir': {
    id: 'spotlight-noir',
    name: 'Spotlight Noir',
    tagline: 'A tech documentary under one spotlight',
    description: 'Near-black navy stage with a cone of light on one glossy hero object (a chip, a server, a vault), tiny monospace series tags, violet pills, giant stat numbers and a single centred caption with the spoken word lit up.',
    bestFor: 'Chips, AI, hardware, companies and secrets, geopolitics of tech, "the story behind".',
    cues: ['chip', 'nvidia', 'gpu', 'semiconductor', 'hardware', 'ai', 'export', 'secret', 'ban', 'china', 'usa', 'company', 'ceo', 'billion', 'smuggling'],
    swatch: ['#0B0E1A', '#8B7CFF'],
    credit: REF,
    direction: 'Spotlight Noir: one hero object per scene under a cone of light on a near-black navy stage, glossy product-shot rendering, tiny monospace series tags at the top, violet and red pill labels, giant numbers, and one centred caption line with the spoken word in violet. Calm and secretive, like a tech documentary episode.',
  },
  'night-3d': {
    id: 'night-3d',
    name: 'Night World 3D',
    tagline: 'A low-poly 3D world at night',
    description: 'A cinematic low-poly 3D place at dusk (rail line, city, tower) with glowing windows and a moving camera, close-ups of the mechanism lit in cyan, glass data cards floating in the scene, and huge two-line captions at the top with one word in yellow or pink.',
    bestFor: 'Trains, vehicles, machines, towers, infrastructure, "how does this physical thing work".',
    cues: ['train', 'railway', 'irctc', 'brake', 'engine', 'tower', 'signal', 'network', 'car', 'bike', 'plane', 'metro', 'machine', 'factory', 'track'],
    swatch: ['#1B1E3A', '#FFD23F'],
    credit: REF,
    direction: 'Night World 3D: one low-poly 3D world at dusk or night built from flat-shaded shapes, a camera that keeps gliding (aerial, medium, close-up on the mechanism lit in cyan), glass data cards floating in the scene, and big two-line captions at the top with the keyword in yellow (facts) or pink (drama).',
  },
  'system-terminal': {
    id: 'system-terminal',
    name: 'Terminal Dashboard',
    tagline: 'System design on a neon dashboard',
    description: 'A black dashboard with a coloured haze, monospace labels and chips, neon-outlined cards that light up as each concept is named, data tables, coloured token blocks, seven-segment counters and data-centre nodes joined by cables.',
    bestFor: 'System design, AI internals, databases, networks, interview concepts, anything with components.',
    cues: ['system', 'design', 'database', 'token', 'tokens', 'api', 'server', 'cache', 'cap', 'theorem', 'interview', 'llm', 'gpt', 'algorithm', 'node', 'latency'],
    swatch: ['#07090C', '#3DDC84'],
    credit: REF,
    direction: 'Terminal Dashboard: every concept is a neon-outlined monospace card that lights up when named and joins a row of concept chips at the top; numbers in monospace or seven-segment displays, tables of word to number, tokens as coloured blocks, data centres as outlined nodes joined by cables; green = solution, amber = data, red = problem, blue = system.',
  },
  'host-dark': {
    id: 'host-dark',
    name: 'Host Desk, Dark',
    tagline: 'A cartoon anchor tells the story',
    description: 'A warm dark studio with a friendly flat-illustrated host (headphones and mic) in the lower third who reacts to every line, and above them news headline cards, giant red numbers, documents and toggles; key words in red italic serif.',
    bestFor: 'News stories, controversies, "what really happened", outages, investigations.',
    cues: ['news', 'outage', 'down', 'crash', 'investigation', 'government', 'report', 'airport', 'flight', 'happened', 'coincidence', 'scandal', 'leak', 'official'],
    swatch: ['#2A211D', '#E5483B'],
    credit: REF,
    direction: 'Host Desk, Dark: a flat cartoon host with a headset sits in the lower third and changes pose with every line (explaining hand, finger up, surprised, thinking), while news headline cards with highlighted phrases, giant red numbers and props appear above; warm dark brown studio, cream text, key words in red italic serif.',
  },
  'host-light': {
    id: 'host-light',
    name: 'Host Desk, Light',
    tagline: 'A friendly teacher on a white page',
    description: 'A bright white page with a bearded cartoon host at the bottom gesturing through the lesson, and sticker-style illustrations (phones, tables, database cylinders, interview desks, stamps) popping in above; black text with red italic serif accents.',
    bestFor: 'Interview questions, tech concepts for beginners, "which one should you choose", lessons and tips.',
    cues: ['which', 'choose', 'interview', 'beginner', 'learn', 'mistake', 'tips', 'question', 'sql', 'nosql', 'postgres', 'database', 'career', 'job'],
    swatch: ['#F7F6F3', '#E63B2E'],
    credit: REF,
    direction: 'Host Desk, Light: a flat cartoon teacher with a beard and mint shirt at the bottom gestures through the lesson on an off-white page, while thick-outlined sticker illustrations (phones with app screens, mini tables, database cylinders, red MISTAKE stamps, a cheat-sheet card) pop in above; black sans headline at top left with key words in red italic serif.',
  },
  'pixel-duo': {
    id: 'pixel-duo',
    name: 'Pixel Duo',
    tagline: 'A pixel-art sitcom of two',
    description: 'A cosy pixel-art room at night where a creator and a friendly robot talk through the topic; their lines appear as named subtitles, and chunky panels (comments, bills, tool cards, step cards, checklists) pop up above them.',
    bestFor: 'Tools and tutorials, free vs paid, AI tools, step-by-step how-tos, funny explainers.',
    cues: ['free', 'tool', 'tutorial', 'step', 'install', 'github', 'clone', 'voice', 'app', 'setup', 'guide', 'paid', 'subscription', 'hack'],
    swatch: ['#1B2240', '#D7FF3A'],
    credit: REF,
    direction: 'Pixel Duo: crisp pixel art (no blur) of two characters in a night room, a human creator and a screen-faced robot, talking in turns; each narration line belongs to one speaker and shows as a subtitle with their name and mood; chunky dark panels with lime step tags, invoices with red stamps and tool cards pop up above them.',
  },
  'deep-blue': {
    id: 'deep-blue',
    name: 'Deep Blue Glass',
    tagline: 'Calm glass panels in ocean blue',
    description: 'A navy-to-teal gradient with drifting particles, a short title with one bright blue word, frosted glass panels with big rolling monospace digits, small isometric objects (phones, servers, keys, clouds) and a subtitle with a moving underline.',
    bestFor: 'Security, OTPs, passwords, encryption, maths behind apps, "how does this code work".',
    cues: ['otp', 'password', 'security', 'hack', 'encryption', 'code', 'authenticator', 'key', 'bank', 'login', 'qr', 'math', 'number', 'secret', 'cyber'],
    swatch: ['#0B1A3A', '#4C7DFF'],
    credit: REF,
    direction: 'Deep Blue Glass: a calm navy-to-teal gradient with drifting particles, a 2 to 4 word title at the top with one word in bright blue, frosted glass panels holding big monospace digits that roll to new values, small glowing isometric objects (phone, server, golden key, cloud), and a centred subtitle whose spoken word gets a sliding teal underline.',
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
