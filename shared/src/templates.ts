import type { CaptionStyle } from './editor';
import type { WorldTheme } from './projects';

// Templates: the look and feel a reel starts from. A template sets the world's theme, the caption style, and tells
// Claude how to write and stage the script (which objects, how many scenes, how to open and end). The user picks one
// before the topic; everything it sets can still be edited later.

export const TEMPLATE_IDS = ['explainer-3d', 'system-design', 'app-backend', 'night-tech', 'science-lab'] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];
export const DEFAULT_TEMPLATE: TemplateId = 'explainer-3d';

export interface ReelTemplate {
  id: TemplateId;
  name: string;
  /** One line under the name. */
  tagline: string;
  /** Who it is for and what it looks like. */
  description: string;
  /** The ground and sky of the 3D world. */
  theme: WorldTheme;
  /** Caption look; the user can change it in the Reel editor. */
  captions: CaptionStyle;
  /** A topic that suits it, offered as an example. */
  example: string;
  /** What the preview tile shows: three object kinds from the 3D kit, and the flat colours of its ground and accent. */
  preview: { objects: string[]; ground: string; accent: string };
  /** Added to the instructions Claude writes the script from. */
  guidance: string;
}

export const TEMPLATES: Record<TemplateId, ReelTemplate> = {
  'explainer-3d': {
    id: 'explainer-3d',
    name: '3D Explainer',
    tagline: 'How anything works, step by step',
    description: 'The classic Motion Mind look: a bright isometric world, the camera gliding between 3 or 4 objects per scene, a card on top and captions below.',
    theme: 'city',
    captions: { size: 'medium', position: 'bottom', look: 'box' },
    example: 'How does a UPI Soundbox know the money arrived?',
    preview: { objects: ['phone', 'tower', 'bank'], ground: '#F3EFE6', accent: '#14B8A6' },
    guidance: 'Template "3D Explainer": a friendly general explainer. Open with a curious hook, explain in 5 to 8 steps, finish with a one-line payoff. Choose the theme that fits the topic.',
  },
  'system-design': {
    id: 'system-design',
    name: 'System Design',
    tagline: 'Servers, databases and what breaks',
    description: 'For interview-style system design: servers, databases, routers and clouds on a clean lab floor, labelled links showing every request, and every term defined on screen.',
    theme: 'lab',
    captions: { size: 'medium', position: 'bottom', look: 'box' },
    example: 'CAP theorem explained with a bank example',
    preview: { objects: ['server', 'database', 'router'], ground: '#EEF0F8', accent: '#3B82F6' },
    guidance:
      'Template "System Design": write it like a system design interview answer. Use the "lab" theme. Show components as server, database, router, cloud and lock objects, and label every link with the request or data it carries (for example "write", "replicate", "read"). Start with a concrete situation (a bank, an app, a failure), name the idea, then show what happens when something breaks (a server down, a cut cable, a slow network). Define every technical term in "glossary" (node, latency, replica, partition, consistency, availability...). End with a question to the viewer to answer in the comments, and keep the narration crisp.',
  },
  'app-backend': {
    id: 'app-backend',
    name: 'App Backend',
    tagline: 'What happens when you tap the button',
    description: 'Follow one request from the phone through the company\'s systems: real company logos on tiles, servers in between, money or data moving along labelled links.',
    theme: 'city',
    captions: { size: 'medium', position: 'bottom', look: 'box' },
    example: 'IRCTC Tatkal backend: how does it handle lakhs of users?',
    preview: { objects: ['phone', 'server', 'bank'], ground: '#F3EFE6', accent: '#EF4444' },
    guidance:
      'Template "App Backend": follow ONE request from the viewer\'s phone through the real systems behind a well-known app or service. Show the phone first, then each system in order (load balancer or gateway, application server, database, payment network, bank). Put every real company or product on screen as a logo tile (custom prop with "logo") and list each in "brands". Spell out every abbreviation in "glossary". Include real numbers only when the research supports them. The last scene shows the result the user sees (ticket booked, money received).',
  },
  'night-tech': {
    id: 'night-tech',
    name: 'Night Mode',
    tagline: 'Security, AI and late-night tech',
    description: 'A dark world with glowing links and light text, large captions in the middle of the frame. Good for hacking, privacy, AI and space.',
    theme: 'night',
    captions: { size: 'large', position: 'middle', look: 'plain' },
    example: 'How does a hacker steal your OTP?',
    preview: { objects: ['laptop', 'lock', 'shield'], ground: '#2B3350', accent: '#818CF8' },
    guidance: 'Template "Night Mode": a tense, dramatic tone. Use the "night" theme. Show lock, shield, laptop, server and phone objects with links that glow as data moves. Open with a threat or a surprising fact, explain how it works, and end with 1 or 2 clear things the viewer can do to stay safe. Keep sentences short and punchy.',
  },
  'science-lab': {
    id: 'science-lab',
    name: 'Science & Nature',
    tagline: 'Biology, health, energy and the world around us',
    description: 'A soft green world for living things and natural processes: icon tiles for anything the kit has no model for, calm pacing and big readable cards.',
    theme: 'nature',
    captions: { size: 'medium', position: 'bottom', look: 'box' },
    example: 'How does a vaccine train your body?',
    preview: { objects: ['syringe', 'dna', 'heart'], ground: '#E4F0D2', accent: '#22C55E' },
    guidance: 'Template "Science & Nature": a calm, wonder-filled tone. Use the "nature" theme. Prefer the biology and science models (heart, brain, dna, virus, syringe, microscope, flask, sun, solar, windmill) and icon tiles ("glyph") for anything else. Explain cause and effect in small steps, compare with an everyday thing the viewer knows, and finish with why it matters.',
  },
};

/** A saved id that is missing or no longer exists falls back to the default template. */
export function templateOf(id: unknown): ReelTemplate {
  return TEMPLATES[(TEMPLATE_IDS as readonly unknown[]).includes(id) ? (id as TemplateId) : DEFAULT_TEMPLATE];
}
