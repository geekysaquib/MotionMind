import type { Project } from '@motionmind/shared';

/** The tabs of a project, in order. `path` matches the route under /app/projects/:id. */
export const STAGE_INFO = [
  { path: '', label: 'Topic', title: 'Pick the topic', why: 'Say what the reel should explain. A clear question makes every later step better.', tip: 'Ask “how does X work?” rather than naming a broad subject.' },
  { path: 'research', label: 'Research', title: 'Check the facts', why: 'Find how the topic really works, with sources. Approve it before the script is written from it.', tip: 'Look at facts marked “estimate” or “conflicting” before you approve.' },
  { path: 'graphics', label: 'Style', title: 'Pick a style', why: 'Choose the look first: a live city map, a whiteboard, a dark keynote stage, a metro map or a newsroom. Claude then designs every scene of the script for that style.', tip: 'Pick a different style from your last reel so your feed does not look the same every time.' },
  { path: 'script', label: 'Script', title: 'Write the script', why: 'A hook, the explanation in steps, and a short payoff. Claude designs each scene for your style: what is on screen and when it appears.', tip: 'Short sentences read better aloud. 7 to 11 scenes suits a 45 to 60 second reel.' },
  { path: 'voice', label: 'Voice', title: 'Record your voice', why: 'Read the script, or paste it into a text-to-speech tool, and upload the recording. Motion Mind finds where every scene starts and when every word is spoken, so the animation lands on your voice.', tip: 'Finish the wording first: if you change a narration line after recording, fit the script again.' },
  { path: 'storyboard', label: 'Storyboard', title: 'Shape every scene', why: 'Polish the card and the picture of each scene: steps, numbers that count up, items or a note, plus short forms and brands. Changing a narration line here after you recorded needs a new fit.', tip: 'Give scenes different pictures: a number, then steps, then a list keeps the reel moving.' },
  { path: 'animate', label: 'Animate', title: 'Let Claude animate it', why: 'Copy the prompt into claude.ai. Claude writes the whole reel as an animation, timed to your voice, in your style. Paste its answer back and watch it.', tip: 'If the voice changes later, copy the prompt again so Claude re-times it.' },
  { path: 'export', label: 'Export', title: 'Make the video', why: 'Render the 1080 × 1920 MP4 and download it.', tip: 'The first export is slower while the renderer gets ready.' },
] as const;

/** Which of the steps already has something in it. */
export function stageDone(p: Project): boolean[] {
  const hasScript = Boolean(p.script);
  return [
    Boolean(p.topic?.trim()),
    Boolean(p.research),
    Boolean(p.script?.style),
    hasScript,
    Boolean(p.editor?.upload),
    // The storyboard is optional: it counts once the script was edited or the next step was started.
    Boolean(p.script?.editedAt || p.script?.animation),
    Boolean(p.script?.animation),
    p.status === 'completed' || p.stage === 'final',
  ];
}

/** 0 to 1: how many of the steps are done. */
export function progressOf(p: Project): number {
  const d = stageDone(p);
  return d.filter(Boolean).length / d.length;
}

/** The first step that is not done yet: where "Continue" should take you. */
export function nextStage(p: Project) {
  const d = stageDone(p);
  const i = d.findIndex((x) => !x);
  return STAGE_INFO[i === -1 ? STAGE_INFO.length - 1 : i]!;
}
