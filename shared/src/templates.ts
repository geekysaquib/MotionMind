import type { CaptionStyle } from './editor';
import type { WorldTheme } from './projects';

// Templates: the look a reel is staged in. The user picks one after the script and before the storyboard.
// A template sets the 3D world's theme, the look of the header, card and captions, and the default caption style.
// Each is modelled on one kind of explainer reel seen on Instagram (the sample clip next to it shows that reel's
// style); they are Motion Mind's own rendering of that style, not a copy of any reel.

export const TEMPLATE_IDS = ['explainer-3d', 'paper-interview', 'conversation', 'dark-diagram', 'night-3d', 'neon-system'] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];
export const DEFAULT_TEMPLATE: TemplateId = 'explainer-3d';

/** Same shape as ReelLook in the reel engine (the engine does not import this package). */
export interface TemplateLook {
  card: 'box' | 'dark' | 'headline';
  header: 'steps' | 'bar';
  captions: 'box' | 'pill';
  accent?: string;
  ink?: 'light' | 'dark';
  tag?: string;
  /** 'diagram' draws the scene as flat cards joined by arrows instead of the 3D world. */
  scene?: 'iso' | 'diagram';
  diagram?: 'neon' | 'minimal' | 'paper' | 'sticker';
  links?: 'arc' | 'dotted';
  /** The kinds of shot the flat world may stage a scene as, in order of preference (see the engine's shotplan.ts). */
  shots?: ('hero' | 'stat' | 'compare' | 'checklist' | 'ui' | 'tiles' | 'ring' | 'nodes')[];
}

export interface ReelTemplate {
  id: TemplateId;
  name: string;
  tagline: string;
  /** What it looks like and when to use it. */
  description: string;
  /** The ground and sky of the 3D world. */
  theme: WorldTheme;
  look: TemplateLook;
  /** Caption size and position until the Reel editor saves its own. */
  captions: CaptionStyle;
  /** A short clip of the reel style it is modelled on, and a still from it (files in the web app's /templates folder). */
  sample: { video: string; poster: string } | null;
  /** Flat colours for the small preview tile. */
  preview: { ground: string; accent: string; ink: string };
  /** What it does not reproduce from the reel it is modelled on. */
  limits?: string;
}

