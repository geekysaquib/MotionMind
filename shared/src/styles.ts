import type { ReelScript } from './projects';

// Styles: the look a whole reel is drawn in. The user picks one on the Style step, after the storyboard.
// Same id list as the reel engine's STYLE_IDS (the engine doesn't import this package; a test keeps them equal).

export const STYLE_IDS = ['live-map', 'dark-keynote', 'transit-map', 'newsroom', 'spotlight-noir', 'system-terminal', 'deep-blue', 'map-explainer', 'dark-documentary', 'briefing-board', 'dataviz', 'data-physical', 'teardown', 'security-xray', 'white-model', 'isometric-picture-book', 'lowpoly-island', 'tilt-shift', 'paper-lantern', 'silkscreen-poster', 'city-symphony', 'telestrator'] as const;
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

const LEMO = 'Rulebook adapted from Lemo-Opuscar by Lemomo (LemoLab), CC BY-NC 4.0 with its permission to adapt for your own films; sample film CC BY 4.0.';
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
    id: "newsroom",
    name: "Broadcast News",
    tagline: "A TV news package, built in code",
    description: "A newsroom on-air package: a sting that becomes the channel bug, a rundown of stories, a lower-third strap that stays at the bottom, and full-frame graphics: split-flap price boards, a line breaking a threshold, explainer maps, quote cards, spec cards and stamps.",
    bestFor: "News, controversies, money and markets, \"what changed\", explainers of a headline.",
    cues: ["news","government","rbi","budget","price","market","stock","ban","rule","law","court","election","crore","scam","policy","fine"],
    swatch: ["#0D1626","#E5262E"],
    credit: LEMO,
    direction: "Broadcast News: a TV news package. A channel bug in a corner and a lower-third strap that stays at the bottom hold the reel together; every scene is one full-frame graphic that carries one fact: a split-flap price board, a line crossing a threshold, a quote card, a spec card with proportion bars, a document, a stamp for the verdict. Red is the channel colour and the bad number. Hard cuts on the beat, 2 to 4 pieces per graphic.",
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
  'map-explainer': {
    id: "map-explainer",
    name: "3D Map Explainer",
    tagline: "Fly over real terrain",
    description: "A 3D terrain map with the height exaggerated, lit by a low warm sun, a sea coloured by depth, and a glowing data layer over it: routes, lanes, measurements, pillars. The camera falls from space, flies over, cuts the ground open and climbs out.",
    bestFor: "Geography, borders, rivers, dams, wars, trade routes, places and why they matter.",
    cues: ["border","river","mountain","himalaya","dam","sea","ocean","country","war","geography","island","trade","port","canal","strait"],
    swatch: ["#0E2233","#F2A33A"],
    direction: "3D Map Explainer: every scene is a place on one 3D terrain map lit by a low warm sun. Data glows on top of the ground: a route that flows, a lane, a measured distance, a pillar for a number. Design scenes as camera moves: from orbit into the place, a fly-over along the route, a cut-away of the ground, back out. One glowing accent per scene.",
    credit: LEMO,
  },
  'dark-documentary': {
    id: "dark-documentary",
    name: "Radar Sweep",
    tagline: "Black until the scan passes",
    description: "The world is black until a plane of light sweeps across it; what it touched lights up and settles into echoes: contour lines, range rings, wireframe edges. Facts arrive as instrument readings: thin titles, small monospaced type and gauges beside the thing they describe.",
    bestFor: "Mysteries, investigations, defence, space, submarines, \"what really happened\".",
    cues: ["mystery","missing","radar","submarine","missile","defence","army","space","isro","nasa","crash","investigation","spy"],
    swatch: ["#05070A","#3EF0C8"],
    direction: "Radar Sweep: every scene starts black and a scan of light reveals the subject (terrain, a machine, a room) as wireframe edges, contours and range rings that slowly fade. Facts are instrument readings: a thin title, monospaced numbers, a gauge or timeline placed right beside what they describe. Calm and tense; one subject per scene.",
    credit: LEMO,
  },
  'briefing-board': {
    id: "briefing-board",
    name: "Briefing Board",
    tagline: "An engineering whiteboard wall",
    description: "A real whiteboard wall in window light: cut-out photos of real things land on it with weight, tags, magnets, a ruler and stamps are pinned around them, and marker lines draw themselves in three colours with fixed meanings while the camera rides from fact to fact.",
    bestFor: "Science, engineering, \"how does it work\", money maths, step-by-step reasoning.",
    cues: ["science","how","why","formula","engineering","bridge","build","interest","tax","loan","study","exam","learn","physics","chemistry","biology"],
    swatch: ["#EDEFEC","#1F5FD6"],
    direction: "Briefing Board: one whiteboard wall. Each scene pins 2 to 4 things to it: a cut-out picture of the real object, a tag with a number, a magnet, a stamp. Marker ink draws itself to connect them, in three colours with fixed meanings (black for facts, blue for how it works, red for the problem). The camera rides the lines from fact to fact; the last scene pulls back to show the whole board.",
    credit: LEMO,
  },
  dataviz: {
    id: "dataviz",
    name: "Data Story",
    tagline: "A chart that tells a story",
    description: "Real data drawn mark by mark on cream paper with a red and blue pencil, with handwritten notes pinned to the numbers. The chart itself is the camera, the rhythm and the plot.",
    bestFor: "Statistics, trends, economy, population, \"the numbers say\", comparisons over time.",
    cues: ["percent","growth","gdp","inflation","population","statistics","survey","trend","chart","rate","income","economy"],
    swatch: ["#F4EEDF","#D43B2A"],
    direction: "Data Story: one chart grows through the reel on cream paper. Each scene adds marks (bars, a line, dots) drawn by a red or blue pencil, and a short handwritten note pinned to the number that matters. Red for the story you are telling, blue for the context. One number in focus per scene; the camera moves along the chart.",
    credit: LEMO,
  },
  'data-physical': {
    id: "data-physical",
    name: "Data Objects",
    tagline: "Numbers built as real objects",
    description: "Statistics built as countable objects (plates, blocks, coins, bars) stacked to exact scale on a crafted base, lit like a product shot with long soft shadows; the camera reads a number off one plate and pulls back until the chart is an installation.",
    bestFor: "Money, wealth, budgets, big comparisons, \"how much is a crore\".",
    cues: ["money","rich","wealth","billionaire","salary","cost","gold","coins","savings","debt","lakh"],
    swatch: ["#1A1714","#E8B04B"],
    direction: "Data Objects: every number is a pile of real-looking objects (coins, blocks, plates, bars) stacked to scale on a plinth, studio-lit with soft shadows. Each scene builds or compares one stack and labels it with a crisp number on its edge. Few pieces, big scale differences, slow camera moves along the stacks.",
    credit: LEMO,
  },
  teardown: {
    id: "teardown",
    name: "Exploded Teardown",
    tagline: "A product taken apart in mid-air",
    description: "A real product lit like a studio packshot and taken apart in front of the camera: its layers lift on one axis, the camera travels between them, every part is named with real numbers, and it closes back into one object.",
    bestFor: "Gadgets, phones, cars, chips, batteries, \"what is inside\".",
    cues: ["inside","phone","iphone","battery","camera","gadget","laptop","ev","car","engine","processor","parts","teardown"],
    swatch: ["#111317","#4FA3FF"],
    direction: "Exploded Teardown: one product per reel. Scenes take it apart layer by layer along one axis: each scene lifts one layer and names its parts with thin leader lines and real numbers (mAh, mm, grams). Studio-lit, dark backdrop, precise and calm; the last scene closes it back into one object.",
    credit: LEMO,
  },
  'security-xray': {
    id: "security-xray",
    name: "Security X-ray",
    tagline: "Seen through a baggage scanner",
    description: "Everything is seen as a dual-energy X-ray image: organic orange, mixed green, metal blue, dense black. The operator exists only as actions on screen: a box dragged round an object, a zoom, a measurement, a material filter, a verdict.",
    bestFor: "Airports, smuggling, security, scams, hidden things, \"what is hidden inside\".",
    cues: ["airport","smuggling","customs","scan","hidden","contraband","bag","baggage","drugs","police","fraud"],
    swatch: ["#0A0F14","#FF8A1F"],
    direction: "Security X-ray: every object appears as an X-ray image coloured by material (orange organic, green mixed, blue metal, black dense). Each scene is one operator action on the scanner screen: a selection box round a suspect object, a zoom, a measurement, a filter, a verdict stamp. Monospaced screen labels; tense and precise.",
    credit: LEMO,
  },
  'white-model': {
    id: "white-model",
    name: "Projection Model",
    tagline: "Light painted on a white model",
    description: "A pure white architectural model of a real place on a plinth in a dark room, with a projector painting data onto it as light, one layer at a time. The model never changes; only the light on it does.",
    bestFor: "Cities, urban planning, buildings, real estate, floods, pollution, infrastructure.",
    cues: ["building","smart city","urban","flood","pollution","real estate","housing","skyscraper","planning","infrastructure"],
    swatch: ["#0C0D10","#F2F2EE"],
    direction: "Projection Model: one white massing model of the place on a plinth in a dark room. Each scene projects one layer of light onto it: a heat colour for pollution, blue for water, a moving line for traffic, a highlighted block with a number. The model stays still; the camera circles it slowly; one layer per scene.",
    credit: LEMO,
  },
  'isometric-picture-book': {
    id: "isometric-picture-book",
    name: "Isometric People",
    tagline: "Little people show the rule",
    description: "One real place drawn in true isometric with flat colour: small faceless people do the thing in order while serif type lands on the ground as if painted there. Roofs and walls lift off like paper flaps to show the action.",
    bestFor: "Everyday rules, processes, queues, how a system works for people, civic explainers.",
    cues: ["queue","people","bank","hospital","office","school","voting","citizen","line","form","counter"],
    swatch: ["#F3EEE4","#2E7D6B"],
    direction: "Isometric People: one place drawn in flat isometric (a bank, a station, a street). Small faceless people move through it in order; the order of movement is the explanation. Each scene shows one step: a roof lifts off, a few people move, a short serif label lands on the ground. Calm, clear and friendly.",
    credit: LEMO,
  },
  'lowpoly-island': {
    id: "lowpoly-island",
    name: "Low-poly Island",
    tagline: "A tiny world that grows",
    description: "A small faceted world seen through an isometric lens: everything is a geometric block, and everything that appears arrives with a bounce, tile by tile, from an empty sea to a living village.",
    bestFor: "Growth stories, startups, how something was built, ecosystems, calm explainers.",
    cues: ["grow","village","empire","ecosystem","farm","startup","from zero","founder","journey"],
    swatch: ["#8FD3E8","#F2C14E"],
    direction: "Low-poly Island: one small low-poly world in isometric view that grows through the reel. Each scene adds blocks with a bounce (tiles, trees, houses, a boat, a lighthouse) so the world and the story grow together. Flat shading, warm light, a day turning into night for the turn of the story.",
    credit: LEMO,
  },
  'tilt-shift': {
    id: "tilt-shift",
    name: "Tilt-Shift Miniature",
    tagline: "The real world as a toy model",
    description: "A real-looking place seen from high above with a tilted lens and a time-lapse rhythm, so the whole world reads as a tabletop model: tiny cars, people and trains on a sharp band with soft blur above and below.",
    bestFor: "Cities, festivals, crowds, traffic, stations, \"a day in\" a place.",
    cues: ["crowd","festival","mela","kumbh","day in","stadium","traffic jam","bazaar","mumbai","delhi"],
    swatch: ["#BFD9C9","#E8573A"],
    direction: "Tilt-Shift Miniature: each scene is a high view of a real-looking place with a narrow sharp band and blurred edges, so it looks like a model. Things move in time-lapse (cars, trains, crowds), colours are saturated and toy-like. Put a short label in the sharp band; one place per scene.",
    credit: LEMO,
  },
  'paper-lantern': {
    id: "paper-lantern",
    name: "Paper-cut Lightbox",
    tagline: "Layered paper lit from behind",
    description: "A layered paper-cut shadow box lit from behind: 6 to 9 sheets of cut card in a shallow box, warm light glowing through windows and moons cut in the paper, soft shadows falling from layer to layer.",
    bestFor: "History, mythology, festivals, stories, culture, emotional explainers.",
    cues: ["myth","mythology","diwali","king","temple","legend","ancient","culture","ramayana","mughal","empire","folk"],
    swatch: ["#1E1430","#FFB347"],
    direction: "Paper-cut Lightbox: each scene is a layered paper-cut scene glowing from behind: silhouettes of buildings, people and trees on 6 to 9 layers, windows and moons lit warm. Text sits on a paper strip. The camera drifts slowly between layers; one moment of the story per scene.",
    credit: LEMO,
  },
  'silkscreen-poster': {
    id: "silkscreen-poster",
    name: "Silkscreen Poster",
    tagline: "Flat inks, one layer per beat",
    description: "Opaque, hard-edged flat inks pulled one colour at a time, 4 to 6 inks per poster, stepped colour bands instead of gradients and thin paper gaps where the registration slips. Information is revealed the way the print is made: one layer per beat.",
    bestFor: "Travel, places, tourism, food, culture, sports, bold single-message reels.",
    cues: ["trip","visit","tourism","goa","kerala","ladakh","food","beach","destination","hill station","vacation"],
    swatch: ["#F1E6CF","#E2532D"],
    direction: "Silkscreen Poster: each scene is a bold travel-poster composition in 4 to 6 flat inks with hard edges and stepped colour bands, no gradients. The scene is printed one ink layer per beat; big poster type, one number or name per scene.",
    credit: LEMO,
  },
  'city-symphony': {
    id: "city-symphony",
    name: "City Symphony",
    tagline: "A city cut to music",
    description: "A city film cut like minimalist music: time-lapse turns traffic, crowds and clouds into rivers of light, the cuts get faster with the beat, one thing is slowed almost to a stop, and it ends on a hard cut to black.",
    bestFor: "Cities, rush hour, a day in a city, mood reels, short punchy facts.",
    cues: ["rush hour","local train","night life","lights","commute","skyline","city life","bengaluru","kolkata","chennai"],
    swatch: ["#0B0B12","#FFCF5A"],
    direction: "City Symphony: scenes are short city shots cut on the beat: streaks of traffic light, crowds, trains, clouds, windows lighting up. Cuts get faster as the reel builds, one moment slows almost to a stop, and the reel ends on a hard cut. Minimal text: one short line or number per scene.",
    credit: LEMO,
  },
  telestrator: {
    id: "telestrator",
    name: "Sports Telestrator",
    tagline: "Draw on the replay",
    description: "A TV sports analysis segment: play the moment, rewind, freeze, and draw on the picture: rings under players, arrows for the ball, a red patch for the space nobody covered; switch angles, count the frames and flatten the field into a board.",
    bestFor: "Cricket, football, sports tactics, a famous match moment, athletes.",
    cues: ["cricket","football","ipl","match","wicket","goal","player","kohli","dhoni","team","tactics","world cup"],
    swatch: ["#0F3A22","#FFE14A"],
    direction: "Sports Telestrator: each scene is a frozen or slowed sports moment drawn as a broadcast picture, with analysis drawn on top: rings under players, curved arrows for the ball, a red patch for the gap, a frame counter. A score bar and a corner bug hold it together; a yellow wipe between scenes.",
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
