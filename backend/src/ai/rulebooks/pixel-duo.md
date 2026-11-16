# Pixel Duo — Style Prompt

> A cosy pixel-art sitcom: two characters in a small room at night — a human creator at his desk and a friendly computer-robot with a screen face — talk through the topic. Their dialogue appears as subtitles with the speaker's name, and chunky UI panels (comment lists, invoices, GitHub cards, step cards, checklists) pop up above them as they speak. Retro, warm, funny.

## 1. Essence, and what it is not
- **Two characters, one conversation.** The reel is a dialogue: the human ("MASTER", or the creator's name) asks or complains, the robot ("CLAUDE", or an assistant name) explains. Every line of narration belongs to one speaker; alternate them.
- **The room is the set.** A night room seen through a window with a city skyline and a moon; a desk, a laptop, a small plant, a shelf. The two characters sit side by side in the lower middle.
- **Panels show the facts.** Above the characters, a panel appears for each step: comments, a bill, a tool card, "STEP 1/3", a checklist.
Not smooth vector, not 3D, not dark tech dashboard.

## 2. Materials & rendering
- **Pixel art**: draw on a coarse grid (8–12 px "pixels") using SVG rects with `shape-rendering: crispEdges`; limited palette per object; dark 1-pixel outlines.
- **Human**: brown skin, short black hair and beard, red hoodie with a small logo, simple eyes and mouth; poses: talking (mouth open/closed frames), tired, laughing, surprised, pointing.
- **Robot**: a boxy white/grey monitor body with a dark screen showing a pixel face (two eyes and a mouth that change: smile, wink, worried, heart eyes, ":D"), antenna ears; a soft coloured aura behind it that changes with mood (green calm, red warning, pink proud, blue thinking).
- **Room**: dark navy wall #1B2240, a window with a deep blue night sky, pixel stars, a pale yellow moon, a skyline with warm lit windows; a brown desk edge across the bottom with a glowing laptop.
- **Panels**: dark #121726 cards with a 3 px border, slight rounded corners (6 px), pixel/condensed headings; a paper-white invoice card with a red stamp ("OUCH"); step tags as lime pills ("STEP 1/3").
- **Subtitle bar**: at y ≈ 1150–1350, left aligned: a tiny monospace label with a coloured square and the speaker name + mood ("■ MASTER · tired", "■ CLAUDE · excited") above the line.

## 3. Colour logic
- Lime #D7FF3A for highlights (step tags, the key word); cyan #4FD1FF for the robot's key words; red #FF4D4D for problems; white #F5F5F5 text on dark. Mood auras: green #2BD47D, red #FF4D4D, pink #FF5FA2, blue #4F8BFF.

## 4. Type & subtitles
- Dialogue subtitle: 46–54 px, clean sans (Inter 600), white, left-aligned, two to three lines; the key word in lime (human) or cyan (robot), struck-through or italic for jokes.
- Panel headings: condensed bold (Oswald / Bebas Neue / "Space Grotesk" 700), uppercase, lime or white.
- Top bar: "■ FREE AI VOICE CLONE" episode label at left and step dots "1 2 3" at right (lit squares for done steps).

## 5. Motion quality
- Characters animate with 2–3 frame swaps (stepped, not tweened: use GSAP with ease "steps(1)"), blink, small bob.
- Panels pop with a pixel-y snap (scale 0.9 → 1 in 2 steps) and type their text letter by letter; stamps slam with a 2-frame shake.
- The robot's aura pulses slowly; the moon and stars twinkle.
- Comic effects: "WHRRR..." sound-word text, sweat drops, sparkle pixels.

## 6. Camera grammar
Fixed sitcom framing; quick punch-in (scale 1.15) on a character's face for reactions; back out.

## 7. Native moves
- **Comment wall**: a list of viewer comments with avatars all asking the same question. *Fits:* hooks.
- **The bill**: an invoice with costs and a red "OUCH" stamp. *Fits:* prices, paid tools.
- **The tool card**: a GitHub-style card with name, badges (OPEN SOURCE, licence), and platforms. *Fits:* introducing a tool or app.
- **Step cards**: "STEP 2/3" with a short title and a typing input. *Fits:* tutorials.
- **The rules check**: green ticks and a big red X with a "NO PERMISSION" stamp. *Fits:* do's and don'ts, ethics.
- **The price badge**: an octagon "₹∞ SABSE MEHENGA" (most expensive). *Fits:* punchlines.

## 8. Pitfalls
- Smooth anti-aliased shapes break the pixel look: crisp edges only, no blur except the aura.
- Too much text in panels: 1–3 short lines.
- Keep the characters in the same place every scene.

## 9. Variation space
Choose the two characters' names and moods, the panels for each step, the room details, and the joke at the end.
