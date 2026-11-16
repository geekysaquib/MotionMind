# Host Desk, Light — Style Prompt

> A bright, friendly explainer with a cartoon host on a clean white page: a bearded presenter in a mint shirt at the bottom of the frame gestures through the story, while sticker-like illustrated objects — phone apps, database cylinders, interview desks, speech bubbles, cheat-sheet cards — pop in above him. Black sans text with red italic serif accents, like a magazine page come alive.

## 1. Essence, and what it is not
- **A teacher on a white page.** The host (bottom third) explains with clear gestures; the illustrations above are what he is talking about.
- **Sticker illustrations.** Every object has a thick black outline, flat colours and a slight drop shadow, like a sticker on paper: phones showing an app, a red question mark, database cylinders, a stopwatch, a map card, a whiteboard, an interviewer at a desk.
- **Teaching rhythm.** Question → example → mistake → answer → recap card.
Not dark, not 3D, not a corporate slide.

## 2. Materials & rendering
- **Ground**: off-white #F7F6F3, no texture or a very faint paper grain; tiny chapter label top left in monospace ("// 03 — the shape").
- **Host character** (one reusable SVG function with pose parameters): flat cartoon man with a full dark beard and spiky hair, friendly eyes, black outline 5 px, mint-green shirt (#BDE5C8). Poses: open palm up (explaining), counting on fingers, pointing up, shrug, hand raised (stop), thumbs up, laughing. Change pose on keywords; blink; mouth moves with speech. An optional second character (e.g. an interviewer behind a desk) appears in scenes that need a second voice.
- **Stickers**: white cards with 5 px black borders and hard offset shadows (6 px, #000 at 85%); red labels (#E63B2E) with white bold text ("MISTAKE OK?", "BIGGEST MISTAKE", "Q2"); small tables (users, orders) as mini spreadsheets with a blue header; phones with simple app UIs (red header, food image, button).
- **Annotations**: red hand-drawn circles, arrows and underlines; a red checkmark or cross; thin dotted connectors.

## 3. Colour logic
- Text #111; accent red #E63B2E for key words (serif italic), labels and warnings; blue #2F6FED for data/tables; yellow #FFC93C for highlights; mint for the host. Keep the page mostly white.

## 4. Type & subtitles
- Narration headline top-left (x 70, y 110–260), 60–68 px, a geometric sans (Inter/DM Sans 600) in black, two to three lines, key words in **italic serif red** (Playfair Display / Instrument Serif italic). Words appear on their spoken times.
- Labels inside stickers in bold condensed sans; numbers in heavy sans.

## 5. Motion quality
- Stickers pop in with a bounce (scale 0 → 1.08 → 1, rotation −4° → 0, 0.4 s, back.out(2)); they wobble slightly once when mentioned again.
- Hand-drawn marks draw on (stroke-dashoffset, 0.35 s).
- Text types in for "your answer" boxes (a blinking cursor).
- The host reacts with a small hop on each pose change.
- Scene changes: stickers fly off with a quick spin, the next set pops in.

## 6. Camera grammar
Locked frame; gentle zooms on one sticker to show detail; the host stays in place the whole reel.

## 7. Native moves
- **The question card**: a big card with "Which DB for this app?" and an answer box with a blinking cursor. *Fits:* interview questions, hooks.
- **The example app**: a phone with a real-looking app screen and a label. *Fits:* "take a food app".
- **The two tables linked**: two mini tables joined by a red line between matching rows. *Fits:* relations, joins, structure.
- **Mistake stamp**: a red "MISTAKE" sticker slams on with a shake. *Fits:* common errors.
- **The verdict board**: "YOUR STACK" panel filling 1/3 → 2/3 → 3/3 with icons. *Fits:* choosing tools, scoring.
- **The cheat-sheet**: a final card listing the answer with icons. *Fits:* recaps.

## 8. Pitfalls
- Clutter: 1–3 stickers per scene.
- Thin outlines look cheap at phone size: outlines 4–6 px.
- The host must not hide the stickers: stickers above y 1200.

## 9. Variation space
Choose the example app, the stickers, the host's gestures, and the recap card.
