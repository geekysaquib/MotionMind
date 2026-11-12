import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STYLES, styleOf, type ReelScript, type ReelTimeline, type StyleId } from '@motionmind/shared';

// The Animate prompt: everything claude.ai needs to write the whole reel as one HyperFrames composition
// (HTML + CSS + a seekable GSAP timeline), timed to the voice, in the chosen style.

const here = path.dirname(fileURLToPath(import.meta.url));

/** The style's full rulebook (lemo-opuscar rulebooks are MIT, LemoLab; Live Map is Motion Mind's own). */
export function rulebook(style: StyleId): string {
  try {
    return readFileSync(path.join(here, 'rulebooks', `${style}.md`), 'utf8');
  } catch {
    return STYLES[style].description;
  }
}

/** The GSAP build the composition must load (the renderer and the preview swap it for a local copy). */
export const GSAP_URL = 'https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/gsap.min.js';

export interface AnimationBrief {
  script: ReelScript;
  timeline: ReelTimeline;
  style?: StyleId | null;
  channelName: string;
  handle: string;
  language: 'en' | 'hi' | 'hinglish';
  /** Where company logos can be loaded from, like http://localhost:8787/api/logo/irctc.co.in */
  logoBase: string;
  platform: 'instagram' | 'youtube' | 'both';
}

const LANG: Record<AnimationBrief['language'], string> = { en: 'English', hi: 'Hindi (Devanagari)', hinglish: 'Hinglish (Latin script)' };

