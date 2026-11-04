# Motion Mind: context for Claude

Motion Mind is an AI studio that turns a topic into a researched, animated Instagram explainer reel (1080x1920). The flow per project: topic, research, script, storyboard, graphics, voice, final. **Phase 1 is built:** email-code accounts, handles, onboarding, dashboard, project library, a route for every stage, Claude and ElevenLabs connectors on server keys. Every stage is built: Research, Script, Storyboard, Graphics, Voice, Reel editor and Export, each using the server's keys, plus a claude.ai copy-paste route for Research and Script for people with only a Claude subscription.

Owner: Saquib. Read this file first, then `HANDOFF.md` (what's done, what's next) and the README for setup steps.

## Decisions that are already made (don't undo without asking)

- **The app runs locally.** Saquib runs it on his own machine: the API on :8787 and the web app on :5173 (`npm run dev`). There is no deployment: Netlify was dropped on 2026-11-05 and its files were removed. MP4 export renders on the same machine (Remotion needs Chrome and minutes of CPU). If hosting comes back, start from the git history before that date.
- **No Supabase Auth.** Sign-in is a 6-digit code emailed over SMTP (Gmail with an app password). Our API issues HS256 session tokens signed with `AUTH_SECRET`. A first sign-in creates the account.
- **Supabase is the database only.** The project is **motion-mind** (`dxmtfsmdfncrrwwcxpzj`, Mumbai). Never use OrbitDev. The browser never talks to Supabase. Every table has RLS on with no policies and no grants for `anon`/`authenticated`. Only the API, with the service_role key, reads or writes.
- **One `package.json` and one `.env`, both at the repo root.** There are no npm workspaces, and every command runs from the root.
- Changes to the live Supabase database (migrations) need Saquib's explicit OK first.

## Layout

```
MotionMind/
├── frontend/                 React 18 + Vite + Tailwind + MobX + React Router
│   ├── src/
│   │   ├── main.tsx          picks services (api or memory), creates RootStore
│   │   ├── App.tsx           all routes
│   │   ├── config.ts         VITE_* settings
│   │   ├── services/         talking to the outside world
│   │   │   ├── http.ts       apiRequest(): the one fetch wrapper, throws ServiceError
│   │   │   ├── api.ts        real mode: auth, profiles, projects via the API
│   │   │   ├── claudeHttp.ts Claude, research, script, storyboard, connectors, voice and export calls
│   │   │   ├── memory.ts     demo mode: data in localStorage, code is always 123456
│   │   │   └── types.ts      service interfaces + ServiceError
│   │   ├── stores/           MobX: RootStore owns Auth/Profile/Project/Toast stores
│   │   ├── pages/            auth/ (Login, Onboarding) and app/ (dashboard, library, project stages, settings)
│   │   ├── layout/           AppShell, AuthLayout, guards (RequireAuth, RequireOnboarded, GuestOnly)
│   │   ├── components/       ui/ (Button, Card, Field, Alert, Badge, Select, Spinner), Logo, Toasts, ErrorBoundary
│   │   ├── lib/              logger (UI logs), cn, format (errorText, timeAgo), theme
│   │   └── test-utils.tsx    makeStore() + renderWithStore() for page tests
│   └── vite.config.ts        alias for @motionmind/shared, envDir = repo root, /api proxy to :8787
├── backend/
│   ├── src/
│   │   ├── server.ts         local entry: loadEnv, then listen on PORT
│   │   ├── bootstrap.ts      env -> dependencies (Supabase or memory, SMTP or console mailer)
│   │   ├── app.ts            buildApp(deps): CORS, /health, public /api/auth/*, signed-in /api/*
│   │   ├── env.ts            zod-validated env (empty values count as unset)
│   │   ├── http.ts           firstIssue(): zod error -> message for the UI
│   │   ├── auth/             routes (request-code, verify-code), otp, session tokens, mailer, verifiers
│   │   ├── account/          routes: /profile, /handles/:h/available, /projects CRUD
│   │   ├── ai/               Claude (claude-opus-5-5, server's ANTHROPIC_API_KEY): /claude/status, /claude/ask, /projects/:id/script
│   │   ├── connectors/       GET /connectors (Claude, ElevenLabs: ready or not), POST /connectors/elevenlabs/test
│   │   ├── voice/            ElevenLabs voiceover per beat; AudioStore (Supabase Storage bucket `voice` or memory)
│   │   ├── export/           MP4 render with Remotion (local server only) + /api/renders download
│   │   ├── logs/             POST /api/client-logs: browser warnings/errors into the server log
│   │   ├── data/             DataRepository: users, login codes, profiles, projects (Memory + Supabase)
│   │   └── app.test.ts       API tests via app.inject() (each folder also has its own *.test.ts)
│   └── reel-engine/          Remotion engine. Reel takes a ReelSpec as props: 'train' or 'iso' 3D world ('cards' is legacy).
│                             src/public.ts = what the web app imports as @motionmind/reel-engine (live preview);
│                             render.mjs / tts.mjs = CLI MP4 render and ElevenLabs voice for the sample reel
├── shared/src/               used by both sides: brand, handle rules, project types/STAGES
├── supabase/
│   ├── migrations/           20261103000000_init.sql = the whole schema (reset on 2026-11-03); add new files after it
│   └── test/                 run.sh: applies migrations to a throwaway Postgres (Linux only)
├── scripts/                  setup.mjs (creates .env + secrets), dev.mjs (runs API + web together)
├── brand/                    logo files
├── package.json              every dependency and command
├── tsconfig.base.json        shared TS options + paths alias @motionmind/shared -> shared/src
├── jest.config.js            Jest projects: frontend (jsdom), backend (node), shared (node); TS via SWC, ESM
└── test/                     Jest support: jsdom env with fetch/crypto, cookie shim, quiet app logs
```

