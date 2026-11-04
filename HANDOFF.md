# Motion Mind: progress and handoff

Where the project stands as of **4 Nov 2026**, so work can continue in VS Code with Claude Code. Read this first, then `CLAUDE.md` (architecture, conventions, decisions) and `README.md` (setup).

> Tip for Claude Code: "Read HANDOFF.md and CLAUDE.md, then continue with the next steps."

## What Motion Mind is

An AI studio that turns a topic into a researched, animated **Instagram explainer reel** (1080×1920 MP4), in the style of the "Where is my Train" test reel: a pastel **3D isometric world**, info cards, word-by-word captions and a voiceover. Hinglish, Hindi or English.

Flow per project: **Topic → Research → Script → Storyboard → Graphics → Voice → Export.**

## Where the code is

- Local folder: `D:\MotionMind`, git branch **`restructure-layout`** (21 commits on top of PR #1's `supabase-setup` branch).
- **Not pushed to GitHub yet.** Push and open a PR when ready (`git push -u origin restructure-layout`).
- Repo: https://github.com/geekysaquib/MotionMind

## How to run

```bash
npm install      # once, from D:\MotionMind
npm run setup    # creates/checks .env, lists what's missing
npm run dev      # API on :8787 + web on :5173 (next free port if taken)
```

Checks: `npm run typecheck`, `npm test` (Jest, 140 tests), `npm run build`.

## Decisions Saquib made (keep them)

| Decision | Detail |
|---|---|
| Hosting | **Runs locally** (API :8787, web :5173). Netlify was dropped on 2026-11-05. |
| Layout | `frontend/`, `backend/`, `backend/reel-engine/`, `shared/`, `supabase/`. **One `package.json` and one `.env`, at the root.** |
| Database | Supabase project **motion-mind** (`dxmtfsmdfncrrwwcxpzj`, Mumbai). **Never OrbitDev.** Database only: browser never talks to it, all tables locked to the API (service_role). |
| Sign-in | **No Supabase Auth.** 6-digit email code over **SMTP with a Gmail app password**; our API issues the session token. |
| AI keys | **Users never set up keys.** Server keys only: `ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY`. Settings has exactly two connectors: **Claude** and **ElevenLabs**. |
| No API key? | Saquib has Claude Pro, not an API key. Pro can't power the API, so Research and Script also have a **"do it in claude.ai"** route: copy a prompt, paste Claude's answer back. Keep both routes. |
| Graphics | **Every reel is 3D**, for any topic, matching the original reel's look. No flat slides. |
| Tests | **Jest** (not Vitest). |
| Logs | UI logs in **Settings → Diagnostics**; warnings/errors also go to the server log. |
| DB changes | Migrations to motion-mind need Saquib's OK first. |

## What's built

### Platform
- Email-code sign-in (SMTP, or code printed in the API terminal when SMTP is empty), sessions, onboarding (handle, channel, niche, language), dashboard, project library, settings.
- Settings tabs: **Profile & handle, Connectors (Claude + ElevenLabs: Ready/Not available, test, Ask Claude), Account, Diagnostics (app log: filter, copy, download)**.
- Crash screen with "Copy log"; errors batched to `/api/client-logs`.

### Stages (project tabs)
| Stage | What it does | Needs |
|---|---|---|
| Research | Claude researches with **web search**; facts marked verified / single source / estimate / conflicting, with sources. **Approve** feeds facts into the script. Or paste from claude.ai. | `ANTHROPIC_API_KEY` (or claude.ai) |
| Script | **Write with Claude** (Opus 5.5, structured output), or **write it in claude.ai** and paste. Live preview. | same |
| Storyboard | Edit each scene's narration, headline, label, step, colour; reorder/add/delete; live preview of the draft. | — |
| Graphics | Still of every scene. | — |
| Voice | **Upload your own voiceover** (one file for the whole reel; browser reads length + loudness, `autoCuts` guesses scene starts), or pick an ElevenLabs voice and record every scene. Captions follow word timings; warns if narration changed since. | `ELEVENLABS_API_KEY` for ElevenLabs only |
| Export | Renders the MP4 with Remotion **on your PC**, with progress, playback, download. First export downloads Remotion's Chrome. | local `npm run dev` |
| Reel editor | Waveform timeline with draggable scene breaks, voice pace (whole reel + per scene, 0.7-1.5x, pitch kept), edit narration/label/headline per scene, background music (loops, volume), caption size/position/look, live preview, Save. Export uses all of it. | migration `20261104000200_project_editor.sql` applied |

### Reel engine (`backend/reel-engine/src`)
- `Reel.tsx` takes a `ReelSpec` as props; used by the in-app preview (`@remotion/player`) and the MP4 export.
- Worlds:
  - **`train`**: the original 3D railway world (`World.tsx`) with named shots (phone, tower, map, crowd, station, accuracy, wide) and effects (rings, towerIds, pins, gpsLog, stationGlow, errorBand).
  - **`iso`**: the new 3D isometric scene kit (`IsoWorld.tsx`) for any topic. 16 objects (phone, laptop, tower, server, cloud, bank, shop, building, house, factory, person, document, money, chip, car, satellite), animated signal arcs with a travelling packet, rings/pulse effects, objects drop in, camera glides between scenes. A prop id keeps its place across scenes.
  - `cards`: old flat style, no longer chosen.
- `autoScene.ts` (`withScenes`) fills in scenes/shots Claude didn't describe, from the card's words, so old and pasted scripts are 3D too.
- World rule: `reelWorld()` in `shared/src/projects.ts`: Claude's choice, else train for train topics, else iso.

### Database (motion-mind)
Tables: `app_users`, `login_codes`, `profiles`, `projects` (with `script`, `research`, `voice`, `editor` jsonb). Private storage bucket **`voice`** for MP3s and uploaded voice/music. Migrations in `supabase/migrations/`. **`20261104000200_project_editor.sql` (adds `projects.editor`, lifts the bucket's mime/size limit) is NOT applied to the live database yet: it needs Saquib's OK.** Until it is applied, saving the Reel editor fails in `supabase` mode (memory mode works).

## `.env` status (root `D:\MotionMind\.env`)

| Variable | Status |
|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | set |
| `AUTH_SECRET` | set (generated) |
| `SMTP_*` | set by Saquib |
| `ANTHROPIC_API_KEY` | **empty**: Write/Research with Claude show "not set up" until added (claude.ai route works without it) |
| `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` | **empty**: Voice stage needs it |


## Known limits / open items

1. **Export is local only:** it needs Chrome and runs on the machine hosting the API. A 3-scene reel takes about 20 seconds.
2. **Reel editor:** no SFX tracks yet, and no trim of the recording's start or end. Scene breaks are per recording (re-uploading re-guesses them).
3. **Discover** is curated starter ideas, not live trends.
4. **AI mode** (copy-paste or API keys) is saved per browser, not per account (per account needs a migration).
5. **Object positions** in the 3D world are recalculated on every draw, so an engine change can shift them in a saved reel.
6. **Graphics:** objects are chosen by keywords in automatic scenes; four large objects in one scene still make the camera pull back.
7. Commits are local on `main`; nothing is pushed.
8. `supabase/test/run.sh` (database security test) needs Linux Postgres; not run on Windows.

## Suggested next steps

1. Add `ANTHROPIC_API_KEY` and `ELEVENLABS_API_KEY` if you want API-key mode (copy and paste works without them).
2. Run `npm run assets:usage` after 20 to 30 real reels and hand-build the most-used missing 3D models.
3. Reel editor: SFX tracks, trim of the recording's start and end.
4. Real trending topics for Discover.
5. Push the branch.

## Commit history (newest first)

```
20744f5 Every reel in 3D, for any topic
35912c6 3D worlds for every reel, matching the original reel's look
12085d6 Export and Graphics stages: render the MP4 from the app
e09ec5d Voice stage: ElevenLabs voiceover on the server key
ee8f900 Graphics: big animated scene visuals for any topic
d83f87b Storyboard stage: edit the script scene by scene
b98d180 Research stage: Claude web research with sources, or via claude.ai
3b049d3 Script tab: keep Write with Claude, add Write it in claude.ai
42e6c19 Settings > Connectors: Claude and ElevenLabs on server keys
e05ab55 Remove per-user API keys; Claude runs on the server's key
b62ad7d Connect Claude and embed the reel engine in the app
20014cb Reset motion-mind to one clean schema
99e7cc2 Clearer errors when the API is down or misconfigured
bb87cf1 Switch to Jest, add UI logging and many more tests
607a0e2 Tidy architecture into feature folders and add CLAUDE.md
de497ef Make running the app easier: npm run setup and npm run dev
83f8577 Use one root .env for the API, web app and reel engine
29a51a5 Use a single root package.json
0fb9df4 Replace Supabase Auth with email one-time-code sign-in over SMTP
b40ae82 Set up Netlify deploy: static web app plus API as a function
2cb229f Restructure into frontend, backend and shared folders
```
