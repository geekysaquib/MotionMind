import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STYLES, styleOf, type ReelScript, type ReelTimeline, type StyleId } from '@motionmind/shared';
import { CAPTION_BAND, NO_CAPTIONS_MARKER } from '../animation/captions';

// The Animate prompt: everything claude.ai needs to write the whole reel as one HyperFrames composition
// (HTML + CSS + a seekable GSAP timeline), timed to the voice, in the chosen style.

const here = path.dirname(fileURLToPath(import.meta.url));

/** The style's full rulebook (most adapted from Lemo-Opuscar by LemoLab, CC BY-NC 4.0 with its permission to adapt for your own films; the rest are Motion Mind's own). */
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
      picture: beat.picture ?? '',
      words: s.words.map((w) => [w.w, w.start, w.end]),
    };
  });
  const TEXT_BOTTOM = CAPTION_BAND.top - 20;
  return `You are a world-class motion designer making a premium Instagram Reel for an Indian audience. Write the WHOLE reel as one HyperFrames composition: a single HTML file with CSS, inline SVG and one GSAP timeline. Motion Mind renders it frame by frame at 1080x1920, 30 fps, and adds the voiceover itself. You design and animate everything you see: no templates, no stock assets, no generic shapes. Every scene must SHOW what the narration says at that moment, specific to this topic.

# The reel
Title: ${b.script.title}
Channel: ${b.channelName} (${b.handle})
Language of on-screen text: ${LANG[b.language]}
Total length: ${t.duration.toFixed(2)} s. Story scenes end at ${t.storyEnd.toFixed(2)} s; after that Motion Mind shows its own end card until ${t.duration.toFixed(2)} s (you do not make it).
Timing source: ${t.source === 'estimate' ? 'ESTIMATED (no voice yet)' : 'the real voiceover'}. Times are seconds from the start of the video.
Short forms: ${JSON.stringify(b.script.glossary ?? [])}
Brands: ${JSON.stringify(b.script.brands ?? [])} — a brand's logo is an <img> from ${b.logoBase}/api/logo/<domain>?name=<name> (for example ${b.logoBase}/api/logo/irctc.co.in?name=IRCTC); keep it on a white rounded tile.
People: ${JSON.stringify(b.script.people ?? [])} — a person's real photo is an <img> from ${b.logoBase}/api/person/<wiki title, URL-encoded> (for example ${b.logoBase}/api/person/Jensen%20Huang). Show it whenever the narration names or talks about that person: in a rounded or circular frame with a thin border and soft shadow, object-fit: cover, object-position: 50% 20% (faces sit near the top), at least 260 px wide, with their name and role in a label under it. Never draw a real person as a cartoon or silhouette when their photo is available.

Scenes (picture = what the viewer must SEE, written by the scriptwriter: build exactly that, then go further; words = [word, start, end]; animate each thing as its word is spoken):
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

# Rules for every style (these apply whatever the rulebook says)
- SMOOTH TRANSITIONS, BUILT INTO THE CLIPS. A clip is only visible during its own time, so a transition needs both scenes on screen at once. Give every scene clip except the first data-start = (scene start − 0.6) and data-duration = (scene end − that start), so it overlaps the end of the previous scene by 0.6 s. In that overlap: the old scene's text exits first (0.25 s), then the new scene's graphics come in over the old ones with a designed move (a match move where the hero carries over, a camera push through, a wipe or mask reveal in the style's colours, a zoom from a detail), eased with power2.inOut or expo.inOut. The new scene's text enters only after its scene start. Never a hard cut, a blank or black frame, a plain cross-fade of two busy scenes, or an element popping in or out without an ease.
- REAL LOGOS. Every company, app or government body named on screen shows its real logo, as the <img> from the logo URL above (on a white rounded tile, sized 72 to 140 px, never stretched: width and height equal, object-fit: contain). Never draw a company logo yourself from shapes or letters, and never use a different company's logo.
- FLAGS. A country's flag is drawn as accurate inline SVG: the right colours, stripe order and proportions (India 3:2 saffron #FF9933, white, green #138808, with the navy 24-spoke Ashoka Chakra; USA 13 stripes with the blue canton of stars; China red with five yellow stars). Never use emoji for flags or icons: the renderer has no emoji font and shows letters instead.
- ICONS AND IMAGES. Icons are clean inline SVG paths in one consistent stroke width and corner style, centred in their box and never cut off. Every object is drawn with care and recognisable at a glance: a chip has its pins and die, a phone has a real-looking app screen, a server has its lights. No placeholder boxes, no question-mark or broken images, no generic blobs.
- PEAK DETAIL IN EVERY FRAME. Pause on any frame and it should look like a finished poster from a top studio:
  - A hero illustration of at least 25 shapes, with layered gradients, a highlight edge, an inner shadow and a soft cast shadow on the ground.
  - Two or three supporting objects that add context (the place, the people, the device, the document) and micro-details on every object: small UI text, screws, seams, LEDs, reflections, tick marks, legends.
  - Three depth layers (a background with texture or a soft scene, a midground with the hero, a foreground with particles, light rays or a blurred element), one key light and ambient glow.
  - Labels and callouts with the real numbers and names from the narration, joined to what they describe by thin leader lines.
  - No near-empty frames, no frame where only text is on screen, no plain flat background, and no element that looks unfinished, cut off or low resolution. If a frame feels thin, add detail to the hero and its surroundings, not more text.
- NO OVERLAP, OF TEXT OR OF PICTURES. Plan every scene as named slots before you draw: write in a comment each slot's rectangle (x, y, width, height) for the hero, every supporting object, every logo, every person photo, every panel and every text block. No two slot rectangles intersect (keep at least 32 px between them), except a deliberate badge placed inside its parent's rectangle. A picture never covers another picture's important part (a face, a logo, a number), and nothing is hidden behind something else by accident. During the 0.6 s transition overlap the old and new scenes may cross, but their text never does.
- FILL THE WHOLE REEL. The scenes run to ${t.storyEnd.toFixed(2)} s; every second has something designed on screen, with no stretch where nothing happens.

# Captions are Motion Mind's, not yours
Motion Mind adds the spoken-word captions itself, timed to the voice word by word, in a band from y ${CAPTION_BAND.top} to y ${CAPTION_BAND.top + CAPTION_BAND.height} across the full width. So:
- Make NO captions, subtitles or karaoke text of the narration anywhere.
- Keep that band free of text and of anything important: only background, ambient light or the bottom of a large graphic may pass behind it. All your text stays above y ${TEXT_BOTTOM}.
- Put this exact comment inside <body>, next to the end-card comment: <!-- ${NO_CAPTIONS_MARKER} -->

# Text must be rock steady (a reel with moving text looks broken)
Text that shifts by even one pixel from one frame to the next looks like jitter. So:
- Text never drifts, bobs, floats, wobbles, breathes or scales continuously. A text element may ENTER (fade, slide, pop) and may EXIT, and between those two it must not move at all. No idle or looping animation on any text.
- The camera holds completely still whenever the viewer has to read something, and moves only in deliberate, smooth, eased moves between beats (slow constant drifts under text are not allowed). Labels that belong to the world (map names, station names) may travel with a deliberate camera move; headlines, numbers and captions never do.
- Keep every piece of text OUT of the moving camera. Put the graphics in a layer you may scale, pan or float; put all headlines, labels, numbers and captions in a separate static layer above it, with no transform on the layer or on its parents once the entrance is done.
- Do not centre a line whose content changes width. Fix the box width and place it once.
- Position text with whole pixels (left/top in integer px, or GSAP x/y that end on integers). Do not animate text with fractional values at rest, no percent transforms on text, no skew, no rotation of text unless it is static.
- Use one font file family per role, load Google Fonts with &display=block, and set font-kerning:normal, text-rendering:geometricPrecision, -webkit-font-smoothing:antialiased. Give every text box an explicit width so that a late font load cannot re-wrap it.
- Typography is big and readable on a phone: headlines 72–110 px, labels ≥ 32 px, numbers on panels ≥ 48 px. Keep text inside x 60–1020 and y 120–${TEXT_BOTTOM}; the top 120 px and the bottom 260 px are covered by the app buttons.
- Headline per scene (the card's headline, *starred* words highlighted) and the step progress, styled per the rulebook.
- Indian context: ₹, lakh/crore, Indian apps, places and everyday moments, as in the script.

# The end card is NOT yours to make
Motion Mind adds its own end card (the handle and the follow buttons) from ${t.storyEnd.toFixed(2)} s to the end, on top of everything. So:
- Do not draw any end card, outro, follow or subscribe screen, handle, or call to action. Your last story scene ends at ${t.storyEnd.toFixed(2)} s and you put no clip after it.
- In the last 0.4 s of the last scene, design an exit: the scene's content clears away (fades, slides or zooms out) to a plain dark background, so the end card can take over cleanly. Overlays that span the reel (a progress bar) end at ${t.storyEnd.toFixed(2)} s too: give them data-duration="${t.storyEnd.toFixed(2)}".
- The root keeps data-duration="${t.duration.toFixed(2)}".
- Put this exact comment as the first line inside <body>, so Motion Mind knows to add the card: <!-- motionmind:no-end-card -->

# Layout rules (nothing may overlap; Motion Mind measures this)
Motion Mind opens your file in Chrome and measures every text box across the timeline. Text that overlaps other text, hides under a panel, or runs out of its box is reported as an error and sent back to you, so get it right the first time.
- Build every scene as a layout, not a pile of absolutely positioned boxes. Put the scene's content in one container (position:absolute; left:60px; right:60px; top:140px; height:${TEXT_BOTTOM - 140}px) with display:flex or grid, flex-direction:column and a gap, and let panels, headings and rows flow inside it. A panel's height comes from its content (padding + rows): never give a panel a fixed height, and never place two panels at absolute positions whose rectangles overlap.
- Do the arithmetic in a comment for each scene: list every block with its height, add the gaps, and check the total fits the container (${TEXT_BOTTOM - 140} px tall). If it does not fit, remove rows (at most 5 rows per panel, at most 6 text blocks per scene) or shrink sizes. Long text wraps inside its box: give every text box an explicit width, and make sure the box is tall enough for the wrapped lines.
- Two things never share the same space at the same time. If panel B replaces panel A in the same area, A must be completely gone (opacity 0 and visibility hidden) before B starts to appear; never cross-fade two text panels on top of each other. Anything stacked on purpose (a badge on a corner of a card) must sit inside the card's own box with room around it.
- Text on a picture or a busy graphic sits on its own solid or blurred panel (a scrim), never directly over other text or over lines and shapes that make it hard to read.
- Changing numbers and scramble or decode effects (counters, ticking values, "decoding" digits) live in their own fixed-width cells: font-variant-numeric: tabular-nums, white-space: nowrap, one inline-block cell per character with a fixed width, overflow hidden. The old and new characters are never stacked in the same cell, and the final value is the only thing left on screen when the effect ends.
- Nothing may be cut off by the screen edge or by its container (no clipped words, no half-visible panels at rest); everything stays inside x 60–1020 and y 120–${TEXT_BOTTOM} once it has entered (graphics may extend behind the caption band, text never).
- Before you answer, walk through every scene at its busiest moment: list the rectangles of every text block, and confirm no two overlap and none is covered. Fix what fails.

# HyperFrames rules (the render fails without these)
1. One file. Start with <!doctype html>. In <head>: <meta charset="UTF-8">, <meta name="viewport" content="width=1080, height=1920">, and exactly this script: <script src="${GSAP_URL}"></script>. You may load Google Fonts with <link>; no other external files, images or scripts (logos only from the URL above).
2. html, body: margin 0, width 1080px, height 1920px, overflow hidden, a background colour.
3. Root: <div id="root" data-composition-id="main" data-start="0" data-duration="${t.duration.toFixed(2)}" data-width="1080" data-height="1920"> holding everything.
4. Each scene is a <section class="clip" data-start="START" data-duration="LENGTH" data-track-index="0"> using the scene's start and (end − start) from the list above. Elements outside a clip's time are hidden by the runtime. A .clip is position:absolute; inset:0. Overlays that span the story (a progress bar) get class="clip" data-start="0" data-duration="${t.storyEnd.toFixed(2)}" data-track-index="1".
5. One GSAP timeline, created paused, with every tween placed at absolute times (position parameter in seconds), then registered: window.__timelines = window.__timelines || {}; const tl = gsap.timeline({ paused: true }); ... ; window.__timelines["main"] = tl; Child timelines added to it must NOT be paused. Use repeat on looping idle motion (pings, floating) only inside the scene's time span.
6. Deterministic: no Math.random (use a seeded function), no Date, no fetch, no timers, no requestAnimationFrame, no CSS animations or transitions (GSAP only), no video or audio elements. The page must look right at any time it is seeked to.

Answer in this order: first the short plan (plain text), then the complete HTML file in ONE \`\`\`html code block, then nothing else. If your answer is cut off before </html>, I will say "continue": then carry on exactly where you stopped, inside a new \`\`\`html block, without repeating anything.`;
}