export function animationPrompt(b: AnimationBrief): string {
  const st = styleOf(b.style);
  const t = b.timeline;
  const scenes = t.scenes.map((s) => {
    const beat = b.script.beats[s.index]!;
    return {
      scene: s.index + 1,
      start: s.start,
      end: s.end,
      step: beat.chapter > 0 ? b.script.steps[beat.chapter - 1] ?? '' : 'Hook',
      eyebrow: beat.card.eyebrow,
      headline: beat.card.headline,
      rows: beat.card.rows,
      narration: s.narration,
      words: s.words.map((w) => [w.w, w.start, w.end]),
    };
  });
  return `You are a world-class motion designer making a premium Instagram Reel for an Indian audience. Write the WHOLE reel as one HyperFrames composition: a single HTML file with CSS, inline SVG and one GSAP timeline. Motion Mind renders it frame by frame at 1080x1920, 30 fps, and adds the voiceover itself. You design and animate everything you see: no templates, no stock assets, no generic shapes. Every scene must SHOW what the narration says at that moment, specific to this topic.

# The reel
Title: ${b.script.title}
Channel: ${b.channelName} (${b.handle})
Language of on-screen text and captions: ${LANG[b.language]}
Total length: ${t.duration.toFixed(2)} s. Story scenes end at ${t.storyEnd.toFixed(2)} s; after that Motion Mind shows its own end card until ${t.duration.toFixed(2)} s (you do not make it).
Timing source: ${t.source === 'estimate' ? 'ESTIMATED (no voice yet)' : 'the real voiceover'}. Times are seconds from the start of the video.
Short forms: ${JSON.stringify(b.script.glossary ?? [])}
Brands: ${JSON.stringify(b.script.brands ?? [])} — a brand's logo is an <img> from ${b.logoBase}/api/logo/<domain>?name=<name> (for example ${b.logoBase}/api/logo/irctc.co.in?name=IRCTC); keep it on a white rounded tile.

Scenes (words = [word, start, end]; animate each thing as its word is spoken):
${JSON.stringify(scenes)}

# The style: ${st.name}
${st.description}
Follow this style rulebook. It was written for landscape films and sometimes for other languages; keep its look, colour logic, type, motion and native moves, but lay everything out for a 1080x1920 vertical phone screen and write all text in the reel's language. Ignore anything about its own engine or demo.

<rulebook>
${rulebook(st.id)}
</rulebook>

# How to work (follow this order)
1. PLAN FIRST, briefly, in plain text before the code (no more than about 250 words in total): the look in one sentence (palette with hex values, two fonts, corner radius, shadow style); then for each scene ONE line that names the hero visual and 3 to 5 beats, each beat tied to a spoken word and its time from the list above (for example: "2.4 s 'tower': the phone connects to a tower, a ring pulses"). Every beat is a visual event that shows what that word means, so the picture explains the narration and is never decoration.
2. THEN write the complete HTML in ONE code block (rules at the end).
3. Never stop early, never write "...", "rest similar" or "same as above". If you are running out of room, simplify decoration, never structure. Aim for roughly 80 to 180 KB of HTML: get the richness from code, not from repeated markup (see the drawing kit).

# Maximum quality (this is the most important instruction)
Work at the highest quality you are capable of, as a senior motion designer would for a paying client. A viewer should think a studio made this. Check every scene against this list before you answer, and fix what fails:
- DRAWING KIT. At the top of your script write small JavaScript helper functions that build detailed inline SVG/HTML objects from parameters, then reuse them in every scene: for example phone(screenHtml), card(), glassPanel(), chip(label), serverRack(n), personQueue(n), trainCoach(), ticket(), mapBlock(), arrow(from, to), pulseRing(), ledRow(). Each helper draws its object with real detail: layered gradients, soft shadows, inner highlights, bevels, glass and blur, small UI text, lights. Detail comes from code, so the file stays small and every scene looks authored by the same hand.
- A hero illustration in every scene: at least 15 distinct shapes with linear and radial gradients, soft shadows, glows and subtle texture or noise. No flat clip-art, no plain rectangles and circles, no emoji as graphics.
- Objects are specific to the topic and accurate: a phone shows the real app screen with believable UI (status bar, cards, buttons, numbers from the narration); a server rack has blinking lights; a map has roads, blocks and labels; a ticket has the printed layout. Facts and numbers from the narration appear on screen.
- Depth and light: background, midground and foreground layers that move at different speeds (parallax), a key light and a soft shadow under every object, ambient gradient glows, vignette, fine film grain, floating dust or particles from a seeded generator (at most 60 particles), light sweeps across glass.
- Camera: the graphics layer has one 2.5D camera: push in, pan, tilt with perspective (CSS perspective with small rotateX or rotateY on panels is allowed). Smooth eased moves, never shaky, and still while text is being read.
- Pacing: something new happens at least every 0.8 to 1.2 seconds. The first 1.5 seconds is a strong hook image. The last scene lands the point before the end card.
- Motion craft: anticipation before a move, overshoot and settle, follow-through, staggered entrances 40 to 80 ms apart, eased counters, draw-on lines, travelling highlights, blur-in on entrances. Use expressive eases (power3, expo, back, elastic with restraint). Every scene has a designed entrance and a designed exit or a match-move into the next.
- One design system declared once in :root CSS variables (colours, radii, shadows, type scale) and used everywhere, so the whole reel is one coherent piece. Use at most two fonts and a consistent type scale.
- Polish: crisp alignment on a grid, consistent margins, strong contrast, a clear focal point in every scene, no clutter (if a scene has more than one idea, split the idea over two beats instead of crowding it).
- Performance: the renderer captures frames in Chrome, so avoid animating huge blurs or SVG filters over the full screen, avoid more than about 60 animated elements at once, and prefer transform and opacity.

# Quality bar (premium, not a slideshow)
- A designed piece for every scene: real objects of the topic (phones with the actual app screen, servers, queues of people, tickets, money, maps, trains...) drawn in inline SVG/CSS in the style, with depth, light and shadow. Vary the composition scene to scene.
- Motion with intent: things enter on their spoken word with eased, overshooting moves; arrows draw on; packets travel; numbers count up; the camera (a wrapper around the GRAPHICS layer only, see below) pushes, pans and glides; transitions between scenes are designed (wipes, match moves, whips), never hard cuts or plain fades. Graphics are never fully still (pings, floating, slow drift), but TEXT is.

# Text must be rock steady (a reel with moving text looks broken)
Text that shifts by even one pixel from one frame to the next looks like jitter. So:
- Text never drifts, bobs, floats, wobbles, breathes or scales continuously. A text element may ENTER (fade, slide, pop) and may EXIT, and between those two it must not move at all. No idle or looping animation on any text.
- The camera holds completely still whenever the viewer has to read something, and moves only in deliberate, smooth, eased moves between beats (slow constant drifts under text are not allowed). Labels that belong to the world (map names, station names) may travel with a deliberate camera move; headlines, numbers and captions never do.
- Keep every piece of text OUT of the moving camera. Put the graphics in a layer you may scale, pan or float; put all headlines, labels, numbers and captions in a separate static layer above it, with no transform on the layer or on its parents once the entrance is done.
- Captions must never change layout. For each caption chunk, lay out ALL of its words at once in a fixed box (position:absolute; fixed left, top and width; text-align and white-space:nowrap set once; one line or fixed line breaks) and reveal or highlight words only by changing opacity or colour. Never add or remove words from the flow, never change font-size, font-weight, letter-spacing, padding or margin of a word, and never scale a word: those reflow the line and move every other word. The next chunk replaces the previous one in exactly the same box.
- Do not centre a line whose content changes width. Fix the box width and place it once.
- Position text with whole pixels (left/top in integer px, or GSAP x/y that end on integers). Do not animate text with fractional values at rest, no percent transforms on text, no skew, no rotation of text unless it is static.
- Use one font file family per role, load Google Fonts with &display=block, and set font-kerning:normal, text-rendering:geometricPrecision, -webkit-font-smoothing:antialiased. Give every text box an explicit width so that a late font load cannot re-wrap it.
- Typography is big and readable on a phone: headlines 72–110 px, labels ≥ 32 px, captions ≥ 56 px. Keep text inside x 60–1020 and leave the top 120 px and bottom 260 px free of anything important (app buttons cover them).
- Captions are part of the design: show the narration words in short chunks (3–5 words) in the style's caption look, each word highlighted exactly between its start and end time, keywords in the accent. Highlight by colour or opacity only, in a fixed box (see the rock-steady rules).
- CAPTION TIMING IS EXACT, AND GENERATED BY CODE. Copy the words list of every scene verbatim into your script as one array (const WORDS = [["word", start, end], ...] for the whole reel, in order, the numbers exactly as given above). Build the caption elements and every caption tween with a loop over that array, placing each at its absolute time on the timeline (for example tl.set(el, {opacity: 1}, start) and tl.set(el, {opacity: 0}, end) or a highlight tween at start and end). Never type caption times by hand, round them, shift them, or add your own delay or easing offset: a caption word is highlighted at its start and not a frame later. Chunks change at the start of their first word and end at the end of their last word.
- Headline per scene (the card's headline, *starred* words highlighted) and the step progress, styled per the rulebook.
- Indian context: ₹, lakh/crore, Indian apps, places and everyday moments, as in the script.

# The end card is NOT yours to make
Motion Mind adds its own end card (the handle and the follow buttons) from ${t.storyEnd.toFixed(2)} s to the end, on top of everything. So:
- Do not draw any end card, outro, follow or subscribe screen, handle, or call to action. Your last story scene ends at ${t.storyEnd.toFixed(2)} s and you put no clip after it.
- In the last 0.4 s of the last scene, design an exit: the scene's content clears away (fades, slides or zooms out) to a plain dark background, so the end card can take over cleanly. Overlays that span the reel (captions, progress bar) end at ${t.storyEnd.toFixed(2)} s too: give them data-duration="${t.storyEnd.toFixed(2)}".
- The root keeps data-duration="${t.duration.toFixed(2)}".
- Put this exact comment as the first line inside <body>, so Motion Mind knows to add the card: <!-- motionmind:no-end-card -->

# Layout rules (nothing may overlap; Motion Mind measures this)
Motion Mind opens your file in Chrome and measures every text box across the timeline. Text that overlaps other text, hides under a panel, or runs out of its box is reported as an error and sent back to you, so get it right the first time.
- Build every scene as a layout, not a pile of absolutely positioned boxes. Put the scene's content in one container (position:absolute; left:60px; right:60px; top:140px; bottom:280px) with display:flex or grid, flex-direction:column and a gap, and let panels, headings and rows flow inside it. A panel's height comes from its content (padding + rows): never give a panel a fixed height, and never place two panels at absolute positions whose rectangles overlap.
- Do the arithmetic in a comment for each scene: list every block with its height, add the gaps, and check the total fits the container (about 1,500 px tall). If it does not fit, remove rows (at most 5 rows per panel, at most 6 text blocks per scene) or shrink sizes. Long text wraps inside its box: give every text box an explicit width, and make sure the box is tall enough for the wrapped lines.
- Two things never share the same space at the same time. If panel B replaces panel A in the same area, A must be completely gone (opacity 0 and visibility hidden) before B starts to appear; never cross-fade two text panels on top of each other. Anything stacked on purpose (a badge on a corner of a card) must sit inside the card's own box with room around it.
- Text on a picture or a busy graphic sits on its own solid or blurred panel (a scrim), never directly over other text or over lines and shapes that make it hard to read.
- Changing numbers and scramble or decode effects (counters, ticking values, "decoding" digits) live in their own fixed-width cells: font-variant-numeric: tabular-nums, white-space: nowrap, one inline-block cell per character with a fixed width, overflow hidden. The old and new characters are never stacked in the same cell, and the final value is the only thing left on screen when the effect ends.
- Nothing may be cut off by the screen edge or by its container (no clipped words, no half-visible panels at rest); everything stays inside x 60–1020 and y 120–1660 once it has entered.
- Before you answer, walk through every scene at its busiest moment: list the rectangles of every text block, and confirm no two overlap and none is covered. Fix what fails.

# HyperFrames rules (the render fails without these)
1. One file. Start with <!doctype html>. In <head>: <meta charset="UTF-8">, <meta name="viewport" content="width=1080, height=1920">, and exactly this script: <script src="${GSAP_URL}"></script>. You may load Google Fonts with <link>; no other external files, images or scripts (logos only from the URL above).
2. html, body: margin 0, width 1080px, height 1920px, overflow hidden, a background colour.
3. Root: <div id="root" data-composition-id="main" data-start="0" data-duration="${t.duration.toFixed(2)}" data-width="1080" data-height="1920"> holding everything.
4. Each scene is a <section class="clip" data-start="START" data-duration="LENGTH" data-track-index="0"> using the scene's start and (end − start) from the list above. Elements outside a clip's time are hidden by the runtime. A .clip is position:absolute; inset:0. Overlays that span the story (captions layer, progress bar) get class="clip" data-start="0" data-duration="${t.storyEnd.toFixed(2)}" data-track-index="1".
5. One GSAP timeline, created paused, with every tween placed at absolute times (position parameter in seconds), then registered: window.__timelines = window.__timelines || {}; const tl = gsap.timeline({ paused: true }); ... ; window.__timelines["main"] = tl; Child timelines added to it must NOT be paused. Use repeat on looping idle motion (pings, floating) only inside the scene's time span.
6. Deterministic: no Math.random (use a seeded function), no Date, no fetch, no timers, no requestAnimationFrame, no CSS animations or transitions (GSAP only), no video or audio elements. The page must look right at any time it is seeked to.

Answer in this order: first the short plan (plain text), then the complete HTML file in ONE \`\`\`html code block, then nothing else. If your answer is cut off before </html>, I will say "continue": then carry on exactly where you stopped, inside a new \`\`\`html block, without repeating anything.`;
}
