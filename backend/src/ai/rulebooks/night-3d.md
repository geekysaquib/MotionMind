# Night World 3D — Style Prompt

> A cinematic low-poly 3D world at dusk or night, like a mobile game cutscene: a real place (railway line, city, tower, factory) built from simple 3D shapes with glowing windows, dark silhouettes of trees and poles, and a moving camera. Big two-line captions sit at the top with one hot keyword in yellow or pink. Glassy UI cards float in the scene to show data.

## 1. Essence, and what it is not
- **A place you fly through.** Every reel happens in one 3D world related to the topic (a train on tracks, a mobile tower in a field, a city street, a factory floor). The camera moves through it: close-ups on the mechanism, wide aerial shots for scale.
- **Show the mechanism up close.** When the narration explains how a part works, cut in close on that part (a brake pipe under the coach, a valve, a wheel, a tower antenna) and light it with a cyan glow.
- **Captions carry the line.** Huge, punchy, two lines max, at the top third.
Not flat 2D infographics, not realistic photo, not neon cyberpunk overload.

## 2. Materials & rendering (fake 3D with SVG and CSS)
- Build depth with layers: a gradient night sky (#1B1E3A → #2B2D55 with a few stars), a horizon band, mid-ground silhouettes (trees, palms, poles, wires) in #0E1120, and the hero object in the foreground.
- **Fake perspective**: draw tracks, roads and grids as trapezoids that converge to a vanishing point; animate the camera by scaling and translating the world layer (and moving near layers faster than far ones). CSS 3D (`perspective` + `rotateX`) is allowed on ground planes.
- Low-poly objects: flat-shaded faces (three tones per object: lit, mid, shadow), e.g. a train coach as a long box with a lighter roof, a row of warm yellow windows (#FFD27A with a glow), a red stripe; wheels as dark discs with a lighter rim.
- **Glow**: cyan (#3FE0FF) light bars and pulses travel along pipes, wires and signal paths; warm yellow light from windows and headlamps; a soft bloom (blur filter on a duplicate layer at low opacity).
- **Floating UI**: dark glass cards (#151833 at 85%, border rgba(255,255,255,.12), radius 22, inner glow) with an icon chip, small labels and a big number in yellow, or a list with coloured icon tiles (red, pink, yellow, blue). A gauge (circular dial with a green needle) for pressure/speed values.

## 3. Colour logic
- Captions white; keyword in **yellow #FFD23F** for facts/answers, **pink #FF4D8D** for drama/consequences/numbers that hurt.
- Cyan #3FE0FF = energy, signal, air, data moving. Red #FF3B3B = emergency, alarm. Green #2BD47D = OK/signal on.
- World colours stay dark and desaturated so captions and glows pop.

## 4. Type & subtitles
- Caption: 76–96 px, heavy rounded grotesk (Inter 800/Plus Jakarta 800), white, centered at y ≈ 180–330, max two lines, tight leading (1.05), a soft dark shadow. Each new line pops in word by word (scale 0.9 → 1, 0.15 s) on its spoken time; the keyword is coloured.
- Small top bar: "EP 17 · TECH" style label left and a handle pill right, tiny and grey; a thin progress bar across the very top (orange #FF8A3D) filling over the reel.
- Labels in the world: small dark pills with an icon ("⚠ COUPLING TOOTA", "GUARD").

## 5. Motion quality
- The camera is always gliding: slow dolly along the track, slow orbit around the tower, gentle bob (±4 px) on aerial shots. Cuts every 2–4 seconds between angles of the same world.
- Trains and cars move continuously; lights blink; signal pulses travel.
- UI cards slide up 40 px and fade in with a slight overshoot; numbers count up.

## 6. Camera grammar
Establishing aerial → medium shot of the subject → extreme close-up of the mechanism → back out wide for the consequence → a final night wide shot. Low angles make machines feel big.

## 7. Native moves
- **The mechanism close-up**: cut under the object, the part lights up cyan, an arrow or pulse shows the flow. *Fits:* how brakes, valves, engines, chips work.
- **The gauge**: a dial drops in and the needle swings to a value. *Fits:* pressure, speed, load.
- **Tower and signal**: a tower with expanding rings, a beam to the moving vehicle, "SIGNAL ON" pill. *Fits:* networks, GPS, mobile data.
- **The overhead map**: the camera rises to a top-down blue grid, the route is a glowing line with the vehicle as a yellow capsule and towers as small icons. *Fits:* tracking, routes, location.
- **The stat card in the world**: a glass card with a big yellow number floats beside the action. *Fits:* fines, counts, records.
- **Poll card at the end**: a glass card with a question and three coloured options. *Fits:* "comment karo" endings (but the end card itself is added by Motion Mind).

## 8. Pitfalls
- Flat-looking scenes: always at least three depth layers and a moving camera.
- Captions over busy bright areas: keep the top third dark (sky).
- Too many glows: one cyan flow per scene.

## 9. Variation space
Choose the world, the time of day (dusk purple or deep night), the hero machine, the close-up parts, and the closing wide shot.