export const TEMPLATES: Record<TemplateId, ReelTemplate> = {
  'explainer-3d': {
    id: 'explainer-3d',
    name: '3D Explainer',
    tagline: 'Bright isometric world, white card',
    description: 'The classic Motion Mind look: a bright 3D world, the camera gliding between objects, a white card on top and a dark caption box below.',
    theme: 'city',
    look: { card: 'box', header: 'steps', captions: 'box' },
    captions: { size: 'medium', position: 'bottom', look: 'box' },
    sample: null,
    preview: { ground: '#F3EFE6', accent: '#14B8A6', ink: '#1F2430' },
  },
  'paper-interview': {
    id: 'paper-interview',
    name: 'Paper Interview',
    tagline: 'Editorial type on warm paper',
    description: 'A calm paper-coloured page: one big headline with a red highlight word, and the scene drawn as flat white cards with hard black outlines and offset shadows, joined by red marker arrows. Modelled on an interview-prep reel.',
    theme: 'plain',
    look: { card: 'headline', header: 'bar', captions: 'pill', accent: '#E5484D', ink: 'dark', tag: 'Interview', scene: 'diagram', diagram: 'paper', shots: ['hero', 'stat', 'compare', 'checklist', 'ui', 'nodes'] },
    captions: { size: 'small', position: 'bottom', look: 'box' },
    sample: { video: '/templates/paper-interview.mp4', poster: '/templates/paper-interview.jpg' },
    preview: { ground: '#F3EFE9', accent: '#E5484D', ink: '#1F2430' },
    limits: 'The presenter character and its hand-drawn mockups are not reproduced; objects come from the 3D kit.',
  },
  conversation: {
    id: 'conversation',
    name: 'Conversation',
    tagline: 'Two voices, dark room, neon labels',
    description: 'A dark late-night room with lime highlights: slightly tilted cards with lime outlines, dotted curved arrows and sticker-style labels. Fits scripts written as a back-and-forth. Modelled on a two-character chat reel.',
    theme: 'night',
    look: { card: 'dark', header: 'bar', captions: 'pill', accent: '#D6F23A', tag: 'Live chat', scene: 'diagram', diagram: 'sticker', shots: ['hero', 'ui', 'stat', 'compare', 'checklist', 'nodes'] },
    captions: { size: 'medium', position: 'bottom', look: 'box' },
    sample: { video: '/templates/conversation.mp4', poster: '/templates/conversation.jpg' },
    preview: { ground: '#171B33', accent: '#D6F23A', ink: '#F4F6FB' },
    limits: 'The two pixel-art characters and their speaker names are not reproduced.',
  },
  'dark-diagram': {
    id: 'dark-diagram',
    name: 'Dark Diagram',
    tagline: 'Blue-on-navy diagrams, big titles',
    description: 'Deep navy with a faint grid: a centred title with a blue highlight word, quiet tiles with thin blue arrows and solid labels, and a slim caption pill with a progress line. For algorithms, security and "how does the code get made" topics.',
    theme: 'night',
    look: { card: 'headline', header: 'bar', captions: 'pill', accent: '#3B82F6', tag: '@handle', scene: 'diagram', diagram: 'minimal', shots: ['tiles', 'ring', 'stat', 'hero', 'compare', 'nodes'] },
    captions: { size: 'small', position: 'bottom', look: 'box' },
    sample: { video: '/templates/dark-diagram.mp4', poster: '/templates/dark-diagram.jpg' },
    preview: { ground: '#10142A', accent: '#3B82F6', ink: '#F4F6FB' },
    limits: 'Big number tiles and counters (like the rolling 6-digit code) are not drawn; those scenes show the matching icon cards instead.',
  },
  'night-3d': {
    id: 'night-3d',
    name: 'Night 3D World',
    tagline: 'Dark 3D scenery, bold headlines',
    description: 'A night-time 3D world (the objects stay 3D), links drawn as thin dotted lines with a small travelling dot, a thin progress bar, and a large headline with a yellow highlight word and no card. Modelled on a tech-story reel that follows a journey.',
    theme: 'night',
    look: { card: 'headline', header: 'bar', captions: 'pill', accent: '#FACC15', tag: 'Ep 1 · Tech', scene: 'iso', links: 'dotted' },
    captions: { size: 'small', position: 'bottom', look: 'box' },
    sample: { video: '/templates/night-3d.mp4', poster: '/templates/night-3d.jpg' },
    preview: { ground: '#0F1730', accent: '#FACC15', ink: '#F4F6FB' },
  },
  'neon-system': {
    id: 'neon-system',
    name: 'Neon System Design',
    tagline: 'Glowing nodes, labelled requests',
    description: 'A dark board: neon-green glowing node cards (server, database, bank, company logos) joined by labelled arrows with a travelling packet, a segmented progress bar and a "SYSTEM DESIGN" tag. Modelled on a system-design interview reel.',
    theme: 'night',
    look: { card: 'dark', header: 'bar', captions: 'pill', accent: '#34D399', tag: 'System design', scene: 'diagram', diagram: 'neon', shots: ['nodes', 'ui', 'stat', 'compare', 'checklist', 'hero'] },
    captions: { size: 'small', position: 'bottom', look: 'box' },
    sample: { video: '/templates/neon-system.mp4', poster: '/templates/neon-system.jpg' },
    preview: { ground: '#0B1220', accent: '#34D399', ink: '#F4F6FB' },
  },
};

/** A saved id that is missing or no longer exists falls back to the default template. */
export function templateOf(id: unknown): ReelTemplate {
  return TEMPLATES[(TEMPLATE_IDS as readonly unknown[]).includes(id) ? (id as TemplateId) : DEFAULT_TEMPLATE];
}
