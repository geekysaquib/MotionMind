# Motion Mind: context for Claude

Motion Mind is an AI studio that turns a topic into a researched, animated Instagram explainer reel (1080x1920). The flow per project: topic, research, script, storyboard, graphics, voice, final. **Phase 1 is built:** email-code accounts, handles, onboarding, dashboard, project library, a route for every stage, Claude and ElevenLabs connectors on server keys. Every stage is built: Research, Script, Storyboard, Graphics, Voice, Reel editor and Export, each using the server's keys, plus a claude.ai copy-paste route for Research and Script for people with only a Claude subscription.

Owner: Saquib. Read this file first, then `HANDOFF.md` (what's done, what's next) and the README for setup steps.

## Decisions that are already made (don't undo without asking)

- **Hosting is Netlify only.** The web app is static files, and the API is one Netlify Function at `/api/*` on the same domain (`netlify.toml`, `backend/netlify/functions/api.ts`). Video rendering can't run there (needs Chromium/ffmpeg and minutes of compute). Remotion Lambda versus a render server is still Saquib's call.
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
│   ├── netlify/functions/api.ts   Netlify entry: wraps the same app with app.inject()
│   └── reel-engine/          Remotion engine. Reel takes a ReelSpec as props: 'train' or 'iso' 3D world ('cards' is legacy).
│                             src/public.ts = what the web app imports as @motionmind/reel-engine (live preview);
│                             render.mjs / tts.mjs = CLI MP4 render and ElevenLabs voice for the sample reel
├── shared/src/               used by both sides: brand, handle rules, project types/STAGES
├── supabase/
│   ├── migrations/           20261103000000_init.sql = the whole schema (reset on 2026-11-03); add new files after it
│   └── test/                 run.sh: applies migrations to a throwaway Postgres (Linux only)
├── scripts/                  setup.mjs (creates .env + secrets), dev.mjs (runs API + web together)
├── brand/                    logo files
├── netlify.toml
├── package.json              every dependency and command
├── tsconfig.base.json        shared TS options + paths alias @motionmind/shared -> shared/src
├── jest.config.js            Jest projects: frontend (jsdom), backend (node), shared (node); TS via SWC, ESM
└── test/                     Jest support: jsdom env with fetch/crypto, cookie shim, quiet app logs
```

## How a request flows

Browser, then `services/api.ts`, then `apiRequest()`, then `/api/...` (same origin; Vite proxies it in dev, Netlify routes it to the function in prod). Then Fastify `buildApp`. For signed-in routes, the `onRequest` hook verifies the bearer token and sets `req.userId`. Then the route handler validates with zod, calls a repository, and the Supabase service-role client does the query.

Every route only ever reads or writes rows for `req.userId`. Repositories take `userId`/`ownerId` as the first argument. Keep it that way.

## Claude and the reel engine

- Claude runs only on the API with the server's `ANTHROPIC_API_KEY`. Users never set up API keys (decided by Saquib); add any future provider the same way, as a server env var. `backend/src/ai/claude.ts` uses `@anthropic-ai/sdk`, model `claude-opus-5-5`, server-side refusal fallback (`fallbacks: 'default'`), and structured output (`betaZodOutputFormat(reelScriptSchema)`) for scripts. Tests inject `AppDeps.claude` instead of calling Anthropic.
- Two ways to get a script (Saquib wants both): **Write with Claude** (`POST /projects/:id/script`, needs the server's `ANTHROPIC_API_KEY`), and **write it in claude.ai** for people with only a Claude subscription: `GET /projects/:id/script/prompt` gives a copy-paste prompt with the JSON schema, and `POST /projects/:id/script/import {text}` validates and saves the pasted answer (`ai/reelPrompt.ts`, `PasteScriptPanel.tsx`). Both share one prompt builder. A Claude Pro subscription can't power the API.
- Research works the same two ways: `POST /projects/:id/research` (Claude with the `web_search_20260209` server tool, resumes `pause_turn`), or `GET .../research/prompt` + `POST .../research/import` for claude.ai. Saved as `projects.research` (`ResearchReport`: summary, facts with status + source indexes, sources). `POST .../research/approve` sets `approvedAt`; only approved research is passed into the script prompt.
- Storyboard: `PUT /projects/:id/script` saves the user's scene edits (sets `editedAt`).
- Graphics: three worlds. `train` = the original 3D railway world (`World.tsx`); beats pick a named `shot` (phone, tower, map, crowd, station, accuracy, wide → camera keys in `Reel.tsx`) and `events`. `iso` = the 3D isometric scene kit (`IsoWorld.tsx`) for any topic: each beat's `scene` lists props (16 named kinds in `PROP_KINDS`, or kind `custom` for ANY other object: an emoji `icon`, a `shape` block/tall/wide/flat/round and a `tone`, so the objects follow the topic), links (arcs with a travelling packet) and an effect; a prop id keeps one spot in the world across beats (`layoutProps` puts new props next to the props they share a scene with) and the camera glides to each scene, zoomed so every object, icon and label fits the safe area between the title card and the captions (`isoCamera`). The script's `theme` (city, nature, lab, plain, night, sunset, ocean, desert) sets ground, water, sky fade and scenery (`THEMES` in `IsoWorld.tsx`). Besides the 16 original kinds there are 24 more 3D models in `props3d.tsx` (`EXTRA_KINDS`: qr, speaker, lock, database, router, battery, heart, gear, truck, plane, train, tree, hospital, school, cart, camera, bulb, globe, envelope, clock, rocket, syringe, chart, atm); a new kind goes in `PROP_KINDS` (engine), `ScenePropKind` + `SCENE_PROP_KINDS` (shared), the zod enum in `reelSchema.ts`, `KIND_WORDS` in `autoScene.ts` and the labels in `SceneEditor.tsx`. `samples/models.json` shows them all. Anything else is an **icon tile**: a `custom` prop with `glyph` = any Lucide icon name (1,539 of them, from `iconData.ts`, generated by `node scripts/gen-icons.mjs`) drawn as a raised 3D tile by `glyph.tsx`. Claude is told to prefer `glyph` over emoji, `autoScene` maps keywords and any word that is an icon name to one, and `SceneEditor` has an "Icon name" field. `samples/icons.json` shows it. `npm run reel:stills -- <spec.json> <outDir>` renders one still per scene (samples in `backend/reel-engine/samples/`) to check the graphics without exporting a video. Every reel is 3D (Saquib's rule): `reelWorld()` in shared picks the world Claude chose, else `train` for train topics and `iso` otherwise; web (`worldFor`) and export (`reelSpecFor`) both use it. Beats Claude didn't describe get a scene or train shot filled in by `autoScene.ts` (`withScenes`, applied inside `Reel`), guessed from the card's words: a named kind when one matches, otherwise a `custom` object with an emoji from `ICON_WORDS`. On the Storyboard, `components/SceneEditor.tsx` lets the user edit each scene's objects (kind, label, icon, shape, colour; reuse an object from another scene), links, effect and camera focus, plus the world theme; "Edit the objects" turns an automatic scene into an explicit one and "Back to automatic" undoes that. `cards` (`CardsScene.tsx`) is no longer chosen for scripts. The original reel's look is the bar: Saquib compared against it.
- Voice: `POST /projects/:id/voice {voiceId}` speaks each beat with ElevenLabs (`connectors/elevenlabs.ts`, with-timestamps) on `ELEVENLABS_API_KEY`, stores MP3s via `AudioStore` (Supabase Storage private bucket `voice`, or memory/data URLs), saves `projects.voice` (`ReelVoice`: per-beat duration + word timings + the narrations it was made from). `GET .../voice` returns signed URLs and `stale` if the narration changed. `specFromScript(script, brand, {voice, urls})` attaches audio only when it matches the script.
- Reel editor (`projects.editor`, `ReelEditor` in `shared/src/editor.ts`): the user uploads their own voiceover (`POST /projects/:id/audio/voice`, raw body, magic-byte sniffed in `editor/audioFormat.ts`, max 40 MB / 5 min, stored via `AudioStore` under `<user>/<project>/`). The browser decodes it (`lib/audioAnalysis.ts`) for length + loudness peaks; `autoCuts` guesses the scene starts; the user drags the breaks on `Timeline.tsx`. `PUT /projects/:id/editor` saves (validates path ownership, cut order, cut count = scenes - 1, deletes replaced files). The engine plays each scene's slice of the one recording at `pace x scenePace` (`playbackRate`, pitch kept; `timeBeats` + `sceneRates` in `script.ts`), plus looping music and caption style. `specFromScript(..., editor)` (web) and `reelSpecFor` (export) both call `editorSpecParts`. The recording wins over ElevenLabs while `voiceSource` is `upload` and the cuts match the scenes. Needs migration `20261104000200_project_editor.sql`.
- Export: `POST /projects/:id/export` renders the 1080x1920 MP4 with Remotion (`export/renderer.ts`: bundle the engine once, `selectComposition` + `renderMedia`), as a background job polled by `GET .../export`. Files go to `renders/` (git-ignored) and are served at `/api/renders/<uuid>.mp4`. Only on a local server: on Netlify (`NETLIFY`/`AWS_LAMBDA_FUNCTION_NAME` set) there's no renderer and the route answers 501. Remotion packages are imported by name at runtime so the function bundle never includes them. The first export downloads Remotion's headless Chrome.
- A project's script is `projects.script` (jsonb) with the `ReelScript` shape in `shared/src/projects.ts`. `frontend/src/components/reelSpec.ts` turns it into the engine's `ReelSpec` (3D world from `reelWorld()`, branded with the user's channel).
- The web app embeds the engine through `@remotion/player` (`components/ReelPreview.tsx`, lazy-loaded). Keep the engine browser-safe: no Node imports in `backend/reel-engine/src`.
- **AI mode** (Settings → AI & connectors, `stores/AiModeStore.ts`, saved in the browser's localStorage, default `paste`): the user picks copy-paste or API keys. Every stage shows only the chosen way: Research and Script show either the key button or the claude.ai prompt panel, Voice hides ElevenLabs in paste mode (uploading your own recording is always available), and Settings hides the connector cards. Tests set it with `makeStore({ aiMode })` (default `keys`).
- Settings → Connectors has exactly two connectors, Claude and ElevenLabs, both on server keys (`ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY`). Each shows Ready/Not available and a test; Claude also has an "Ask Claude" box. No key fields for users. Project → Script has "Write with Claude" and the live preview.
- Netlify Functions time out at about 10 to 26 seconds, and a long script can take longer. If that bites, move script writing to a Netlify Background Function or stream it.

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
- On Netlify, set the API variables in the dashboard. The web app needs none.
- Changing `AUTH_SECRET` signs everyone out.

## Conventions

- **Validate at the edge.** Every route parses `req.body`/`params` with zod and answers `400 { error, message }` using `firstIssue()`. `message` is shown to users as-is, so write it as a plain sentence.
- **Error shape:** `{ error: 'snake_code', message: 'Human sentence.' }`. Unknown errors become 500 with a generic message, and details go to the log.
- **Storage behind interfaces.** Each repository has a `Memory*` version (tests, demo mode) and a `Supabase*` version. Add a method to both.
- **Wiring through `AppDeps`.** New services are added to `AppDeps`, built in `bootstrap.ts`, and passed in tests from `app.test.ts`'s `setup()`.
- **Frontend data:** pages call stores, stores call `root.services.*`, and services call `apiRequest`. Pages never call fetch directly. Show errors with `errorText(err)`.
- **Shared rules** (handles, stages, reel script shape, brand name) live in `shared/src` and are imported as `@motionmind/shared`. Don't duplicate them.
- **Motion:** shared pieces live in `components/motion.tsx` (`Reveal` on-scroll fade-in, `CountUp`, `ProgressRing`, `Typewriter`), with keyframes in `tailwind.config.js` and helpers (`.text-gradient`, `.orb`, `.reveal`, `.draw`) in `index.css`. Everything stops under `prefers-reduced-motion`. Project progress for the stepper, rings and "Continue" comes from `lib/progress.ts` (`STAGE_INFO` also holds each step's explanation and tip). To check a design change without a browser tab: run the app in demo mode (`VITE_DATA_MODE=memory npx vite frontend --port 5199`) and use a headless Chrome screenshot script.
- **Look:** pure white surfaces on a faint cool-grey canvas (`ink-800`), near-black text, and one purple accent. The Tailwind colour named `mint` is the brand purple (historical name), `text-accent` is its text version, and success states use emerald. Layout follows a workspace pattern: white sidebar (New reel, nav, Recent, AI mode card, user), breadcrumb top bar, and on a project a vertical steps card beside the stage content (`pages/app/ProjectLayout.tsx`). Segmented controls (library filters, settings tabs) are a grey pill with a white selected tab. Empty stages use `components/EmptyState.tsx`. Discover (`pages/app/DiscoverPage.tsx`) is a set of curated starter ideas by category that open the new-reel form with `?new=1&topic=`; it is not live trending and says so. To screenshot pages that need a real script, run the API in memory mode on a spare port (`PORT=8799 API_DATA_MODE=memory`, no `.env`, codes print in its log) and point Vite at it with the same `PORT`. Don't add cream or beige: that was the old theme. The reel video itself keeps its own pastel look (that is the engine's, not the web UI's).
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
- The Netlify function bundles with esbuild, which resolves `@motionmind/shared` through `backend/tsconfig.json` → `tsconfig.base.json` paths.