## How a request flows

Browser, then `services/api.ts`, then `apiRequest()`, then `/api/...` (same origin; Vite proxies it to the API on :8787). Then Fastify `buildApp`. For signed-in routes, the `onRequest` hook verifies the bearer token and sets `req.userId`. Then the route handler validates with zod, calls a repository, and the Supabase service-role client does the query.

Every route only ever reads or writes rows for `req.userId`. Repositories take `userId`/`ownerId` as the first argument. Keep it that way.

## Claude and the reel engine

- Claude runs only on the API with the server's `ANTHROPIC_API_KEY`. Users never set up API keys (decided by Saquib); add any future provider the same way, as a server env var. `backend/src/ai/claude.ts` uses `@anthropic-ai/sdk`, model `claude-opus-5-5`, server-side refusal fallback (`fallbacks: 'default'`), and structured output (`betaZodOutputFormat(reelScriptSchema)`) for scripts. Tests inject `AppDeps.claude` instead of calling Anthropic.
- Two ways to get a script (Saquib wants both): **Write with Claude** (`POST /projects/:id/script`, needs the server's `ANTHROPIC_API_KEY`), and **write it in claude.ai** for people with only a Claude subscription: `GET /projects/:id/script/prompt` gives a copy-paste prompt with the JSON schema, and `POST /projects/:id/script/import {text}` validates and saves the pasted answer (`ai/reelPrompt.ts`, `PasteScriptPanel.tsx`). Both share one prompt builder. A Claude Pro subscription can't power the API.
- Research works the same two ways: `POST /projects/:id/research` (Claude with the `web_search_20260209` server tool, resumes `pause_turn`), or `GET .../research/prompt` + `POST .../research/import` for claude.ai. Saved as `projects.research` (`ResearchReport`: summary, facts with status + source indexes, sources). `POST .../research/approve` sets `approvedAt`; only approved research is passed into the script prompt.
- Storyboard: `PUT /projects/:id/script` saves the user's scene edits (sets `editedAt`).
- Graphics: three worlds. `train` = the original 3D railway world (`World.tsx`); beats pick a named `shot` (phone, tower, map, crowd, station, accuracy, wide → camera keys in `Reel.tsx`) and `events`. `iso` = the 3D isometric scene kit (`IsoWorld.tsx`) for any topic: each beat's `scene` lists props (16 named kinds in `PROP_KINDS`, or kind `custom` for ANY other object: an emoji `icon`, a `shape` block/tall/wide/flat/round and a `tone`, so the objects follow the topic), links (arcs with a travelling packet) and an effect; a prop id keeps one spot in the world across beats (the user can lock the arrangement on the Graphics page: `script.layout` holds each object's x, y and `layoutProps(timed, locked)` keeps those spots and places the rest around them) (`layoutProps` puts each new prop on the closest free spot next to the props it shares a scene with, using each object's real ground `footprint` plus a gap so nothing overlaps; the camera frames scenes with the same footprints; trains, planes, ships, buses and trucks are drawn smaller via `KIND_SCALE`; objects in the same scene pack closer; and `arcFor` bends a link around other objects in the scene that block it) and the camera glides to each scene, zoomed so every object, icon and label fits the safe area between the title card and the captions (`isoCamera`). The script's `theme` (city, nature, lab, plain, night, sunset, ocean, desert) sets ground, water, sky fade and scenery (`THEMES` in `IsoWorld.tsx`). Besides the 16 original kinds there are 24 more 3D models in `props3d.tsx` (`EXTRA_KINDS`: qr, speaker, lock, database, router, battery, heart, gear, truck, plane, train, tree, hospital, school, cart, camera, bulb, globe, envelope, clock, rocket, syringe, chart, atm); a new kind goes in `PROP_KINDS` (engine), `ScenePropKind` + `SCENE_PROP_KINDS` (shared), the zod enum in `reelSchema.ts`, `KIND_WORDS` in `autoScene.ts` and the labels in `SceneEditor.tsx`. `props3d-more.tsx` adds 14 more (brain, virus, dna, flask, microscope, sun, flame, solar, windmill, bus, ship, shield, book, bell); `samples/models.json` and `models2.json` show them all. Scene labels are kept from overlapping by `declutter.ts` (crowded scenes lift the later label). The night theme gives the reel header light text (`Header dark`). `npm run assets:usage` (reads saved scripts, prints counts only) ranks which kinds, icons and emoji reels really use, to decide which models to hand-build next. Anything else is an **icon tile**: a `custom` prop with `glyph` = any Lucide icon name (1,539 of them, from `iconData.ts`, generated by `node scripts/gen-icons.mjs`) drawn as a raised 3D tile by `glyph.tsx`. Claude is told to prefer `glyph` over emoji, `autoScene` maps keywords and any word that is an icon name to one, and `SceneEditor` has an "Icon name" field. `samples/icons.json` shows it. `npm run reel:stills -- <spec.json> <outDir>` renders one still per scene (samples in `backend/reel-engine/samples/`) to check the graphics without exporting a video. Every reel is 3D (Saquib's rule): `reelWorld()` in shared picks the world Claude chose, else `train` for train topics and `iso` otherwise; web (`worldFor`) and export (`reelSpecFor`) both use it. Beats Claude didn't describe get a scene or train shot filled in by `autoScene.ts` (`withScenes`, applied inside `Reel`), guessed from the card's words: a named kind when one matches, otherwise a `custom` object with an emoji from `ICON_WORDS`. On the Storyboard, `components/SceneEditor.tsx` lets the user edit each scene's objects (kind, label, icon, shape, colour; reuse an object from another scene), links, effect and camera focus, plus the world theme; "Edit the objects" turns an automatic scene into an explicit one and "Back to automatic" undoes that. `cards` (`CardsScene.tsx`) is no longer chosen for scripts. The original reel's look is the bar: Saquib compared against it.
- Voice: `POST /projects/:id/voice {voiceId}` speaks each beat with ElevenLabs (`connectors/elevenlabs.ts`, with-timestamps) on `ELEVENLABS_API_KEY`, stores MP3s via `AudioStore` (Supabase Storage private bucket `voice`, or memory/data URLs), saves `projects.voice` (`ReelVoice`: per-beat duration + word timings + the narrations it was made from). `GET .../voice` returns signed URLs and `stale` if the narration changed. `specFromScript(script, brand, {voice, urls})` attaches audio only when it matches the script.
- Reel editor (`projects.editor`, `ReelEditor` in `shared/src/editor.ts`): the user uploads their own voiceover (`POST /projects/:id/audio/voice`, raw body, magic-byte sniffed in `editor/audioFormat.ts`, max 40 MB / 5 min, stored via `AudioStore` under `<user>/<project>/`). The browser decodes it (`lib/audioAnalysis.ts`) for length + loudness peaks; `autoCuts` guesses the scene starts; the user drags the breaks on `Timeline.tsx`. `PUT /projects/:id/editor` saves (validates path ownership, cut order, cut count = scenes - 1, deletes replaced files). The engine plays each scene's slice of the one recording at `pace x scenePace` (`playbackRate`, pitch kept; `timeBeats` + `sceneRates` in `script.ts`), plus looping music and caption style. `specFromScript(..., editor)` (web) and `reelSpecFor` (export) both call `editorSpecParts`. The recording wins over ElevenLabs while `voiceSource` is `upload` and the cuts match the scenes. Sound effects (`editor.sfx`, up to 12 short clips, each with `at` seconds from the reel start and a volume; uploaded as `POST .../audio/sfx`, max 30 s) play once at their moment (`ReelSpec.sfx`, `Sequence` clips in `Reel.tsx`); the editor's "Sound effects" card can snap a start to a scene. The recording can be trimmed (`upload.trimStart/trimEnd`, white handles on the timeline or "Trim the silence" via `detectTrim`): only that window plays, `windowOf` in the engine and `trimWindow` in shared. If the recording ends with the "follow us" line, the user ticks that box in the editor and drags a purple marker (`upload.closingAt`, seconds): the last scene ends there, the end card starts as the line begins and stays until it has been said (`closingOf` and `reelTiming().endFrames/closing` in `script.ts`, the extra audio clip in `Reel.tsx`, `defaultClosingAt` guesses the marker from the last burst of speech). Needs migration `20261104000200_project_editor.sql`.
- Export: `POST /projects/:id/export` renders the 1080x1920 MP4 with Remotion (`export/renderer.ts`: bundle the engine once, `selectComposition` + `renderMedia`), as a background job polled by `GET .../export`. Files go to `renders/` (git-ignored) and are served at `/api/renders/<uuid>.mp4`. Without a renderer (tests) the route answers 501. Remotion packages are imported by name at runtime, so the API starts fast. The first export downloads Remotion's headless Chrome.
- Cover (thumbnail): `CoverSettings` in `shared/src/cover.ts` (scene, headline with `*highlight*`, kicker, style `bold|center|split`, size `reel 1080x1920|feed 1080x1350|square 1080x1080`, tone, brand), stored as `script.cover` in the script JSON (no migration; `PUT /projects/:id/cover` saves it without counting as a storyboard edit, and the storyboard's `PUT script` schema keeps it). The engine's `Cover` composition (`Cover.tsx`, layout maths in `coverLayout.ts`) draws one settled moment of the chosen scene with `frameScene` (camera fitted to a region that leaves room for the text) plus the text; `POST /projects/:id/cover/render` renders it to PNG or JPG on this machine (`Renderer.still`, served from `/api/renders/<uuid>.png|jpg`). The Export page's `CoverMaker.tsx` previews it live with Remotion's `Thumbnail` and downloads it; `npm run reel:cover -- <spec.json> out/covers` renders every layout for a sample.
- A project's script is `projects.script` (jsonb) with the `ReelScript` shape in `shared/src/projects.ts`. `frontend/src/components/reelSpec.ts` turns it into the engine's `ReelSpec` (3D world from `reelWorld()`, branded with the user's channel).
- The web app embeds the engine through `@remotion/player` (`components/ReelPreview.tsx`, lazy-loaded). Keep the engine browser-safe: no Node imports in `backend/reel-engine/src`.
- **AI mode** (Settings → AI & connectors, `stores/AiModeStore.ts`, saved on the account as `profiles.ai_mode` (migration `20261105000000_profile_ai_mode.sql`; null = not chosen, and then the browser's earlier choice is copied to the account on first load) and in the browser's localStorage, default `paste`): the user picks copy-paste or API keys. Every stage shows only the chosen way: Research and Script show either the key button or the claude.ai prompt panel, Voice hides ElevenLabs in paste mode (uploading your own recording is always available), and Settings hides the connector cards. Tests set it with `makeStore({ aiMode })` (default `keys`).
- Settings → Connectors has exactly two connectors, Claude and ElevenLabs, both on server keys (`ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY`). Each shows Ready/Not available and a test; Claude also has an "Ask Claude" box. No key fields for users. Project → Script has "Write with Claude" and the live preview.

## Sign-in

1. `POST /api/auth/request-code {email}`: stores an HMAC of the code (`login_codes`), emails it, and allows one resend per 30 s.
2. `POST /api/auth/verify-code {email, code}`: the code expires in 10 min and allows 5 tries. On success it upserts `app_users`, ensures a `profiles` row, and returns `{ token, user }`.
3. The web app stores `{userId, email, accessToken}` in localStorage (`motionmind-session`). Any 401 signs the user out.
4. Without `SMTP_HOST`, `ConsoleMailer` prints the code in the API terminal.

## Commands (always from the repo root)

| Command | What it does |
|---|---|
| `npm install` | everything, including Remotion |
| `npm run setup` | creates `.env` from `.env.example`, generates `AUTH_SECRET`, lists what's missing |
| `npm run dev` | API on :8787 + web on :5173 together (`dev:api` / `dev:web` for one side) |
| `npm run typecheck` | tsc for shared, backend, frontend |
| `npm test` | Jest, all three projects. One project: `npm test -- --selectProjects backend`. One file: `npm test -- LoginPage` |
| `npm run test:watch` / `npm run test:coverage` | watch mode / coverage report in `coverage/` |
| `npm run build` | typecheck, then `vite build frontend` into `frontend/dist` |
| `npm run reel:tts` / `npm run reel:render -- video out` | reel engine (ElevenLabs voice, then MP4) |

## Environment (`.env` at the root, template `.env.example`)

- API: `API_DATA_MODE` (`supabase` | `memory`), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `AUTH_SECRET`, `ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY`, `SMTP_HOST/PORT/USER/PASS/FROM`, `PORT`, `WEB_ORIGIN`.
- Web: `VITE_DATA_MODE` (`api` | `memory`). Only `VITE_*` values reach the browser, so never prefix a secret with `VITE_`. `VITE_API_URL` is optional; leave it unset to use the same origin.
- Reel engine: `ELEVENLABS_API_KEY` (shared with the API), `ELEVENLABS_VOICE_ID`.
- Changing `AUTH_SECRET` signs everyone out.

## Conventions

- **Validate at the edge.** Every route parses `req.body`/`params` with zod and answers `400 { error, message }` using `firstIssue()`. `message` is shown to users as-is, so write it as a plain sentence.
- **Error shape:** `{ error: 'snake_code', message: 'Human sentence.' }`. Unknown errors become 500 with a generic message, and details go to the log.
- **Storage behind interfaces.** Each repository has a `Memory*` version (tests, demo mode) and a `Supabase*` version. Add a method to both.
- **Wiring through `AppDeps`.** New services are added to `AppDeps`, built in `bootstrap.ts`, and passed in tests from `app.test.ts`'s `setup()`.
- **Frontend data:** pages call stores, stores call `root.services.*`, and services call `apiRequest`. Pages never call fetch directly. Show errors with `errorText(err)`.
- **Shared rules** (handles, stages, reel script shape, brand name) live in `shared/src` and are imported as `@motionmind/shared`. Don't duplicate them.
- **Motion:** shared pieces live in `components/motion.tsx` (`Reveal` on-scroll fade-in, `CountUp`, `ProgressRing`, `Typewriter`), with keyframes in `tailwind.config.js` and helpers (`.text-gradient`, `.orb`, `.reveal`, `.draw`) in `index.css`. Everything stops under `prefers-reduced-motion`. Project progress for the stepper, rings and "Continue" comes from `lib/progress.ts` (`STAGE_INFO` also holds each step's explanation and tip). To check a design change without a browser tab: run the app in demo mode (`VITE_DATA_MODE=memory npx vite frontend --port 5199`) and use a headless Chrome screenshot script.
- **Look:** pure white surfaces on a faint cool-grey canvas (`ink-800`), near-black text, and one purple accent. The Tailwind colour named `mint` is the brand purple (historical name), `text-accent` is its text version, and success states use emerald. Layout follows a workspace pattern: white sidebar (New reel, nav, Recent, AI mode card, user), breadcrumb top bar, and on a project a vertical steps card beside the stage content (`pages/app/ProjectLayout.tsx`). Segmented controls (library filters, settings tabs) are a grey pill with a white selected tab. Empty stages use `components/EmptyState.tsx`. Discover (`pages/app/DiscoverPage.tsx`) has a **Trending now** tab (`TrendingPanel.tsx`, backend `backend/src/discover/`): Wikipedia's public most-read pages for yesterday (English or Hindi, cached an hour, adult and obituary-list pages filtered out, falls back to the day before), plus reel ideas Claude makes from them, by the server key (`POST /discover/ideas`) or copy and paste (`GET /discover/prompt` + `POST /discover/import`), saved in localStorage; the other tabs are curated starter ideas. All ideas open the new-reel form with `?new=1&topic=`. To screenshot pages that need a real script, run the API in memory mode on a spare port (`PORT=8799 API_DATA_MODE=memory`, no `.env`, codes print in its log) and point Vite at it with the same `PORT`. Don't add cream or beige: that was the old theme. The reel video itself keeps its own pastel look (that is the engine's, not the web UI's).
- **Styling:** use the Tailwind tokens in `frontend/tailwind.config.js` (`ink-*`, `line`, `accent`, `danger`, `mint`, …) and the `components/ui` pieces. Theme values are CSS variables in `index.css`, with light and dark both supported.
- **Copy:** product name from `BRAND.name`. The UI language is plain, and nothing pretends to work when it doesn't.
- **Tests (Jest):** import `describe/it/expect/jest` from `@jest/globals`, since there are no globals. Put tests next to the code as `*.test.ts(x)`. Add an `app.inject()` test for each new route, and a page test (`renderWithStore`, Testing Library) or store/service test for each new frontend flow. Keep `npm run typecheck && npm test && npm run build` green before committing.
- **UI logs:** use `log.info/warn/error(scope, message, data)` from `frontend/src/lib/logger.ts` for anything that helps explain a problem later (user actions, failures, unexpected states). API calls, page changes, crashes, toasts with errors and uncaught errors are logged automatically. Sensitive keys (token, apiKey, code, password, secret) are redacted. Never log request bodies. Users see the log in **Settings → Diagnostics**. Warnings and errors are batched to `/api/client-logs` and appear on the server as `[client-log] {...}` lines.

## Adding a feature (checklist)

1. Types and rules both sides need go in `shared/src` (export from `index.ts`).
2. Schema changes go in a new file in `supabase/migrations/` (timestamped). Enable RLS, add no policies, and revoke from `anon, authenticated`. Update `supabase/test/rls-test.sql`. Ask before applying to motion-mind.
3. Backend: add the repository methods (Memory + Supabase), a `routes.ts` in the feature folder, and register it in `app.ts`. Add tests.
4. Frontend: add the service method in `services/api.ts` (+ `memory.ts` for demo mode), the store, and the page. Add the route in `App.tsx`.

## Gotchas

- Windows dev machine, PowerShell 5.1: `Set-Content -Encoding utf8` writes a BOM, which breaks JSON. Write files with the editor tools, or `[IO.File]::WriteAllText`.
- Vite, PostCSS and Tailwind configs use paths relative to their own files (`import.meta.url`), because commands run from the root.
- `reel-engine/render.mjs` lets Remotion download its own Chrome; set `REMOTION_BROWSER` to use an installed one.
