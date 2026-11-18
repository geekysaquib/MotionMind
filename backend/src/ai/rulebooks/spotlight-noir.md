# Spotlight Noir — Style Prompt

> A dark tech-documentary look: near-black navy stage, one cone of light from above on the hero object, objects rendered like glossy 3D product shots (chips, servers, vaults, phones), small monospace tags and pill labels, and one centered line of narration under the picture with the spoken word lit up. Calm, expensive, a little secretive — like an episode of a tech series.

## 1. Essence, and what it is not
- **One hero object per scene, under a spotlight.** The object is the story: a chip, a server rack, a glass case, a letter, a calendar, a person's ID card. It sits centre-top, lit from above, with everything else in shadow.
- **Series feel.** A small top bar on every scene: a square logo glyph + show name + episode (e.g. "AI.EXE · EP 30") at left, a rounded pill with the episode's topic at right, both in tiny monospace.
- **Quiet, then a punch.** Most scenes are calm; the key number or verdict lands huge.
Not neon cyberpunk, not a slideshow, not cartoon. No bright backgrounds.

## 2. Materials & rendering
- **Ground**: a vertical gradient #0B0E1A → #06070C with a soft radial pool of light (#2A2F6B at 35% opacity) behind the hero; a faint vignette.
- **Spotlight**: a cone from the top edge (linear-gradient from rgba(160,170,255,.22) to transparent, slightly blurred) hitting the hero object; the floor under it has a soft ellipse shadow.
- **Hero objects**: drawn in SVG with real depth: a chip with gold pins and a dark die with a faint violet glow, a server rack with tiny lights, a glass box with highlights and a red edge glow, a sealed letter, a building. Use layered gradients, a top highlight and a reflection.
- **Cards**: dark glass (#12152A at 90%, 1 px border rgba(255,255,255,.08), radius 18) for UI and data; light paper cards (#F4F1EA, slight tilt) for documents and letters, with a yellow marker line on the quoted sentence.
- **Tags**: pill labels in tiny bold monospace (24–28 px, uppercase, letter-spaced) — violet (#7C6BFF bg, white text) for normal tags, red (#E5484D) for danger/secret, dark outline pills for neutral.

## 3. Colour logic
- Ink #F2F3F8 on dark; secondary #8C93B0; accent violet #8B7CFF for the highlighted word and tags; danger red #E5484D for warnings, restrictions, "secret"; gold #D8A93A only on hardware (pins, edges).
- Never more than violet + one other signal colour in a scene.

## 4. Type & subtitles
- Narration line: centered, 52–60 px, Inter/Plus Jakarta 700, white; the word being spoken (or the keyword) in violet; unspoken words of the line at 45% opacity (karaoke style). One line, rarely two, at y ≈ 1150–1250, below the hero.
- Big numbers: 160–220 px, heavy, white, with a tiny monospace label under them in violet ("H100 CHIPS · EK SAATH").
- Handle at the bottom centre in tiny monospace with a green dot ("● @handle"), steady through the reel.

## 5. Motion quality
- Slow, smooth camera pushes (scale 1 → 1.06 over the scene) on the hero layer only.
- Objects rise into the light (y +60 → 0, blur 8 → 0, 0.6 s, power3.out); tags pop in staggered 60 ms.
- Numbers count up fast then settle; a thin progress bar can fill under them.
- Transitions: the light dims to black for 0.2 s and comes up on the next hero, or a match cut where the chip in one scene becomes the chip in the next.

## 6. Camera grammar
Mostly locked-off product shots with a slow push; occasionally a low-angle tunnel of repeated objects (rows of chips/servers rushing toward the camera in perspective) for scale.

## 7. Native moves
- **The spotlight reveal**: dark stage, the cone fades on, the object rises into it. *Fits:* introducing the thing.
- **The tunnel of scale**: hundreds of identical objects in two perspective walls rushing past, a giant number on top. *Fits:* "16,000 chips", data centres.
- **The glass case**: the object locked in a glowing glass box with a red "CONTROLLED" label. *Fits:* bans, restrictions, secrets.
- **The paper evidence**: a letter or memo slides in, one sentence gets a yellow marker. *Fits:* quotes, leaks, reports.
- **From → to**: two dark pills ("FROM USA" → "TO CHINA") with a red barrier between them and a red stamped tag. *Fits:* exports, permissions, transfers.
- **The person card**: avatar circle + name + small mono role. *Fits:* executives, people in the story.

## 8. Pitfalls
- Too many objects in light: one hero only, everything else dim.
- Grey-on-black text under 28 px disappears; keep labels bright enough.
- Don't use the violet for decoration; it marks meaning.

## 9. Variation space
Choose the hero object of each scene, where the light comes from, which tags appear, and the closing image (often the hero back under the spotlight, alone).
