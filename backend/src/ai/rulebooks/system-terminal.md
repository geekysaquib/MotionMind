# Terminal Dashboard — Style Prompt

> A system-design explainer that looks like a hacker's dashboard: black background with a faint coloured haze, monospace labels, small status chips, and neon-outlined cards (green, amber, red, blue) that light up as concepts are introduced. Big seven-segment-style numbers, data tables, tokens as coloured blocks, servers and databases as glowing outlined icons. Narration as a centered caption line at the bottom.

## 1. Essence, and what it is not
- **Concepts become components.** Every idea is a labelled card: a vocabulary chip, a tokenizer machine, a database node, a CAP letter tile. As the narration names it, its card lights up with a neon outline and stays on the "board".
- **A running scoreboard.** The top of the screen keeps a row of the concept chips introduced so far (each with its colour), so the viewer always sees where they are; the newest one glows.
- **Real numbers on screen.** Counters, token IDs, balances and tables are shown exactly, in monospace, like a debugger.
Not a slide deck, not a cartoon, not a light theme.

## 2. Materials & rendering
- **Ground**: #07090C with a large blurred colour haze (green #1E5B3A or amber #5B3A1E or red #4A1A1A at 30%) behind the active area that shifts colour with the topic of the scene.
- **Header**: "ALGO REELS"-style show name at top left and "SYSTEM DESIGN · 20" at top right in tiny monospace caps; under it a segmented progress bar (one segment per scene, filled white, unfilled #2A2E36).
- **Section chip** under the header: a tiny dark pill with a coloured dot and a monospace label ("● PROBLEM · VOCABULARY", "● SOLUTION · TOKENS").
- **Cards**: background #0E1116, radius 14, 2 px outline in the concept's colour with an outer glow (box-shadow 0 0 24px colour at 35%), monospace title in caps with a little icon. Dashed outline = not filled in yet.
- **Data**: tables with two columns (word → number), right-aligned numbers in amber; seven-segment red numbers in a black display ("092") for counters; tokens as rounded coloured blocks (green, blue, purple) with white mono text.
- **Infrastructure**: data centres as a city-building glyph + racks + a cylinder database, outlined in the region colour, with a name in large caps ("DELHI", "BANGALORE"). A cable between them; a cut is a bright spark burst.
- **Paper**: a cream document card (#F2EDE3) for letters/prompts/applications, slightly tilted, with one highlighted word.

## 3. Colour logic
- Fixed meanings: green #3DDC84 = correct, success, solution; amber #FFB020 = data, numbers, attention; red #FF5A5F = problem, error, OOV, partition; blue #5AA9FF = consistency, system, info; purple #A78BFA = IDs.
- Text #E8EAEE; secondary #7D8590. Each scene uses at most three of the signal colours.

## 4. Type & subtitles
- Monospace (JetBrains Mono or IBM Plex Mono) for every label, number and chip; a clean sans (Inter 600) for the narration caption.
- Caption: centered at y ≈ 1210, 50–56 px, one line; the spoken word white, the rest of the line dim (#5B6270) — karaoke style.
- Big numbers: 120–200 px, monospace or seven-segment look, in the concept colour.

## 5. Motion quality
- Cards draw their outline first (stroke-dashoffset 0.3 s), then fill and glow; contents type in like a terminal (characters appear 25 ms apart) or rows slide in staggered 50 ms.
- Counters tick quickly in monospace (fixed-width cells so digits never shift).
- Packets: small glowing dots travel along dotted connectors between cards.
- Transitions: the board pans to a new area of the same canvas (0.5 s), or the active card zooms to fill the screen and becomes the next scene.

## 6. Camera grammar
One big dashboard canvas; the camera pans between regions (problem area, solution area, summary) and zooms into one card for detail, then back out to show everything connected.

## 7. Native moves
- **Concept chip row**: chips accumulate at the top, each lighting up when named. *Fits:* any glossary-driven explainer.
- **The machine**: a box with a yellow-black striped header ("TOKENIZER") takes text in one side and outputs coloured blocks on the other. *Fits:* processing, conversion, pipelines.
- **The dictionary table**: word → number rows appear one by one. *Fits:* lookups, IDs, mapping.
- **Two data centres and a cable**: Delhi and Bangalore nodes, a request, a cable cut spark, the result. *Fits:* distributed systems, CAP, replication.
- **The verdict tiles**: big letter tiles (C, A, P) with one or two lit and one dimmed. *Fits:* trade-offs, choices.
- **The equation strip**: "79 jawaab + 13 sawaal = 92" in an amber outlined bar. *Fits:* totals, sums.

## 8. Pitfalls
- Too much text in cards: labels of 1–3 words, numbers instead of sentences.
- Glow everywhere: only the active card glows; older ones keep a dim outline.
- Body text under 28 px is unreadable; chips can be 24 px only if short.

## 9. Variation space
Choose the haze colour per scene, the concept chips, the machine metaphor, the data shown, and the summary board at the end.
