# Deep Blue Glass — Style Prompt

> A calm, premium explainer in deep ocean blue: a dark navy-to-teal gradient with drifting particles, a bold title at the top with one word in bright blue, frosted glass panels with big monospace digits, small isometric objects (phones, servers, keys, clouds) and a subtitle with an underline that moves word by word. Clear, technical, trustworthy — like a security or how-it-works explainer.

## 1. Essence, and what it is not
- **One question per scene.** The top title asks or states the idea in 2–4 words ("Who sends it?", "Divide by 30", "Codes split"); the visual answers it.
- **Numbers are the heroes.** Codes, counters and timers are shown big in monospace inside glass panels, and they change on screen.
- **Small, precise objects.** Phones, servers, keys, QR codes, clocks and clouds drawn small and clean, often isometric, with a soft glow.
Not neon, not cartoon characters, not a light theme.

## 2. Materials & rendering
- **Ground**: radial/linear gradient #0B1A3A → #08263A → #0A2E35 (navy into teal), with 40–60 tiny drifting particles (1–3 px, white at 20–40%) and a faint glow behind the active object.
- **Glass panels**: background rgba(28,45,90,.55), 1.5 px border rgba(120,160,255,.25), radius 20, backdrop blur, inner top highlight. Inside: monospace digits 90–130 px in bright blue #4C7DFF with a soft glow, or white.
- **Objects**: a phone with an authenticator app screen, a server rack (isometric box with green lights), a golden key (#F5B83D with highlight and glow), a QR code on a laptop, analog clocks, a cloud with a Google-style badge, a fan/blender for "HMAC" mixing.
- **Progress pieces**: segmented blue bars (filled #4C7DFF, empty #1E2B4F) for counters; a ring timer that drains ("30s").
- **Brand mark**: the handle small in the top right corner ("@handle"), steady.

## 3. Colour logic
- Text white #F5F8FF; accent blue #4C7DFF for the title keyword and key digits; gold #F5B83D for secrets/keys; red #FF4D5E only for mismatch/error (with a red X badge); green #2BD47D for match/success.

## 4. Type & subtitles
- Title: centered at y ≈ 130, 76–88 px, rounded geometric sans (Plus Jakarta Sans / Inter 800), white with the keyword in blue.
- Subtitle: centered at y ≈ 1200, 40–46 px, white 600; the spoken word underlined in teal #2EE6C5 (a 4 px underline that slides from word to word), a few words of context in white, the rest dim. Under it, a thin dotted line with a small percentage at the right showing reel progress.
- Digits: monospace (JetBrains Mono 700), letter-spaced 0.08 em, in groups of three ("309 124").

## 5. Motion quality
- Panels fade and rise (y 30 → 0, blur 6 → 0, 0.5 s, power3.out); digits roll like an odometer to their value (each digit column slides).
- Keys and objects float gently (only graphics, ±6 px); particles drift slowly.
- The ring timer drains continuously; at zero a new code rolls in.
- A mismatch shakes the panel (x ±8 px, 3 times) and shows the red X; a match glows green.
- Scene changes: crossfade with a slight zoom (1.04 → 1), keeping the background continuous.

## 6. Camera grammar
Centered compositions; slow push-in on the active panel; side-by-side layouts for comparisons (phone vs server).

## 7. Native moves
- **The rolling code**: a 6-digit code in a glass panel rolls to a new value. *Fits:* OTPs, PINs, counters.
- **Phone ↔ server**: an isometric phone and server on a platform with a dotted link that fades out ("they never talk again"). *Fits:* sync without connection.
- **The division**: a long number, an arrow, a "÷ 30" pill, then a segmented counter. *Fits:* maths steps.
- **The mixer**: a box labelled HMAC with a spinning fan; inputs go in, a jumble comes out. *Fits:* hashing, encryption.
- **Side by side**: two panels (Your phone / Server) with clocks and codes, one highlighted gold border, red X between. *Fits:* comparisons, errors.
- **The recap trio**: three circular badges (Secret, Clock, ?) at the end. *Fits:* summaries.

## 8. Pitfalls
- Low contrast blue on navy: digits need the glow and at least #4C7DFF brightness.
- Too many panels: two at most per scene.
- Keep everything centred; this style is calm and symmetric.

## 9. Variation space
Choose the objects per scene, which numbers roll, the comparison layout, and the recap badges.
