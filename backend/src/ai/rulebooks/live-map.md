# Live Map — Style Prompt

> A flat, light, product-grade motion-graphics look in the spirit of a ride-hailing or delivery app's own explainer: a clean light ground, crisp white cards with soft shadows, black ink, one marker-yellow highlight, and things that move with purpose (pings, routes, cars, counters). When the story happens in a city, the city map itself is the stage; otherwise the same language lives on a quiet light grid.

## 1. Essence, and what it is not
- **The interface of the real world.** Explain how something works by showing its real parts the way a great product team would draw them: phones, servers, queues, maps, money, tickets, people, each as a clean flat object or card.
- **Motion carries meaning.** A ping means data was sent; a dot travelling a line means a request; a counter rolling means scale; a stamp means a verdict. Nothing moves just to decorate.
- **One idea per scene,** big enough to read on a phone in one glance.
Not a corporate slideshow (no bullet lists on a white slide), not 3D, not neon, not hand-drawn.

## 2. Materials & rendering
- **Ground**: #F7F7F5. For city scenes, a flat map: rounded street blocks #E4E6EA, parks #D3EAD6, water #CFE2F6, white main roads; cars as small black rounded rectangles moving along streets. For other scenes, a faint 100 px grid in #E4E6EA.
- **Cards**: white, radius 28–40 px, shadow 0 18px 44px rgba(11,11,12,0.14), 28–40 px padding. A thicker 5 px black border marks the one that matters.
- **Icons**: simple, bold, single-colour glyphs drawn in inline SVG (stroke 3–4 px, round caps). Logos as small white rounded tiles.
- **Header**: a white card at the top with a black pill eyebrow (uppercase, letter-spaced) and a heavy headline; segmented progress bar above it, one segment per step.

## 3. Colour logic
- Ink #0B0B0C, secondary #5B6170, highlight marker #FFD60A drawn as a band behind the key word (linear-gradient from 52% to 92% of the line height).
- Signal colours with fixed meanings: blue #276EF1 = data / location, teal #00B37E = good / free / done, orange #FF8A00 = busy, red #FF2D3D = problem / demand / failure, purple #7B5CFA = the place where things happen.
- Never more than two signal colours in one scene besides black and yellow.

## 4. Type & subtitles
- One heavy grotesk (Inter 800–900, or system "Segoe UI" bold), headlines 80–96 px with −1.5 px tracking; labels 30–40 px bold; monospace for IDs and coordinates.
- **Captions**: a black rounded box (radius 30) low on screen, 3–4 words at a time, 64 px white bold; the word being spoken sits on a yellow block with black text; keywords in yellow.

## 5. Motion quality
- Springs with a small overshoot for cards (scale 0.92 → 1, rise 50 px, 0.4 s); lines draw on in 0.3–0.5 s; counters roll with ease-out and land on the beat.
- Pings: expanding blue rings (radius 14 → 84 px, fading) every 1.2–1.5 s from senders.
- Every frame has some life: cars keep driving, dots keep travelling, the camera drifts 3–5% in.
- Exits: pieces slide or fade out quickly in reverse order before the next scene; a soft whip (blur + 140 px slide) between scenes.

## 6. Camera grammar
A 2D camera over one big canvas. Glide (0.8 s ease-in-out) to a new district or region per scene; push in on the one thing that matters; pull out wide for the recap so the whole system is visible at once.

## 7. Sound palette (if you add any)
Soft UI pops on card entries, a short whoosh on scene changes, a tick per counter step, a low thud for a stamp; always under the voice.

## 8. Native moves
- **Pings on a map**: many senders, one receiver. *Fits:* GPS, notifications, orders.
- **The route**: a dashed path drawing itself with a car or packet moving along it. *Fits:* deliveries, requests, journeys.
- **Live counters**: two cards side by side counting supply vs demand. *Fits:* surge, stock, seats.
- **The heat grid**: hexagons over the map filling teal → red. *Fits:* demand, crowds, coverage.
- **Notification stack**: app notifications sliding in and stacking, one crossed out. *Fits:* failures, OTPs, booking states.
- **The stamp**: one word slammed in at an angle. *Fits:* CONFIRMED, WAITLIST, BLOCKED.

## 9. Pitfalls of the medium
- Too many cards at once: keep 2–5 per scene.
- Text under 30 px is unreadable on a phone.
- A map in a scene that has nothing to do with a place: use the plain grid instead.
- Static frames: something must always move.

## 11. Variation space
Choose the ground (map or grid), which signal colours the story needs, the hero object of each scene, how the camera travels, and the closing image.
