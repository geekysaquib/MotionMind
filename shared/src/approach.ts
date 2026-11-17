// How a reel explains its topic. The creator picks one on the Research or Script step; it shapes what research looks
// for and how the script is built. Kept in the browser per project (frontend lib/pickedApproach.ts) and sent with the
// prompt routes as ?approach=.

export const APPROACH_IDS = ['facts-examples', 'facts', 'concept', 'theory', 'story'] as const;
export type ApproachId = (typeof APPROACH_IDS)[number];
export const DEFAULT_APPROACH: ApproachId = 'facts-examples';

export interface Approach {
  id: ApproachId;
  label: string;
  /** One line for the picker. */
  hint: string;
  /** What research should look for. */
  research: string;
  /** How the script is built. */
  script: string;
}

export const APPROACHES: Record<ApproachId, Approach> = {
  'facts-examples': {
    id: 'facts-examples',
    label: 'Facts with examples',
    hint: 'Each fact made real with an everyday Indian example.',
    research: 'For every key fact, also find a concrete real-world example or case (ideally Indian: a company, a city, a price, an incident) that shows it in action.',
    script: 'Facts with examples: every fact is followed straight away by a short, concrete example the viewer knows (an Indian app, a place, an amount, a moment from daily life). Fact, then example, beat after beat.',
  },
  facts: {
    id: 'facts',
    label: 'Just the facts',
    hint: 'Fast and punchy: one hard fact or number per scene.',
    research: 'Find many hard, specific, checkable facts: numbers, dates, names, records and comparisons. Prefer surprising ones.',
    script: 'Just the facts: a fast run of hard facts and numbers, one per beat, each one surprising or useful. No examples or analogies unless a number needs one to be understood.',
  },
  concept: {
    id: 'concept',
    label: 'Concept explained',
    hint: 'One idea made simple with an analogy, for beginners.',
    research: 'Find the core idea behind the topic, the simplest correct way to explain it, a good everyday analogy for it, and the most common misunderstanding.',
    script: 'Concept explained: build one clear mental model. Start from what the viewer already knows, introduce the idea with an everyday analogy, then map the analogy back to the real thing step by step, and clear up the common misconception. No jargon without a plain explanation.',
  },
  theory: {
    id: 'theory',
    label: 'Theory in depth',
    hint: 'How and why it works underneath: the mechanism, step by step.',
    research: 'Find how it works underneath: the mechanism, the underlying principle or law, each step in order, the key terms, and any formula or rule that governs it, from authoritative sources.',
    script: 'Theory in depth: explain the mechanism underneath in order, one step per beat, naming the principle behind it and the key terms (each explained once in plain words). Go one level deeper than a casual explainer, but stay accurate and easy to follow.',
  },
  story: {
    id: 'story',
    label: 'Story led',
    hint: 'A real event or person told as a story, the facts woven in.',
    research: 'Find the real story: who was involved, what happened in order with dates, the turning point, and how it ended or what it changed, with sources for each event.',
    script: 'Story led: tell it as a real story with a beginning, a turning point and a payoff. Open on a moment of tension, move through events in order, weave the facts and numbers into the story, and end on what it means for the viewer.',
  },
};

export const approachOf = (id: string | null | undefined): Approach =>
  APPROACHES[(APPROACH_IDS as readonly string[]).includes(id ?? '') ? (id as ApproachId) : DEFAULT_APPROACH];
