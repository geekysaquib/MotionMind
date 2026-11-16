# Host Desk, Dark — Style Prompt

> An editorial news explainer with a cartoon host: a warm dark-brown studio, a friendly flat-illustrated presenter (with headphones and mic) in the bottom of the frame who reacts to every line with gestures and expressions, and above them clean news evidence — headline cards from real sites, giant red numbers, boarding passes, clocks, toggles. Elegant serif italics in red for the words that matter.

## 1. Essence, and what it is not
- **A person tells you the story.** The host is always there in the lower third (from the chest up, centred or slightly right), and changes pose with the narration: hand raised to explain, finger up for a key point, both hands out for "kya?", mouth open in surprise, chin-rub for doubt, waving for hello. This makes the reel feel personal.
- **Evidence above the host.** Every claim is backed by an object: a news headline card (site name, date, headline with a highlighted phrase), a big statistic, a document, a UI toggle, a diagram.
- **Editorial calm.** Generous space, few elements, careful type.
Not a meme video, not loud colours, not 3D.

## 2. Materials & rendering
- **Ground**: warm dark gradient #2A211D → #191412 with a soft spotlight behind the evidence; occasional light scenes (#EDEBE7) for "the official story" contrast.
- **Host character** (draw it once as a reusable SVG function with pose parameters): flat vector style, warm skin tones, simple shapes, black outline 4–5 px, round head, short dark hair, big friendly eyes with white highlights, eyebrows that move, a headset with a red mic, a beige sweater. Poses: neutral, explain (one hand up open), point-up, both-hands-out, surprised (mouth O, brows up), thinking (hand on chin), wave. Swap pose on the spoken word; blink every 3–4 s; the mouth opens and closes while the voice is speaking.
- **News cards**: white, radius 12, a small red dot + site name in tiny monospace ("● ALJAZEERA.COM") and a date at right; headline in a bold sans, one phrase highlighted with a pink marker (#F8B4B4) behind it.
- **Stat blocks**: a dark card with a giant red number (#E5483B, 140–180 px, heavy) and a white label with a tiny mono subtitle. Stacks of three for "2 · 2 · 2" rhythms.
- **Props**: boarding pass, analog clock with a red slice, toggle switches (one red ON), mail apps with a red DOWN stamp, a node diagram with a red centre block.

## 3. Colour logic
- Text: cream #F3EDE7 on dark; ink #1B1B1B on cards. Accent red #E5483B for numbers, the key word and danger. Muted grey #8E837C for secondary. Nothing else colourful except the host's clothes and small icons.

## 4. Type & subtitles
- Narration headline at the top left (x 70, y 120–260), 56–64 px, sans 600 in cream, left-aligned, two to three lines; key words in **italic serif** (Playfair Display / Instrument Serif italic) in red. Words appear on their spoken times.
- Tiny chapter label above it in monospace ("// 02 — the official story") and a status at the right ("CAUSE OLD ROUTERS?").
- Numbers in a heavy grotesk (Inter 800).

## 5. Motion quality
- Cards drop in with a small tilt and settle (rotation 3° → 0, y −30 → 0, 0.45 s, back.out); highlights sweep across the phrase left to right (0.35 s).
- Numbers count up; the clock hand sweeps; toggles flip with a click and the row glows red.
- The host reacts in sync: pose changes on the keyword, small bounce on each change.
- Scene changes: the evidence slides out to the left as the next slides in from the right; the host stays.

## 6. Camera grammar
Static frame like a TV studio; small push-ins (scale 1.04) on the evidence for emphasis. The host never leaves.

## 7. Native moves
- **The headline proof**: two or three news cards stacked, the key phrase highlighted. *Fits:* claims, official statements, reports.
- **The giant number**: a red number with a short label, host looks surprised. *Fits:* scale, losses, counts.
- **The triple**: three stacked stat rows with the same number ("2 giant systems · 2 days · 2 glitches"). *Fits:* patterns, coincidences.
- **The switchboard**: a panel of labelled toggles, one red and ON. *Fits:* systems, causes, configuration.
- **The ending question**: dark screen, a big italic serif question in the centre ("Coincidence, or something bigger?"). *Fits:* closing a story.

## 8. Pitfalls
- The host covering evidence: evidence stays above y 1150; the host stays below.
- Too many highlights: one highlighted phrase per card.
- A static host looks dead: change pose at least every 2–3 seconds.

## 9. Variation space
Choose the props, which scenes go light for contrast, the host's poses for each line, and the closing question.
