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
  const cta = b.platform === 'youtube' ? 'Subscribe karo' : b.platform === 'both' ? 'Follow / Subscribe karo' : 'Follow karo';
  return `You are a world-class motion designer making a premium Instagram Reel for an Indian audience. Write the WHOLE reel as one HyperFrames composition: a single HTML file with CSS, inline SVG and one GSAP timeline. Motion Mind renders it frame by frame at 1080x1920, 30 fps, and adds the voiceover itself. You design and animate everything you see: no templates, no stock assets, no generic shapes. Every scene must SHOW what the narration says at that moment, specific to this topic.

# The reel
Title: ${b.script.title}
Channel: ${b.channelName} (${b.handle})
Language of on-screen text and captions: ${LANG[b.language]}
Total length: ${t.duration.toFixed(2)} s. Story scenes end at ${t.storyEnd.toFixed(2)} s; then an end card (${cta}, the channel name and ${b.handle}) until ${t.duration.toFixed(2)} s.
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

# Maximum quality (this is the most important instruction)
Work at the highest quality you are capable of. Do not save effort, do not shorten, do not simplify, do not leave placeholders. A long, detailed file (up to about 600 KB) is expected. Before you answer, silently check every scene against this list and fix what fails:
- Every scene has a hero illustration with real detail: at least 15 distinct SVG/CSS shapes per scene, with linear and radial gradients, soft shadows, inner highlights, glows, rounded corners, strokes of varied weight and subtle texture or noise (SVG filters are allowed). No flat clip-art, no plain rectangles-and-circles, no emoji as graphics.
- Objects are specific and accurate to the topic: a phone shows the real app screen with believable UI (status bar, cards, buttons, numbers); a server rack has blinking lights; a map has roads, blocks and labels; a ticket has the printed layout. Use the facts and numbers from the narration on screen.
- Depth: layered parallax (background, midground, foreground), light and shadow, atmospheric gradients, floating particles from a seeded generator, light sweeps, blur-in/out on entrances (filter: blur animated with GSAP).
- A single design system declared once in :root CSS variables (colours, radii, shadows, type scale) and used everywhere, so the whole reel looks like one authored piece.
- Motion craft: anticipation before a move, overshoot and settle, follow-through, staggered entrances (40–80 ms apart), eased counters, draw-on lines, travelling highlights. Use expressive eases (power3, expo, back, elastic with restraint). Every scene has a designed entrance and a designed exit or match-move into the next.
- Polish: crisp alignment on a grid, consistent margins, strong contrast (text always readable on its background), no overlapping or clipped text, nothing cut off at the edges, nothing left half-drawn, a clear focal point in every scene.
- The end card is as well designed as the story scenes.

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
4. Each scene is a <section class="clip" data-start="START" data-duration="LENGTH" data-track-index="0"> using the scene's start and (end − start) from the list above (the end card too). Elements outside a clip's time are hidden by the runtime. A .clip is position:absolute; inset:0. Overlays that span the whole reel (captions layer, progress bar) get class="clip" data-start="0" data-duration="${t.duration.toFixed(2)}" data-track-index="1".
5. One GSAP timeline, created paused, with every tween placed at absolute times (position parameter in seconds), then registered: window.__timelines = window.__timelines || {}; const tl = gsap.timeline({ paused: true }); ... ; window.__timelines["main"] = tl; Child timelines added to it must NOT be paused. Use repeat on looping idle motion (pings, floating) only inside the scene's time span.
6. Deterministic: no Math.random (use a seeded function), no Date, no fetch, no timers, no requestAnimationFrame, no CSS animations or transitions (GSAP only), no video or audio elements. The page must look right at any time it is seeked to.

Answer with only the complete HTML file in one \`\`\`html code block, nothing else.`;
}
